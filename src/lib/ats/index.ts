import type { Company } from "../companies";
import type { RawJob } from "../types";

const UA = "SourceFirst-JobAggregator/0.1 (+https://github.com/)";

export class FetchError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const retryable = (status?: number) => !status || status === 429 || status >= 500;

/** GET JSON with a timeout and retries on network errors, 429 and 5xx. Other 4xx (e.g. 404) fail at once. */
export async function getJson<T>(url: string, attempts = 3): Promise<T> {
  let last = new FetchError("no attempt");
  for (let i = 0; i < attempts; i++) {
    if (i) await sleep(1000 * 3 ** (i - 1) + Math.random() * 500);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    try {
      const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: ctrl.signal, cache: "no-store" });
      if (res.ok) return (await res.json()) as T;
      last = new FetchError(`HTTP ${res.status}`, res.status);
    } catch (e) {
      last = new FetchError((e as Error).name === "AbortError" ? "timeout" : (e as Error).message);
    } finally {
      clearTimeout(timer);
    }
    if (!retryable(last.status)) break;
  }
  throw last;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };

export function decodeEntities(s: string): string {
  return s.replace(/&(#\d+|#x[0-9a-f]+|[a-z0-9]+);/gi, (m, e: string) => {
    if (ENTITIES[e]) return ENTITIES[e];
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return m;
  });
}

export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  // Greenhouse double-encodes its HTML, so decode before stripping tags.
  const decoded = decodeEntities(html);
  return decodeEntities(decoded.replace(/<(br|\/p|\/li|\/h\d)[^>]*>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

// ---------- Greenhouse ----------
interface GhJob {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string };
  departments?: { name: string }[];
  first_published?: string;
  updated_at?: string;
  content?: string;
  company_name?: string;
}

async function greenhouse(c: Company): Promise<RawJob[]> {
  const data = await getJson<{ jobs: GhJob[] }>(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(c.slug)}/jobs?content=true`);
  if (!Array.isArray(data?.jobs)) throw new FetchError("unexpected response shape");
  return data.jobs.map((j) => ({
    ats: "greenhouse",
    atsJobId: String(j.id),
    companySlug: c.slug,
    companyName: c.name,
    title: j.title.trim(),
    location: j.location?.name?.trim() || "Unspecified",
    department: j.departments?.[0]?.name ?? null,
    employmentType: null,
    isRemote: null,
    url: j.absolute_url,
    applyUrl: j.absolute_url,
    publishedAt: j.first_published ?? j.updated_at ?? null,
    descriptionText: htmlToText(j.content).slice(0, 20_000),
    salary: null,
  }));
}

// ---------- Lever ----------
interface LeverJob {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl?: string;
  createdAt?: number;
  workplaceType?: string;
  categories?: { location?: string; team?: string; department?: string; commitment?: string; allLocations?: string[] };
  descriptionPlain?: string;
  additionalPlain?: string;
  lists?: { text: string; content: string }[];
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
}

async function lever(c: Company): Promise<RawJob[]> {
  const data = await getJson<LeverJob[]>(`https://api.lever.co/v0/postings/${encodeURIComponent(c.slug)}?mode=json`);
  if (!Array.isArray(data)) throw new FetchError("unexpected response shape");
  return data.map((j) => {
    const lists = (j.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content)}`).join("\n");
    const sr = j.salaryRange;
    return {
      ats: "lever" as const,
      atsJobId: j.id,
      companySlug: c.slug,
      companyName: c.name,
      title: j.text.trim(),
      location: j.categories?.allLocations?.join("; ") || j.categories?.location || "Unspecified",
      department: j.categories?.department ?? j.categories?.team ?? null,
      employmentType: j.categories?.commitment ?? null,
      isRemote: j.workplaceType ? j.workplaceType === "remote" : null,
      url: j.hostedUrl,
      applyUrl: j.applyUrl ?? null,
      publishedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
      descriptionText: [j.descriptionPlain, lists, j.additionalPlain].filter(Boolean).join("\n").slice(0, 20_000),
      salary: sr?.min ? `${sr.currency ?? "USD"} ${sr.min.toLocaleString()}–${(sr.max ?? sr.min).toLocaleString()}${sr.interval ? ` ${sr.interval}` : ""}` : null,
    };
  });
}

// ---------- Ashby ----------
interface AshbyJob {
  id: string;
  title: string;
  department?: string;
  team?: string;
  employmentType?: string;
  location?: string;
  secondaryLocations?: { location: string }[];
  isRemote?: boolean;
  workplaceType?: string;
  isListed?: boolean;
  publishedAt?: string;
  jobUrl: string;
  applyUrl?: string;
  descriptionPlain?: string;
  compensation?: { compensationTierSummary?: string; scrapeableCompensationSalarySummary?: string };
}

async function ashby(c: Company): Promise<RawJob[]> {
  const data = await getJson<{ jobs: AshbyJob[] }>(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(c.slug)}?includeCompensation=true`);
  if (!Array.isArray(data?.jobs)) throw new FetchError("unexpected response shape");
  return data.jobs
    .filter((j) => j.isListed !== false)
    .map((j) => ({
      ats: "ashby" as const,
      atsJobId: j.id,
      companySlug: c.slug,
      companyName: c.name,
      title: j.title.trim(),
      location: [j.location, ...(j.secondaryLocations ?? []).map((s) => s.location)].filter(Boolean).join("; ") || "Unspecified",
      department: j.department ?? j.team ?? null,
      employmentType: j.employmentType ?? null,
      isRemote: j.isRemote ?? (j.workplaceType ? j.workplaceType === "Remote" : null),
      url: j.jobUrl,
      applyUrl: j.applyUrl ?? null,
      publishedAt: j.publishedAt ?? null,
      descriptionText: (j.descriptionPlain ?? "").slice(0, 20_000),
      salary: j.compensation?.scrapeableCompensationSalarySummary ?? j.compensation?.compensationTierSummary ?? null,
    }));
}

export const FETCHERS = { greenhouse, lever, ashby } as const;

/** Returns the board's open jobs, or throws FetchError. */
export function fetchCompanyJobs(c: Company): Promise<RawJob[]> {
  return FETCHERS[c.ats](c);
}
