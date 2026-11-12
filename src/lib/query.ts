import { and, count, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, max, or, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { JobRow } from "./types";
import { skillFor } from "./skills";

const { jobs, companies, hiddenJobs } = schema;

interface JobFilters {
  q?: string;
  ats?: string[];
  visa?: string[];
  category?: string[];
  seniority?: string[];
  remote?: boolean;
  usOnly?: boolean;
  /** countries or regions, any of them ("India", "Europe") */
  places?: string[];
  /** tools the posting asks for, any of them ("SQL", "Python") */
  skills?: string[];
  sinceHours?: number;
  /** only jobs discovered after this instant (used by email alerts) */
  discoveredAfter?: Date;
  maxExp?: number;
  company?: string;
  /** text match on location, e.g. "New York" or "Austin" */
  loc?: string;
  /** minimum yearly salary (only jobs that list one) */
  minSalary?: number;
  /** exclude jobs this user marked "not interested" */
  hiddenFor?: string;
  sort?: "new" | "salary";
  page?: number;
  pageSize?: number;
}

export function parseFilters(sp: URLSearchParams): JobFilters {
  const list = (k: string) => sp.get(k)?.split(",").filter(Boolean);
  const num = (k: string) => (sp.get(k) && Number.isFinite(Number(sp.get(k))) ? Number(sp.get(k)) : undefined);
  return {
    q: sp.get("q")?.slice(0, 120) || undefined,
    ats: list("ats"),
    visa: list("visa"),
    category: list("category"),
    seniority: list("seniority"),
    remote: sp.get("remote") === "1" || undefined,
    // A picked country or region replaces the US-only default.
    usOnly: sp.get("us") !== "0" && !sp.get("place"),
    places: list("place")?.slice(0, 30),
    skills: list("skills")?.slice(0, 30),
    sinceHours: num("since"),
    maxExp: num("maxExp"),
    company: sp.get("company") ?? undefined,
    loc: sp.get("loc")?.slice(0, 80) || undefined,
    minSalary: num("minSalary"),
    page: num("page"),
    pageSize: num("pageSize"),
    sort: sp.get("sort") === "salary" ? "salary" : undefined,
  };
}

/** The filter keys that define a search (what a saved search stores). */
const FILTER_KEYS = ["q", "loc", "minSalary", "ats", "visa", "category", "seniority", "remote", "us", "place", "skills", "maxExp", "company", "sort"] as const;

export function canonicalQuery(sp: URLSearchParams): string {
  const out = new URLSearchParams();
  for (const k of FILTER_KEYS) {
    const v = sp.get(k);
    if (v) out.set(k, v);
  }
  out.sort();
  return out.toString();
}

function where(f: JobFilters): SQL | undefined {
  const w: (SQL | undefined)[] = [isNull(jobs.closed_at)];
  if (f.q) {
    for (const term of f.q.trim().split(/\s+/).slice(0, 6)) {
      const t = `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
      // Searching a skill ("BigQuery") also finds postings that ask for it, not just ones with it in the title.
      const skill = skillFor(term);
      w.push(or(ilike(jobs.title, t), ilike(jobs.company_name, t), ilike(jobs.location, t), ilike(jobs.department, t), skill ? sql`${jobs.skills} @> array[${skill}]::text[]` : undefined));
    }
  }
  if (f.ats?.length) w.push(inArray(jobs.ats, f.ats));
  if (f.visa?.length) w.push(inArray(jobs.visa, f.visa));
  if (f.category?.length) w.push(inArray(jobs.category, f.category));
  if (f.seniority?.length) w.push(inArray(jobs.seniority, f.seniority));
  if (f.remote) w.push(eq(jobs.remote, true));
  if (f.usOnly) w.push(eq(jobs.country, "USA"));
  if (f.places?.length) w.push(sql`${jobs.places} && array[${sql.join(f.places.map((p) => sql`${p}`), sql`, `)}]::text[]`);
  if (f.skills?.length) w.push(sql`${jobs.skills} && array[${sql.join(f.skills.map((p) => sql`${p}`), sql`, `)}]::text[]`);
  if (f.company) w.push(eq(jobs.company_slug, f.company));
  if (f.loc) w.push(ilike(jobs.location, `%${f.loc.replace(/[%_\\]/g, (c) => `\\${c}`)}%`));
  if (f.minSalary) w.push(gte(jobs.salary_min, f.minSalary));
  if (f.sinceHours) w.push(gte(jobs.first_seen_at, new Date(Date.now() - f.sinceHours * 3600_000)));
  if (f.discoveredAfter) w.push(sql`${jobs.first_seen_at} > ${f.discoveredAfter}`);
  if (f.maxExp !== undefined) w.push(or(isNull(jobs.min_exp), lte(jobs.min_exp, f.maxExp)));
  if (f.hiddenFor) w.push(sql`${jobs.id} not in (select ${hiddenJobs.jobId} from ${hiddenJobs} where ${hiddenJobs.userId} = ${f.hiddenFor})`);
  if (f.sort === "salary") w.push(isNotNull(jobs.salary_min));
  return and(...w);
}

const COLS = {
  id: jobs.id, ats: jobs.ats, company_slug: jobs.company_slug, company_name: jobs.company_name,
  company_domain: jobs.company_domain, title: jobs.title, location: jobs.location, department: jobs.department,
  employment_type: jobs.employment_type, remote: jobs.remote, url: jobs.url, apply_url: jobs.apply_url,
  published_at: jobs.published_at, first_seen_at: jobs.first_seen_at, country: jobs.country, visa: jobs.visa,
  min_exp: jobs.min_exp, category: jobs.category, seniority: jobs.seniority, salary: jobs.salary, salary_min: jobs.salary_min,
  skills: jobs.skills,
};

export async function searchJobs(f: JobFilters) {
  const db = await getDb();
  const pageSize = Math.min(f.pageSize ?? 50, 100);
  const page = Math.max(1, Math.floor(f.page ?? 1));
  const w = where(f);
  const [[{ n }], rows] = await Promise.all([
    db.select({ n: count() }).from(jobs).where(w),
    db.select(COLS).from(jobs).where(w).orderBy(...(f.sort === "salary" ? [desc(jobs.salary_min), desc(jobs.first_seen_at)] : [desc(jobs.first_seen_at)]), desc(jobs.id)).limit(pageSize).offset((page - 1) * pageSize),
  ]);
  return { jobs: rows as unknown as JobRow[], total: Number(n), page, pageSize };
}

export async function stats() {
  const db = await getDb();
  const dayAgo = new Date(Date.now() - 86400_000);
  const hourAgo = new Date(Date.now() - 3600_000);
  const open = isNull(jobs.closed_at);
  const [[a], [b], [c], [d], [e]] = await Promise.all([
    db.select({ n: count() }).from(jobs).where(open),
    db.select({ n: count() }).from(jobs).where(and(open, gte(jobs.first_seen_at, dayAgo))),
    db.select({ n: count() }).from(jobs).where(and(open, gte(jobs.first_seen_at, hourAgo))),
    db.select({ n: count() }).from(companies).where(isNotNull(companies.last_ok_at)),
    db.select({ t: max(companies.last_ok_at) }).from(companies),
  ]);
  return { openJobs: Number(a.n), jobsToday: Number(b.n), jobsLastHour: Number(c.n), companies: Number(d.n), lastRun: e.t ?? null };
}


/** The most recently found open roles for the live log on the home page, one per company so a bulk post can't fill it. */
export async function latestJobs(limit = 5) {
  const db = await getDb();
  const rows = await db
    .select({ id: jobs.id, title: jobs.title, company_name: jobs.company_name, company_domain: jobs.company_domain, first_seen_at: jobs.first_seen_at })
    .from(jobs)
    .where(isNull(jobs.closed_at))
    .orderBy(desc(jobs.first_seen_at), desc(jobs.id))
    .limit(200);
  const newest = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!newest.has(r.company_name)) newest.set(r.company_name, r);
  return [...newest.values()].slice(0, limit);
}

/** Well-known companies we track, in the given order, for the logo row on the home page. */
export async function featuredCompanies(slugs: string[]) {
  const db = await getDb();
  const rows = await db
    .select({ slug: companies.slug, name: companies.name, domain: companies.domain, ats: companies.ats })
    .from(companies)
    .where(and(inArray(companies.slug, slugs), isNotNull(companies.last_ok_at)));
  return slugs.map((s) => rows.find((r) => r.slug === s)).filter((r) => r !== undefined);
}

/** Every company with open roles, biggest first (for the /companies directory). */
export async function allCompanies() {
  const db = await getDb();
  return db
    .select({ slug: companies.slug, name: companies.name, domain: companies.domain, ats: companies.ats, open_jobs: companies.open_jobs })
    .from(companies)
    .where(and(isNotNull(companies.last_ok_at), sql`${companies.open_jobs} > 0`))
    .orderBy(desc(companies.open_jobs), companies.name);
}

/** A company and all its open jobs. Slugs can repeat across ATSs; the board with the most jobs wins. */
export async function companyWithJobs(slug: string) {
  const db = await getDb();
  const [company] = await db
    .select()
    .from(companies)
    .where(and(sql`lower(${companies.slug}) = lower(${slug})`, isNotNull(companies.last_ok_at)))
    .orderBy(desc(companies.open_jobs))
    .limit(1);
  if (!company) return null;
  const rows = (await db
    .select(COLS)
    .from(jobs)
    .where(and(eq(jobs.ats, company.ats), eq(jobs.company_slug, company.slug), isNull(jobs.closed_at)))
    .orderBy(desc(jobs.first_seen_at))) as unknown as JobRow[];
  return { company, jobs: rows };
}
