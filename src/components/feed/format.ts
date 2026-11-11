/** Display helpers for job data. Raw ATS strings are messy; these make them scannable. */

export function ago(iso: string | Date | null | undefined, now: number, long = false): string {
  if (!iso || !now) return "";
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  const [n, u] =
    s < 60 ? [0, "now"] : s < 3600 ? [Math.floor(s / 60), "m"] : s < 86400 ? [Math.floor(s / 3600), "h"] : s < 86400 * 30 ? [Math.floor(s / 86400), "d"] : [Math.floor(s / (86400 * 30)), "mo"];
  if (u === "now") return "just now";
  if (!long) return `${n}${u}`;
  const word = { m: "minute", h: "hour", d: "day", mo: "month" }[u as "m" | "h" | "d" | "mo"];
  return `${n} ${word}${n === 1 ? "" : "s"} ago`;
}

export const isFresh = (iso: string | Date, now: number, hours = 3) => now > 0 && now - new Date(iso).getTime() < hours * 3600_000;

/** "San Francisco, CA | New York City, NY | Seattle, WA" → { first: "San Francisco, CA", extra: 2 } */
export function splitLocations(loc: string): { first: string; extra: number; all: string[] } {
  const all = loc
    .split(/\s*(?:;|\||•|\/\s(?=[A-Z])|\bor\b)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return { first: all[0] ?? loc, extra: Math.max(0, all.length - 1), all: all.length ? all : [loc] };
}

const SYMBOL: Record<string, string> = { USD: "$", CAD: "CA$", EUR: "€", GBP: "£", AUD: "A$", INR: "₹", SGD: "S$" };

/** "USD 177,000–266,000 per-year-salary" → "$177k–266k"; "$45 – $60 per hour" → "$45–60/hr" */
export function formatSalary(raw: string | null): string | null {
  if (!raw) return null;
  const cur = raw.match(/\b(USD|CAD|EUR|GBP|AUD|INR|SGD)\b/)?.[1];
  const sym = cur ? SYMBOL[cur] : raw.match(/[$€£₹]/)?.[0] ?? "$";
  const nums = [...raw.replace(/,/g, "").matchAll(/(\d+(?:\.\d+)?)\s*([kKmM])?/g)]
    .map((m) => parseFloat(m[1]) * (m[2]?.toLowerCase() === "k" ? 1e3 : m[2]?.toLowerCase() === "m" ? 1e6 : 1))
    .filter((n) => n > 0);
  if (!nums.length) return null;
  const lo = Math.min(...nums.slice(0, 2));
  const hi = Math.max(...nums.slice(0, 2));
  const hourly = /hour|hr\b/i.test(raw) || hi < 1000;
  const fmt = (n: number) => (hourly ? `${Math.round(n)}` : n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M` : `${Math.round(n / 1e3)}k`);
  const range = lo === hi ? fmt(lo) : `${fmt(lo)}–${fmt(hi)}`;
  return `${sym}${range}${hourly ? "/hr" : ""}`;
}

export const VISA_LABEL: Record<string, string> = { Yes: "Sponsors visa", No: "No sponsorship", Maybe: "Not stated" };

export const ATS_LABEL: Record<string, string> = { greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby" };
