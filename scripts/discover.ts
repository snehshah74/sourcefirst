// Board discovery: probe Greenhouse, Lever and Ashby for every candidate in scripts/candidates.txt
// and write the boards that exist (with open jobs) to src/lib/companies.discovered.json.
//   npm run discover
import fs from "node:fs";
import path from "node:path";

type Ats = "greenhouse" | "lever" | "ashby";
interface Found { ats: Ats; slug: string; name: string; domain?: string; jobs: number }

const root = path.resolve(import.meta.dirname, "..");
const OUT = path.join(root, "src/lib/companies.discovered.json");
const lines = fs.readFileSync(path.join(root, "scripts/candidates.txt"), "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));

const UA = "SourceFirst-JobAggregator/0.1 (board discovery)";
async function get(url: string): Promise<unknown | null> {
  try {
    const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(15_000) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

function slugVariants(name: string, domain?: string): string[] {
  const base = name.toLowerCase().replace(/&/g, "and");
  const v = new Set([
    base.replace(/[^a-z0-9]/g, ""),
    base.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    domain?.split(".")[0].toLowerCase().replace(/[^a-z0-9-]/g, "") ?? "",
  ]);
  v.delete("");
  return [...v];
}

async function probe(name: string, domain: string | undefined): Promise<Found[]> {
  const found: Found[] = [];
  for (const slug of slugVariants(name, domain)) {
    const [gh, lv, ab] = await Promise.all([
      get(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`) as Promise<{ jobs?: unknown[] } | null>,
      get(`https://api.lever.co/v0/postings/${slug}?mode=json`) as Promise<unknown[] | null>,
      get(`https://api.ashbyhq.com/posting-api/job-board/${slug}`) as Promise<{ jobs?: unknown[] } | null>,
    ]);
    if (gh?.jobs?.length) found.push({ ats: "greenhouse", slug, name, domain, jobs: gh.jobs.length });
    if (Array.isArray(lv) && lv.length) found.push({ ats: "lever", slug, name, domain, jobs: lv.length });
    if (ab?.jobs?.length) found.push({ ats: "ashby", slug, name, domain, jobs: ab.jobs.length });
    if (found.length) break; // first variant that hits wins
  }
  return found;
}

const results: Found[] = [];
const queue = [...lines];
let done = 0;
await Promise.all(
  Array.from({ length: 12 }, async () => {
    for (let line = queue.shift(); line; line = queue.shift()) {
      const [name, domain] = line.split("|").map((s) => s.trim());
      results.push(...(await probe(name, domain || undefined)));
      if (++done % 50 === 0) console.log(`  probed ${done}/${lines.length}…`);
    }
  }),
);

// Merge with what was discovered before, so removing a candidate doesn't drop a known-good board.
const prev: Found[] = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : [];
const byKey = new Map(prev.map((f) => [`${f.ats}/${f.slug}`, f]));
for (const f of results) byKey.set(`${f.ats}/${f.slug}`, f);
const all = [...byKey.values()].sort((a, b) => b.jobs - a.jobs);
fs.writeFileSync(OUT, JSON.stringify(all, null, 1) + "\n");

const missed = lines.length - new Set(results.map((r) => r.name)).size;
console.log(`\nFound ${results.length} boards (${results.reduce((n, r) => n + r.jobs, 0).toLocaleString()} open jobs) from ${lines.length} candidates; ${missed} not on Greenhouse/Lever/Ashby.`);
console.log(`By ATS: ${(["greenhouse", "lever", "ashby"] as const).map((a) => `${a} ${results.filter((r) => r.ats === a).length}`).join(", ")}`);
console.log(`Wrote ${all.length} boards to ${path.relative(root, OUT)}. The running app picks them up on its next crawl.`);
