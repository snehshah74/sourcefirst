/**
 * Built-in scheduler for running the app on a normal server (local dev, a VPS, Docker, Railway…).
 * Crawls every 15 minutes inside the Next.js process. Disabled on Vercel, where Vercel Cron or
 * GitHub Actions call /api/cron/ingest instead. Turn off anywhere with LOCAL_CRON=0.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.VERCEL || process.env.LOCAL_CRON === "0") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const g = globalThis as unknown as { __sfCron?: NodeJS.Timeout };
  if (g.__sfCron) return; // dev HMR re-runs register(); keep a single timer

  const EVERY_MS = Number(process.env.CRAWL_INTERVAL_MINUTES ?? 15) * 60_000;
  const { runPipeline } = await import("./lib/pipeline");
  const { getDb, schema } = await import("./db");
  const { max } = await import("drizzle-orm");

  const tick = (trigger: string) => runPipeline(trigger).catch((e) => console.error("[cron] run failed:", e));

  // Catch up on boot if the last crawl is older than one interval.
  const db = await getDb();
  const [{ t }] = await db.select({ t: max(schema.runs.finished_at) }).from(schema.runs);
  const sinceLast = t ? Date.now() - new Date(t).getTime() : Infinity;
  setTimeout(() => tick(sinceLast >= EVERY_MS ? "startup" : "interval"), sinceLast >= EVERY_MS ? 3_000 : EVERY_MS - sinceLast);
  g.__sfCron = setInterval(() => tick("interval"), EVERY_MS);
  console.log(`[cron] crawling every ${EVERY_MS / 60_000} min (next run in ${Math.round(Math.max(3_000, EVERY_MS - sinceLast) / 1000)}s)`);
}
