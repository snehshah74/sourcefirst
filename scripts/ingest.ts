// Trigger one crawl.
//   - If the app is running (default http://localhost:3000), asks it to crawl via /api/cron/ingest.
//     (Required with the embedded local database, which only one process can open at a time.)
//   - With --direct (and DATABASE_URL pointing at a real Postgres), crawls in this process.
const direct = process.argv.includes("--direct");

if (direct) {
  if (!process.env.DATABASE_URL) console.warn("DATABASE_URL not set: crawling into the local embedded database (./data/pg).");
  const { runPipeline } = await import("../src/lib/pipeline");
  try {
    const r = await runPipeline(process.env.GITHUB_ACTIONS ? "github-actions" : "cli");
    if (r.skipped) console.log(`skipped: ${r.skipped}`);
    // Fail the job (so GitHub emails you) only if most boards failed; a few flaky boards are normal.
    process.exit(r.runId && r.companiesOk < r.companiesFailed.length ? 1 : 0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
} else {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/cron/ingest?trigger=cli`, {
    headers: process.env.CRON_SECRET ? { authorization: `Bearer ${process.env.CRON_SECRET}` } : {},
  }).catch(() => null);
  if (!res) {
    console.error(`Couldn't reach ${base}. Start the app first (npm run dev), or set APP_URL.`);
    process.exit(1);
  }
  console.log(res.status, JSON.stringify(await res.json(), null, 2));
}

export {};
