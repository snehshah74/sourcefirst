import { desc, gt, sql } from "drizzle-orm";
import SiteHeader from "@/components/SiteHeader";
import { getDb, schema } from "@/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pipeline status · SourceFirst" };

const fmt = (d: Date | null) => (d ? d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
// Server component rendered per request, so reading the clock here is intended.
const nowMs = () => Date.now();
const ago = (d: Date | null) => {
  if (!d) return "never";
  const m = Math.round((nowMs() - d.getTime()) / 60_000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

/** Public health page for the crawl pipeline: recent runs and boards that are failing. */
export default async function Status() {
  const db = await getDb();
  const [recent, failing, [totals]] = await Promise.all([
    db.select().from(schema.runs).orderBy(desc(schema.runs.started_at)).limit(20),
    db.select().from(schema.companies).where(gt(schema.companies.consecutive_failures, 0)).orderBy(desc(schema.companies.consecutive_failures)),
    db.select({ boards: sql<number>`count(*)::int`, healthy: sql<number>`count(*) filter (where consecutive_failures = 0 and last_ok_at is not null)::int` }).from(schema.companies),
  ]);
  const last = recent.find((r) => r.finished_at);
  const stale = !last?.finished_at || nowMs() - last.finished_at.getTime() > 30 * 60_000;

  return (
    <>
      <SiteHeader />
      <main className="flex-1 pb-24 sm:pb-16">
      <div className="mx-auto max-w-4xl px-4 pt-8">
        <h1 className="text-2xl font-semibold">Pipeline status</h1>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-line bg-surface shadow-sm p-4">
            <div className={`text-lg font-semibold ${stale ? "text-rose-500" : "text-accent"}`}>{stale ? "Stale" : "Healthy"}</div>
            <div className="text-xs text-muted">Last crawl finished {ago(last?.finished_at ?? null)}</div>
          </div>
          <div className="rounded-xl border border-line bg-surface shadow-sm p-4">
            <div className="text-lg font-semibold tabular-nums">{totals.healthy} / {totals.boards}</div>
            <div className="text-xs text-muted">Company boards healthy</div>
          </div>
          <div className="rounded-xl border border-line bg-surface shadow-sm p-4">
            <div className="text-lg font-semibold tabular-nums">{recent.slice(0, 4).reduce((n, r) => n + r.new_jobs, 0)}</div>
            <div className="text-xs text-muted">New jobs in the last 4 runs</div>
          </div>
        </div>

        <h2 className="mt-10 text-lg font-semibold">Recent runs</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-surface shadow-sm">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-line">
                {["Started", "Trigger", "Duration", "Boards ok", "Failed", "New", "Closed", "Alerts"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {recent.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap px-3 py-2">{fmt(r.started_at)}</td>
                  <td className="px-3 py-2 text-muted">{r.trigger}</td>
                  <td className="px-3 py-2">{r.finished_at ? `${((r.finished_at.getTime() - r.started_at.getTime()) / 1000).toFixed(1)}s` : r.error ? "error" : "running…"}</td>
                  <td className="px-3 py-2">{r.companies_ok}</td>
                  <td className={`px-3 py-2 ${r.companies_failed ? "text-rose-500" : ""}`}>{r.companies_failed}</td>
                  <td className="px-3 py-2">{r.new_jobs}</td>
                  <td className="px-3 py-2">{r.closed_jobs}</td>
                  <td className="px-3 py-2">{r.alerts_sent}</td>
                </tr>
              ))}
              {!recent.length && <tr><td colSpan={8} className="px-3 py-6 text-center text-muted">No runs yet.</td></tr>}
            </tbody>
          </table>
        </div>

        <h2 className="mt-10 text-lg font-semibold">Failing boards</h2>
        {failing.length ? (
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface shadow-sm text-sm">
            {failing.map((c) => (
              <li key={`${c.ats}/${c.slug}`} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                <span>{c.name} <span className="font-mono text-xs text-muted">{c.ats}/{c.slug}</span></span>
                <span className="text-muted">{c.last_error} · {c.consecutive_failures}× in a row · last ok {ago(c.last_ok_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">None. Every board answered on its last crawl.</p>
        )}
      </div>
    </main>
    </>
  );
}
