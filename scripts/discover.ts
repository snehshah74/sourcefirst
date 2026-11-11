// Board discovery. Finds live job boards and adds them to src/lib/companies.discovered.json.
//   npm run discover
// Two inputs:
//   scripts/candidates.txt  "Name|domain"      → tries the name on every ATS that uses simple ids
//   scripts/boards.txt      "Name|domain|URL"  → a careers-page URL on any supported ATS (needed for
//                                                Workday and Oracle, whose ids can't be guessed from a name)
// Every board is checked through the same fetchers the crawler uses; only boards with open jobs are kept.
import fs from "node:fs";
import path from "node:path";
import { fetchCompanyJobs } from "../src/lib/ats";
import type { Company } from "../src/lib/companies";
import type { Ats } from "../src/lib/types";

type Found = Company & { jobs: number };

const root = path.resolve(import.meta.dirname, "..");
const OUT = path.join(root, "src/lib/companies.discovered.json");
const read = (f: string) =>
  fs.existsSync(path.join(root, f))
    ? fs.readFileSync(path.join(root, f), "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
    : [];

/** Board identity from a careers URL, for every supported ATS. */
function parseBoardUrl(raw: string): Pick<Company, "ats" | "slug" | "board"> | null {
  let u: URL;
  try {
    u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const seg = u.pathname.split("/").filter(Boolean);
  const wd = host.match(/^([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com$/);
  if (wd) {
    const site = seg[0] && /^[a-z]{2}-[A-Z]{2}$/.test(seg[0]) ? seg[1] : seg[0]; // optional locale, e.g. /en-US/
    return site ? { ats: "workday", slug: wd[1], board: { host, site } } : null;
  }
  if (host.endsWith(".oraclecloud.com")) {
    const i = seg.indexOf("sites");
    return i >= 0 && seg[i + 1] ? { ats: "oracle", slug: host.split(".")[0], board: { host, site: seg[i + 1] } } : null;
  }
  const first = seg[0];
  if (/(^|\.)greenhouse\.io$/.test(host) && first) return { ats: "greenhouse", slug: first };
  if (host === "jobs.lever.co" && first) return { ats: "lever", slug: first };
  if (host === "jobs.ashbyhq.com" && first) return { ats: "ashby", slug: first };
  if (/^(careers|jobs)\.smartrecruiters\.com$/.test(host) && first) return { ats: "smartrecruiters", slug: first };
  if (host === "apply.workable.com" && first && first !== "j") return { ats: "workable", slug: first };
  if (host === "ats.rippling.com" && first) return { ats: "rippling", slug: first };
  const rc = host.match(/^([a-z0-9-]+)\.recruitee\.com$/);
  if (rc) return { ats: "recruitee", slug: rc[1] };
  return null;
}

/** Ids worth trying for a company name on ATSs with simple ids. */
function slugVariants(name: string, domain?: string): string[] {
  const base = name.toLowerCase().replace(/&/g, "and");
  const v = new Set([
    base.replace(/[^a-z0-9]/g, ""),
    base.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    domain?.split(".")[0].toLowerCase().replace(/[^a-z0-9-]/g, "") ?? "",
    name.replace(/[^A-Za-z0-9]/g, ""), // SmartRecruiters ids are often CamelCase ("ServiceNow")
  ]);
  v.delete("");
  return [...v];
}

const slugify = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const pretty = (slug: string) =>
  slug.replace(/[-_](careers?|jobs?|careers-page|opportunities)$/i, "").split(/[-_]/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

/** The company's own name, from boards that report it; otherwise a tidy version of the board id. */
async function boardName(c: Pick<Company, "ats" | "slug">): Promise<string> {
  const json = async <T>(url: string) => (await fetch(url, { signal: AbortSignal.timeout(15_000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null)) as T | null;
  if (c.ats === "smartrecruiters") {
    const d = await json<{ content?: { company?: { name?: string } }[] }>(`https://api.smartrecruiters.com/v1/companies/${c.slug}/postings?limit=1`);
    if (d?.content?.[0]?.company?.name) return d.content[0].company.name;
  }
  if (c.ats === "workable") {
    const d = await json<{ name?: string }>(`https://apply.workable.com/api/v1/widget/accounts/${c.slug}`);
    if (d?.name) return d.name;
  }
  return pretty(c.slug);
}

/** A board counts if it currently lists at least one job (one page is enough to know). */
async function check(c: Company): Promise<Found | null> {
  try {
    const r = await fetchCompanyJobs(c, { limit: 1 });
    return r.jobs.length ? { ...c, jobs: Math.max(r.total, r.jobs.length) } : null;
  } catch {
    return null;
  }
}

const NAME_ATS: Ats[] = ["greenhouse", "lever", "ashby", "smartrecruiters", "workable", "rippling", "recruitee"];

async function fromName(name: string, domain?: string): Promise<Found[]> {
  const found: Found[] = [];
  for (const slug of slugVariants(name, domain)) {
    const hits = await Promise.all(NAME_ATS.filter((a) => !found.some((f) => f.ats === a)).map((ats) => check({ ats, slug, name, domain })));
    found.push(...hits.filter((h): h is Found => !!h));
  }
  return found;
}

async function runPool<T>(items: T[], size: number, fn: (t: T) => Promise<void>) {
  const queue = [...items];
  let done = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      for (let it = queue.shift(); it !== undefined; it = queue.shift()) {
        await fn(it);
        if (++done % 50 === 0) console.log(`  checked ${done}/${items.length}…`);
      }
    }),
  );
}

const results: Found[] = [];
const bad: string[] = [];

const urls = read("scripts/boards.txt");
await runPool(urls, 10, async (line) => {
  const [givenName, domain, url] = line.split("|").map((s) => s.trim());
  const id = parseBoardUrl(url ?? "");
  if (id && id.ats === "oracle" && givenName) id.slug = slugify(givenName); // host codes like "eofd" aren't readable
  const name = id ? givenName || (await boardName(id)) : givenName;
  const hit = id ? await check({ ...id, name, domain: domain || undefined }) : null;
  if (hit) results.push(hit);
  else bad.push(`${name} (${url})`);
});

const names = read("scripts/candidates.txt");
await runPool(names, 10, async (line) => {
  const [name, domain] = line.split("|").map((s) => s.trim());
  results.push(...(await fromName(name, domain || undefined)));
});

// Merge with earlier results, so removing an input line doesn't drop a known-good board.
const prev: Found[] = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : [];
const byKey = new Map(prev.map((f) => [`${f.ats}/${f.slug}`, f]));
for (const f of results) byKey.set(`${f.ats}/${f.slug}`, f);
const all = [...byKey.values()].sort((a, b) => b.jobs - a.jobs);
fs.writeFileSync(OUT, JSON.stringify(all, null, 1) + "\n");

const by = (list: Found[]) =>
  Object.entries(list.reduce<Record<string, number>>((m, f) => ((m[f.ats] = (m[f.ats] ?? 0) + 1), m), {}))
    .map(([a, n]) => `${a} ${n}`)
    .join(", ");
console.log(`\nFound ${results.length} live boards (${results.reduce((n, r) => n + r.jobs, 0).toLocaleString()} open jobs): ${by(results)}`);
if (bad.length) console.log(`Not live or not recognised (${bad.length}): ${bad.slice(0, 15).join("; ")}${bad.length > 15 ? " …" : ""}`);
console.log(`Wrote ${all.length} boards to ${path.relative(root, OUT)}.`);
