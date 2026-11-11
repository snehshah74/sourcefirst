import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { getDb, schema, type DB } from "@/db";
import { COMPANIES, type Company } from "./companies";
import { fetchCompanyJobs } from "./ats";
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
/** A run older than this with no finish time is treated as crashed, so it doesn't block new runs forever. */
const STALE_RUN_MS = 10 * 60_000;

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
    .values(list.map((c) => ({ ats: c.ats, slug: c.slug, name: c.name, domain: c.domain ?? null })))
    .onConflictDoUpdate({
      target: [companies.ats, companies.slug],
      set: { name: sql`excluded.name`, domain: sql`excluded.domain` },
    });
}

async function crawlCompany(db: DB, c: Company, res: IngestResult) {
  const now = new Date();
  const [row] = await db.select().from(companies).where(and(eq(companies.ats, c.ats), eq(companies.slug, c.slug)));

  let raw;
  try {
    raw = await fetchCompanyJobs(c);
  } catch (e) {
    await db
      .update(companies)
      .set({ last_error_at: now, last_error: (e as Error).message, consecutive_failures: sql`${companies.consecutive_failures} + 1` })
      .where(and(eq(companies.ats, c.ats), eq(companies.slug, c.slug)));
    res.companiesFailed.push(`${c.ats}/${c.slug} (${(e as Error).message})`);
    return;
  }

  // On a company's very first crawl, its whole backlog is new to us, so first_seen = the ATS publish date.
  // After that, first_seen = the moment this crawler discovered the job.
  const firstCrawl = !row?.first_crawled_at;
  const enriched = raw.map(enrich);
  const ids = enriched.map((j) => `${j.ats}:${j.atsJobId}`);

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
        first_seen_at: firstCrawl && j.publishedAt ? new Date(j.publishedAt) : now,
        last_seen_at: now,
        country: j.country,
        visa: j.visa,
        min_exp: j.minExp,
        category: j.category,
        seniority: j.seniority,
        salary: j.salary,
        salary_min: j.salaryMin,
      }));
      // xmax = 0 means the row was inserted, not updated: that's how we count genuinely new jobs.
      const out = await tx
        .insert(jobs)
        .values(chunk)
        .onConflictDoUpdate({
          target: jobs.id,
          set: {
            title: sql`excluded.title`, location: sql`excluded.location`, department: sql`excluded.department`,
            employment_type: sql`excluded.employment_type`, remote: sql`excluded.remote`, url: sql`excluded.url`,
            apply_url: sql`excluded.apply_url`, published_at: sql`excluded.published_at`, last_seen_at: sql`excluded.last_seen_at`,
            closed_at: sql`null`, country: sql`excluded.country`, visa: sql`excluded.visa`, min_exp: sql`excluded.min_exp`,
            category: sql`excluded.category`, seniority: sql`excluded.seniority`, salary: sql`excluded.salary`, salary_min: sql`excluded.salary_min`,
            company_name: sql`excluded.company_name`, company_domain: sql`excluded.company_domain`,
          },
        })
        .returning({ inserted: sql<boolean>`(xmax = 0)` });
      inserted += out.filter((r) => r.inserted).length;
    }
    if (!firstCrawl) res.newJobs += inserted;

    // Close jobs that vanished from the board, unless the board looks glitched (suddenly empty).
    const emptyStreak = ids.length === 0 ? (row?.consecutive_empty ?? 0) + 1 : 0;
    const looksGlitched = ids.length === 0 && (row?.open_jobs ?? 0) > 0 && emptyStreak < EMPTY_CRAWLS_BEFORE_CLOSING;
    if (!looksGlitched) {
      const closed = await tx
        .update(jobs)
        .set({ closed_at: now })
        .where(and(eq(jobs.ats, c.ats), eq(jobs.company_slug, c.slug), isNull(jobs.closed_at), lt(jobs.last_seen_at, now)))
        .returning({ id: jobs.id });
      res.closedJobs += closed.length;
    }

    await tx
      .update(companies)
      .set({
        first_crawled_at: row?.first_crawled_at ?? now,
        last_ok_at: now,
        last_error: null,
        consecutive_failures: 0,
        consecutive_empty: emptyStreak,
        open_jobs: looksGlitched ? row!.open_jobs : ids.length,
      })
      .where(and(eq(companies.ats, c.ats), eq(companies.slug, c.slug)));
  });
  res.companiesOk++;
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
    const list: Company[] = enabled.map((c) => ({ ats: c.ats as Company["ats"], slug: c.slug, name: c.name, domain: c.domain ?? undefined }));
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
