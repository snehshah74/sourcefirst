import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { ArrowRight, Info } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SavedSearches from "@/components/SavedSearches";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { buttonClass } from "@/components/ui/Button";
import { currentUser } from "@/lib/auth";
import { emailEnabled } from "@/lib/email";
import { getDb, schema } from "@/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Alerts & account · SourceFirst" };

const COLORS: Record<string, string> = { Saved: "bg-subtle", Applied: "bg-info", Interviewing: "bg-warn", Offer: "bg-accent", Rejected: "bg-danger" };

export default async function Account() {
  const user = await currentUser();
  if (!user) redirect("/sign-in?next=/account");

  const db = await getDb();
  const [searches, saved] = await Promise.all([
    db.select().from(schema.savedSearches).where(eq(schema.savedSearches.userId, user.id)).orderBy(desc(schema.savedSearches.createdAt)),
    db.select({ status: schema.savedJobs.status }).from(schema.savedJobs).where(eq(schema.savedJobs.userId, user.id)),
  ]);
  const byStatus = saved.reduce<Record<string, number>>((m, r) => ((m[r.status] = (m[r.status] ?? 0) + 1), m), {});

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-8 sm:px-6 sm:pb-16">
        <h1 className="text-2xl font-semibold tracking-tight">Alerts & account</h1>
        <p className="mt-1 text-sm text-muted">Signed in as {user.email}</p>

        <section className="mt-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Job alerts</h2>
              <p className="mt-0.5 text-sm text-muted">Instant alerts arrive within minutes of a new match; daily digests bundle everything once a day.</p>
            </div>
            <Link href="/" className={buttonClass("secondary", "sm", "shrink-0")}>New alert</Link>
          </div>
          {!emailEnabled() && (
            <p className="mt-3 flex gap-2 rounded-xl bg-warn-soft px-3.5 py-2.5 text-[13px] text-warn">
              <Info size={15} className="mt-0.5 shrink-0" />
              Email isn&apos;t configured on this server yet, so alerts are written to the server log instead of sent.
            </p>
          )}
          <SavedSearches initial={searches.map((s) => ({ id: s.id, name: s.name, query: s.query, alertsEnabled: s.alertsEnabled, frequency: s.frequency }))} />
        </section>

        <section className="mt-10">
          <div className="flex items-end justify-between">
            <h2 className="text-lg font-semibold">Applications</h2>
            <Link href="/tracker" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-accent">Open tracker <ArrowRight size={14} /></Link>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {["Saved", "Applied", "Interviewing", "Offer", "Rejected"].map((s) => (
              <Link key={s} href="/tracker" className="rounded-xl border border-line bg-surface p-3.5 shadow-sm transition-colors hover:border-line-strong">
                <div className="text-2xl font-semibold tabular-nums tracking-tight">{byStatus[s] ?? 0}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted"><span className={`h-1.5 w-1.5 rounded-full ${COLORS[s]}`} />{s}</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">Preferences</h2>
          <div className="mt-3 flex items-center justify-between rounded-xl border border-line bg-surface p-4 shadow-sm">
            <div>
              <div className="text-sm font-medium">Appearance</div>
              <div className="text-xs text-muted">Light, dark, or match your device</div>
            </div>
            <ThemeToggle />
          </div>
        </section>
      </main>
    </>
  );
}
