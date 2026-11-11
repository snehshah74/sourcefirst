import { and, eq, isNotNull, lt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { runIngest } from "./ingest";
import { sendAlerts } from "./alerts";

const DAY = 86_400_000;

/**
 * Keeps the database inside free-tier limits (Supabase free = 500 MB):
 * closed jobs are dropped after RETAIN_CLOSED_DAYS (users' tracker keeps its own snapshot),
 * run history after 30 days.
 */
async function prune() {
  const db = await getDb();
  const keepClosed = Number(process.env.RETAIN_CLOSED_DAYS ?? 14);
  const closed = await db
    .delete(schema.jobs)
    .where(and(isNotNull(schema.jobs.closed_at), lt(schema.jobs.closed_at, new Date(Date.now() - keepClosed * DAY))))
    .returning({ id: schema.jobs.id });
  await db.delete(schema.runs).where(lt(schema.runs.started_at, new Date(Date.now() - 30 * DAY)));
  return closed.length;
}

/** Optional dead-man's switch: Healthchecks.io (free) emails you if pings stop arriving. */
async function ping(ok: boolean) {
  const url = process.env.HEALTHCHECK_URL;
  if (!url) return;
  await fetch(ok ? url : `${url.replace(/\/$/, "")}/fail`, { method: "POST", signal: AbortSignal.timeout(10_000) }).catch(() => {});
}

/** One full pipeline tick: crawl every board, email alerts, tidy up, report health. */
export async function runPipeline(trigger: string) {
  let result;
  try {
    result = await runIngest({ trigger });
  } catch (e) {
    await ping(false);
    throw e;
  }
  if (!result.runId) return { ...result, alertsSent: 0, pruned: 0 };

  let alertsSent = 0;
  try {
    alertsSent = await sendAlerts();
  } catch (e) {
    console.error("[pipeline] alerts failed:", (e as Error).message);
  }
  const pruned = await prune().catch((e) => (console.error("[pipeline] prune failed:", (e as Error).message), 0));

  const db = await getDb();
  await db.update(schema.runs).set({ alerts_sent: alertsSent }).where(eq(schema.runs.id, result.runId));
  // Most boards failing at once means something is wrong on our side (network, IP blocked…).
  await ping(result.companiesOk > result.companiesFailed.length);

  console.log(
    `[pipeline] ${trigger}: ok=${result.companiesOk} failed=${result.companiesFailed.length} new=${result.newJobs} closed=${result.closedJobs} alerts=${alertsSent} pruned=${pruned} in ${(result.ms / 1000).toFixed(1)}s`,
  );
  if (result.companiesFailed.length) console.log(`[pipeline] failed boards: ${result.companiesFailed.join(", ")}`);
  return { ...result, alertsSent, pruned };
}
