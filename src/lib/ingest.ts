import { and, count, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { getDb, schema, type DB } from "@/db";
import { COMPANIES, type Company } from "./companies";
import { FetchError, fetchCompanyJobs, PROVIDERS } from "./ats";
import { htmlToText } from "./ats/http";
import { getDescription } from "./details";
import { enrich } from "./enrich";

const { jobs, companies, runs } = schema;

interface IngestResult {
  runId: number | null;
  skipped?: string;
  companiesOk: number;
  companiesFailed: string[];
  newJobs: number;
  closedJobs: number;
  ms: number;
}

/** A board that suddenly returns 0 jobs is usually a glitch. Only close its jobs after this many empty crawls in a row. */
const EMPTY_CRAWLS_BEFORE_CLOSING = 3;
/** A board that answers "not found" this many crawls in a row is switched off (still listed on /status). */
const NOT_FOUND_CRAWLS_BEFORE_DISABLING = 3;
/** A run older than this with no finish time is treated as crashed, so it doesn't block new runs forever. */
const STALE_RUN_MS = 20 * 60_000;
/** How often a paginated board gets a full read (the other runs read only its newest pages). */
const FULL_CRAWL_EVERY_MS = 60 * 60_000;
/** Full postings read per board per run, for ATSs whose lists leave descriptions out. */
const DETAILS_PER_BOARD_PER_RUN = 25;
const DAY = 86_400_000;

async function pool<T>(items: T[], size: number, fn: (t: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: size }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) await fn(item);
    }),
  );
}

/** Insert a run row only if no other run is in progress (atomic, so two schedulers can't overlap). */
async function acquireRun(db: DB, trigger: string): Promise<number | null> {
  const staleBefore = new Date(Date.now() - STALE_RUN_MS);
  const res = await db.execute(sql`
    INSERT INTO ${runs} (trigger, started_at)
    SELECT ${trigger}, now()
    WHERE NOT EXISTS (SELECT 1 FROM ${runs} WHERE finished_at IS NULL AND started_at > ${staleBefore})
    RETURNING id`);
  const rows = (res as unknown as { rows: { id: number }[] }).rows;
  return rows[0]?.id ?? null;
}

async function syncCompanyList(db: DB, list: Company[]) {
  if (!list.length) return;
  await db
    .insert(companies)
    .values(list.map((c) => ({ ats: c.ats, slug: c.slug, name: c.name, domain: c.domain ?? null, board: c.board ?? null })))
    .onConflictDoUpdate({
      target: [companies.ats, companies.slug],
      set: { name: sql`excluded.name`, domain: sql`excluded.domain`, board: sql`excluded.board` },
    });
}

const boardFilter = (c: Company) => and(eq(jobs.ats, c.ats), eq(jobs.company_slug, c.slug));

/** Fields a job's full description can improve; a later list read must not overwrite them with less. */
const keepIfDetailed = (col: string) =>
  sql.raw(`case when jobs.desc_checked and not excluded.desc_checked then jobs.${col} else excluded.${col} end`);

async function crawlCompany(db: DB, c: Company, res: IngestResult) {
  const now = new Date();
  const [row] = await db.select().from(companies).where(and(eq(companies.ats, c.ats), eq(companies.slug, c.slug)));
  const provider = PROVIDERS[c.ats];

  // Big paginated boards read only their newest pages most runs (new jobs are always on top);
  // a full pass, which is what lets us notice removed jobs, runs at most hourly.
  const full = !row?.last_full_crawl_at || now.getTime() - row.last_full_crawl_at.getTime() >= FULL_CRAWL_EVERY_MS;
  const known = full
    ? undefined
    : new Set((await db.select({ id: jobs.ats_job_id }).from(jobs).where(and(boardFilter(c), isNull(jobs.closed_at)))).map((r) => r.id));

  let result;
  try {
    result = await fetchCompanyJobs(c, { known, full });
  } catch (e) {
    const failures = (row?.consecutive_failures ?? 0) + 1;
    // "Not found" means the board itself is gone (company left this ATS or renamed it): its jobs can't be
    // applied to anymore, so they leave the site right away. Timeouts and 5xx are temporary: jobs stay.
    const gone = e instanceof FetchError && e.status === 404;
    if (gone) {
      const closed = await db.update(jobs).set({ closed_at: now }).where(and(boardFilter(c), isNull(jobs.closed_at))).returning({ id: jobs.id });
      res.closedJobs += closed.length;
    }
    await db
      .update(companies)
      .set({
        last_error_at: now,
        last_error: (e as Error).message,
        consecutive_failures: failures,
        ...(gone ? { open_jobs: 0, enabled: failures < NOT_FOUND_CRAWLS_BEFORE_DISABLING } : {}),
      })
      .where(and(eq(companies.ats, c.ats), eq(companies.slug, c.slug)));
    res.companiesFailed.push(`${c.ats}/${c.slug} (${(e as Error).message})`);
    return;
  }

  // On a company's very first crawl, its whole backlog is new to us, so first_seen = the ATS publish date
  // (or a month back when the ATS doesn't say, so a backlog never looks "just found").
  // After that, first_seen = the moment this crawler discovered the job.
  const firstCrawl = !row?.first_crawled_at;
  // One row per job id: a repeated id in one batch would make Postgres reject the whole board.
  const unique = [...new Map(result.jobs.map((j) => [j.atsJobId, j])).values()];
  const enriched = unique.map(enrich);
  const ids = enriched.map((j) => `${j.ats}:${j.atsJobId}`);
  const backlogDate = new Date(now.getTime() - 30 * DAY);

  await db.transaction(async (tx) => {
    let inserted = 0;
    for (let i = 0; i < enriched.length; i += 500) {
      const chunk = enriched.slice(i, i + 500).map((j) => ({
        id: `${j.ats}:${j.atsJobId}`,
        ats: j.ats,
        ats_job_id: j.atsJobId,
        company_slug: c.slug,
        company_name: c.name,
        company_domain: c.domain ?? null,
        title: j.title,
        location: j.location,
        department: j.department,
        employment_type: j.employmentType,
        remote: j.remote,
        url: j.url,
        apply_url: j.applyUrl,
        published_at: j.publishedAt ? new Date(j.publishedAt) : null,
        first_seen_at: firstCrawl ? (j.publishedAt ? new Date(j.publishedAt) : backlogDate) : now,
        last_seen_at: now,
        country: j.country,
        visa: j.visa,
        min_exp: j.minExp,
        category: j.category,
        seniority: j.seniority,
        salary: j.salary,
        salary_min: j.salaryMin,
        desc_checked: provider.descriptionsInList,
      }));
      // xmax = 0 means the row was inserted, not updated: that's how we count genuinely new jobs.
      const out = await tx
        .insert(jobs)
        .values(chunk)
        .onConflictDoUpdate({
          target: jobs.id,
          set: {
            title: sql`excluded.title`, department: sql`excluded.department`, url: sql`excluded.url`,
            apply_url: sql`excluded.apply_url`, published_at: sql`coalesce(excluded.published_at, ${jobs.published_at})`,
            last_seen_at: sql`excluded.last_seen_at`, closed_at: sql`null`,
            category: sql`excluded.category`, seniority: sql`excluded.seniority`,
            company_name: sql`excluded.company_name`, company_domain: sql`excluded.company_domain`,
            location: keepIfDetailed("location"), country: keepIfDetailed("country"), remote: keepIfDetailed("remote"),
            employment_type: keepIfDetailed("employment_type"), visa: keepIfDetailed("visa"), min_exp: keepIfDetailed("min_exp"),
            salary: keepIfDetailed("salary"), salary_min: keepIfDetailed("salary_min"),
            desc_checked: sql`${jobs.desc_checked} or excluded.desc_checked`,
          },
        })
        .returning({ inserted: sql<boolean>`(xmax = 0)` });
      inserted += out.filter((r) => r.inserted).length;
    }
    if (!firstCrawl) res.newJobs += inserted;

    // Close jobs that vanished from the board.
    const emptyStreak = result.complete && ids.length === 0 ? (row?.consecutive_empty ?? 0) + 1 : 0;
    const looksGlitched = result.complete && ids.length === 0 && (row?.open_jobs ?? 0) > 0 && emptyStreak < EMPTY_CRAWLS_BEFORE_CLOSING;
    let closeWhere;
    if (result.complete) {
      if (!looksGlitched) closeWhere = and(boardFilter(c), isNull(jobs.closed_at), lt(jobs.last_seen_at, now));
    } else if (full) {
      // A capped board (e.g. Workday shows at most 2,000): we only saw the newest part, so judge only jobs
      // posted inside that window (with a day's margin). Older ones are checked when opened or enriched.
      const dates = enriched.map((j) => (j.publishedAt ? new Date(j.publishedAt).getTime() : NaN)).filter(Number.isFinite);
      if (dates.length) {
        const oldest = new Date(Math.min(...dates) + DAY);
        closeWhere = and(boardFilter(c), isNull(jobs.closed_at), lt(jobs.last_seen_at, now), gt(jobs.published_at, oldest));
      }
    }
    if (closeWhere) {
      const closed = await tx.update(jobs).set({ closed_at: now }).where(closeWhere).returning({ id: jobs.id });
      res.closedJobs += closed.length;
    }

    const [{ open }] = await tx.select({ open: count() }).from(jobs).where(and(boardFilter(c), isNull(jobs.closed_at)));
    await tx
      .update(companies)
      .set({
        first_crawled_at: row?.first_crawled_at ?? now,
        last_ok_at: now,
        last_error: null,
        consecutive_failures: 0,
        consecutive_empty: emptyStreak,
        open_jobs: Number(open),
        ...(full ? { last_full_crawl_at: now } : {}),
      })
      .where(and(eq(companies.ats, c.ats), eq(companies.slug, c.slug)));
  });

  if (!provider.descriptionsInList) await fillDetails(db, c, res);
  res.companiesOk++;
}

/**
 * For ATSs whose lists leave out descriptions: read a few full postings per run (newest first) to fill in
 * visa, experience, salary and exact locations. Postings that turn out to be gone are closed right away.
 */
async function fillDetails(db: DB, c: Company, res: IngestResult) {
  const pending = await db
    .select()
    .from(jobs)
    .where(and(boardFilter(c), isNull(jobs.closed_at), eq(jobs.desc_checked, false)))
    .orderBy(desc(jobs.first_seen_at))
    .limit(DETAILS_PER_BOARD_PER_RUN);
  for (const j of pending) {
    const { detail, gone } = await getDescription(c, j.ats_job_id);
    if (gone) {
      await db.update(jobs).set({ closed_at: new Date() }).where(eq(jobs.id, j.id));
      res.closedJobs++;
      continue;
    }
    if (!detail) continue; // network trouble: try again next run
    const e = enrich({
      ats: c.ats,
      atsJobId: j.ats_job_id,
      companySlug: c.slug,
      companyName: c.name,
      title: j.title,
      location: detail.location || j.location,
      department: j.department,
      employmentType: detail.employmentType ?? j.employment_type,
      isRemote: detail.remote ?? j.remote,
      url: j.url,
      applyUrl: j.apply_url,
      publishedAt: null,
      descriptionText: htmlToText(detail.html),
      salary: detail.salary ?? j.salary,
    });
    await db
      .update(jobs)
      .set({
        location: e.location, country: e.country, remote: e.remote, employment_type: e.employmentType,
        visa: e.visa, min_exp: e.minExp, salary: e.salary, salary_min: e.salaryMin, category: e.category, seniority: e.seniority,
        desc_checked: true,
      })
      .where(eq(jobs.id, j.id));
  }
}

/** Poll every enabled company's ATS board, upsert jobs, close jobs that disappeared. Safe to call concurrently. */
export async function runIngest(opts: { trigger?: string; concurrency?: number } = {}): Promise<IngestResult> {
  const db = await getDb();
  const t0 = Date.now();
  const res: IngestResult = { runId: null, companiesOk: 0, companiesFailed: [], newJobs: 0, closedJobs: 0, ms: 0 };

  const runId = await acquireRun(db, opts.trigger ?? "manual");
  if (!runId) return { ...res, skipped: "another crawl is already running" };
  res.runId = runId;

  try {
    await syncCompanyList(db, COMPANIES);
    const enabled = await db.select().from(companies).where(eq(companies.enabled, true));
    const list: Company[] = enabled.map((c) => ({
      ats: c.ats as Company["ats"],
      slug: c.slug,
      name: c.name,
      domain: c.domain ?? undefined,
      board: (c.board ?? undefined) as Company["board"],
    }));
    await pool(list, opts.concurrency ?? 12, (c) =>
      crawlCompany(db, c, res).catch((e) => {
        res.companiesFailed.push(`${c.ats}/${c.slug} (db: ${(e as Error).message})`);
      }),
    );
  } catch (e) {
    await db.update(runs).set({ finished_at: new Date(), error: (e as Error).message }).where(eq(runs.id, runId));
    throw e;
  }

  res.ms = Date.now() - t0;
  await db
    .update(runs)
    .set({ finished_at: new Date(), companies_ok: res.companiesOk, companies_failed: res.companiesFailed.length, new_jobs: res.newJobs, closed_jobs: res.closedJobs })
    .where(eq(runs.id, runId));
  return res;
}
