import sanitizeHtml from "sanitize-html";
import { decodeEntities, FetchError, getJson } from "./ats";

/**
 * Full job descriptions, fetched from the ATS on demand when someone opens a job.
 * We don't store descriptions (keeps the database small enough for free tiers);
 * results are cached in memory for 30 minutes instead.
 */
const TTL = 30 * 60_000;
const MAX = 800;
const cache = new Map<string, { at: number; html: string | null }>();
const boardCache = new Map<string, { at: number; jobs: { id: string; descriptionHtml?: string }[] }>();

function remember<K, V extends { at: number }>(m: Map<K, V>, k: K, v: V) {
  if (m.size >= MAX) m.delete(m.keys().next().value as K);
  m.set(k, v);
}

const clean = (html: string) =>
  sanitizeHtml(html, {
    allowedTags: ["p", "br", "ul", "ol", "li", "strong", "b", "em", "i", "u", "a", "h1", "h2", "h3", "h4", "h5", "blockquote", "hr", "div", "span"],
    allowedAttributes: { a: ["href"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer nofollow" }),
      h1: "h3",
      h2: "h3",
    },
    exclusiveFilter: (frame) => ["p", "div", "span", "li"].includes(frame.tag) && !frame.text.trim() && !frame.mediaChildren?.length,
  }).trim();

/** Thrown when the ATS says the job (or its whole board) doesn't exist anymore. */
class JobGone extends Error {}

const notFound = (e: unknown) => e instanceof FetchError && e.status === 404;

async function fetchHtml(ats: string, slug: string, atsJobId: string): Promise<string | null> {
  try {
    if (ats === "greenhouse") {
      const j = await getJson<{ content?: string }>(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs/${encodeURIComponent(atsJobId)}`, 2);
      return j.content ? decodeEntities(j.content) : null;
    }
    if (ats === "lever") {
      const j = await getJson<{ description?: string; lists?: { text: string; content: string }[]; additional?: string }>(
        `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}/${encodeURIComponent(atsJobId)}?mode=json`,
        2,
      );
      const lists = (j.lists ?? []).map((l) => `<h3>${sanitizeHtml(l.text, { allowedTags: [] })}</h3><ul>${l.content}</ul>`).join("");
      return [j.description, lists, j.additional].filter(Boolean).join("") || null;
    }
    if (ats === "ashby") {
      // Ashby only serves whole boards. A job missing from a cached copy may just be newer than the cache,
      // so re-fetch once before concluding it's gone.
      for (const forceFresh of [false, true]) {
        let board = boardCache.get(slug);
        const fetchNow = forceFresh || !board || Date.now() - board.at > TTL;
        if (fetchNow) {
          const d = await getJson<{ jobs: { id: string; descriptionHtml?: string }[] }>(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`, 2);
          board = { at: Date.now(), jobs: d.jobs ?? [] };
          remember(boardCache, slug, board);
        }
        const job = board!.jobs.find((j) => j.id === atsJobId);
        if (job) return job.descriptionHtml ?? null;
        if (fetchNow) throw new JobGone(); // not in a just-fetched board: really gone
      }
    }
    return null;
  } catch (e) {
    if (notFound(e)) throw new JobGone();
    throw e;
  }
}

/**
 * The job's sanitized description, fetched from the ATS.
 * `gone: true` means the company has taken the posting down; `html: null` alone means it just has no text.
 */
export async function getDescription(ats: string, slug: string, atsJobId: string): Promise<{ html: string | null; gone: boolean }> {
  const key = `${ats}:${slug}:${atsJobId}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return { html: hit.html, gone: false };
  try {
    const raw = await fetchHtml(ats, slug, atsJobId);
    const html = raw ? clean(raw) : null;
    remember(cache, key, { at: Date.now(), html });
    return { html, gone: false };
  } catch (e) {
    if (e instanceof JobGone) return { html: null, gone: true };
    return { html: null, gone: false }; // network trouble: don't cache, don't judge
  }
}
