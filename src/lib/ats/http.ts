const UA = "SourceFirst-JobAggregator/0.1 (+https://github.com/snehshah74/sourcefirst)";

export class FetchError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

/** The ATS says this job or board doesn't exist (anymore). */
export const gone = () => new FetchError("not found", 404);
export const isGone = (e: unknown) => e instanceof FetchError && e.status === 404;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const retryable = (status?: number) => !status || status === 429 || status >= 500;

/** JSON request with a timeout and retries on network errors, 429 and 5xx. Other 4xx (e.g. 404) fail at once. */
export async function getJson<T>(url: string, attempts = 3, init?: { method?: "POST"; body?: unknown }): Promise<T> {
  let last = new FetchError("no attempt");
  for (let i = 0; i < attempts; i++) {
    if (i) await sleep(1000 * 3 ** (i - 1) + Math.random() * 500);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
    try {
      const res = await fetch(url, {
        method: init?.method ?? "GET",
        headers: { "user-agent": UA, accept: "application/json", ...(init?.body ? { "content-type": "application/json" } : {}) },
        body: init?.body ? JSON.stringify(init.body) : undefined,
        signal: ctrl.signal,
        cache: "no-store",
      });
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
  // Some ATSs double-encode their HTML, so decode before stripping tags.
  const decoded = decodeEntities(html);
  return decodeEntities(decoded.replace(/<(br|\/p|\/li|\/h\d)[^>]*>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim()
    .slice(0, 20_000);
}

/**
 * Reads a newest-first paginated list. With `known` ids and not `full`, stops at the first page where
 * every job is already known (new jobs are always on the first pages); that partial read is `complete: false`.
 */
export async function paginate<T>(
  fetchPage: (offset: number) => Promise<{ items: T[]; total: number }>,
  idOf: (t: T) => string,
  opts: { known?: Set<string>; full?: boolean; limit?: number },
  cap = 2000,
): Promise<{ items: T[]; complete: boolean; total: number }> {
  const max = Math.min(cap, opts.limit ?? cap);
  const items: T[] = [];
  let total = Infinity;
  while (items.length < Math.min(total, max)) {
    const page = await fetchPage(items.length);
    // Some ATSs (Workday) report the total only on the first page and 0 afterwards: never let that shrink it.
    if (page.total > 0) total = page.total;
    if (!page.items.length) break;
    items.push(...page.items);
    if (!opts.full && opts.known?.size && page.items.every((t) => opts.known!.has(idOf(t)))) return { items, complete: false, total };
  }
  // Hitting the cap means there may be more than we (or the ATS) can list: treat it as a partial read.
  return { items, complete: items.length >= total && total < cap, total: Number.isFinite(total) ? total : items.length };
}

/** Whole-board responses (Ashby, Workable, Recruitee) cached briefly, so opening several jobs costs one request. */
const boards = new Map<string, { at: number; data: unknown }>();
const BOARD_TTL = 30 * 60_000;

export async function cachedBoard<T>(key: string, load: () => Promise<T>, fresh = false): Promise<{ data: T; fetchedNow: boolean }> {
  const hit = boards.get(key);
  if (!fresh && hit && Date.now() - hit.at < BOARD_TTL) return { data: hit.data as T, fetchedNow: false };
  const data = await load();
  if (boards.size > 300) boards.delete(boards.keys().next().value as string);
  boards.set(key, { at: Date.now(), data });
  return { data, fetchedNow: true };
}

/** Find one job in a cached whole board; re-fetch once before declaring it gone (it may be newer than the cache). */
export async function findInBoard<B, J>(key: string, load: () => Promise<B>, pick: (b: B) => J | undefined): Promise<J> {
  for (const fresh of [false, true]) {
    const { data, fetchedNow } = await cachedBoard(key, load, fresh);
    const job = pick(data);
    if (job) return job;
    if (fetchedNow) throw gone();
  }
  throw gone();
}
