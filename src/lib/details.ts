import sanitizeHtml from "sanitize-html";
import type { Company } from "./companies";
import { decodeEntities, fetchJobDetail, isGone, type JobDetail } from "./ats";

/**
 * Full job descriptions, fetched from the ATS when someone opens a job (and by the crawler for ATSs
 * whose lists leave them out). Descriptions aren't stored, which keeps the database small enough for
 * free tiers; results are cached in memory for 30 minutes instead.
 */
const TTL = 30 * 60_000;
const MAX = 800;
const cache = new Map<string, { at: number; detail: JobDetail }>();

const clean = (html: string) =>
  sanitizeHtml(decodeEntities(html), {
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

/**
 * One job's sanitized description plus extra fields from the ATS.
 * `gone: true` means the company has taken the posting down; a network failure is neither cached nor judged.
 */
export async function getDescription(c: Company, atsJobId: string): Promise<{ detail: JobDetail | null; gone: boolean }> {
  const key = `${c.ats}:${c.slug}:${atsJobId}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return { detail: hit.detail, gone: false };
  try {
    const raw = await fetchJobDetail(c, atsJobId);
    const detail = { ...raw, html: raw.html ? clean(raw.html) || null : null };
    if (cache.size >= MAX) cache.delete(cache.keys().next().value as string);
    cache.set(key, { at: Date.now(), detail });
    return { detail, gone: false };
  } catch (e) {
    return { detail: null, gone: isGone(e) };
  }
}
