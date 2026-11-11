import Link from "next/link";
import Feed from "@/components/feed/Feed";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { currentUser } from "@/lib/auth";
import { latestJobs, stats, topCompanies } from "@/lib/query";
import { CountUp, JustFound, NextCheck } from "@/components/LiveHero";

export const dynamic = "force-dynamic";

const STEPS = [
  ["We read the career pages", "Every 15 minutes we check the job boards of each company directly: Workday, Greenhouse, Lever, Ashby and five more."],
  ["New roles land here first", "No reposts and no middlemen. Every job links to the company's own application page."],
  ["You hear about it right away", "Save a search and we email you when a matching role appears, or once a day if you prefer."],
];

export default async function Home() {
  const [s, companies, latest, user] = await Promise.all([stats(), topCompanies(12), latestJobs(5), currentUser()]);

  const hero = user ? (
    <div className="mb-8">
      <h1 className="font-display text-[28px] font-medium tracking-tight sm:text-[32px]">New jobs</h1>
      <p className="mt-1 text-ink-muted">
        <span className="tabular-nums text-ink-fg">{s.jobsLastHour.toLocaleString()}</span> found in the last hour,{" "}
        <span className="tabular-nums text-ink-fg">{s.jobsToday.toLocaleString()}</span> today
      </p>
      <NextCheck lastRun={s.lastRun ? new Date(s.lastRun).toISOString() : null} />
    </div>
  ) : (
    <div className="mb-8 grid items-center gap-10 lg:mb-10 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-16">
      <div>
        <h1 className="font-display text-[36px] font-medium leading-[1.06] tracking-[-0.03em] text-balance sm:text-[56px]">
          <CountUp value={s.openJobs} /> open jobs, straight from <CountUp value={s.companies} /> career pages
        </h1>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink-muted sm:mt-5 sm:text-lg">
          Roles show up here minutes after a company posts them, often hours before LinkedIn or Indeed. Be the 1st applicant, not the 500th.
        </p>
        <NextCheck lastRun={s.lastRun ? new Date(s.lastRun).toISOString() : null} />
      </div>

      {latest.length > 0 && (
        <section aria-label="Just found" className="hidden rounded-2xl bg-ink-2 p-2 ring-1 ring-ink-line md:block">
          <div className="flex items-center justify-between px-3 pb-2 pt-2">
            <h2 className="text-sm font-medium">Just found</h2>
            <p className="font-mono text-xs text-ink-muted">live</p>
          </div>
          <JustFound initial={latest} />
        </section>
      )}
    </div>
  );

  return (
    <>
      <SiteHeader />
      <main className="flex-1 pb-20 md:pb-0">
        <Feed signedIn={!!user} hero={hero} />

        {!user && (
          <section className="mx-auto max-w-[1320px] px-4 pb-12 pt-4 sm:px-6">
            <div className="grid gap-10 rounded-3xl bg-ink p-6 text-ink-fg ring-1 ring-ink-line sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-16">
              <div className="flex flex-col">
                <h2 className="max-w-sm font-display text-[32px] font-medium leading-tight tracking-tight sm:text-[40px]">How you get there first</h2>
                <div className="mt-8 flex flex-col items-start gap-6 lg:mt-auto">
                  <Link href="/sign-up" className="inline-flex h-12 items-center rounded-xl bg-ink-fg px-6 font-medium text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] transition-colors hover:opacity-90">
                    Create a free account
                  </Link>
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {companies.filter((c) => c.domain).slice(0, 6).map((c) => (
                        <Link key={`${c.ats}/${c.slug}`} href={`/companies/${c.slug}`} title={c.name} className="rounded-full ring-2 ring-ink">
                          <CompanyLogo name={c.name} domain={c.domain} size={32} className="!rounded-full !border-0" />
                        </Link>
                      ))}
                    </div>
                    <Link href="/companies" className="text-sm text-ink-muted transition-colors hover:text-ink-fg">
                      and {Math.max(0, s.companies - 6).toLocaleString()} more companies
                    </Link>
                  </div>
                </div>
              </div>
              <ol className="divide-y divide-ink-line">
                {STEPS.map(([title, body], i) => (
                  <li key={title} className="grid grid-cols-[40px_minmax(0,1fr)] gap-4 py-6 first:pt-0 last:pb-0">
                    <span className="pt-1 font-mono text-sm text-ink-muted">0{i + 1}</span>
                    <div>
                      <h3 className="font-display text-[20px] font-medium tracking-tight">{title}</h3>
                      <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
