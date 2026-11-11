import Link from "next/link";
import { BellRing, Radar, Zap } from "lucide-react";
import Feed from "@/components/feed/Feed";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { currentUser } from "@/lib/auth";
import { stats, topCompanies } from "@/lib/query";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [s, companies, user] = await Promise.all([stats(), topCompanies(12), currentUser()]);

  const hero = user ? (
    <div className="mb-6">
      <h1 className="font-display text-[28px] font-semibold tracking-tight sm:text-[34px]">
        Welcome back, {user.name.split(" ")[0] || "there"}
      </h1>
      <p className="mt-1 text-ink-muted">
        <span className="font-semibold text-lime">{s.jobsLastHour.toLocaleString()}</span> new roles found in the last hour.
      </p>
    </div>
  ) : (
    <div className="mb-6 grid gap-6 sm:mb-8 sm:gap-8 lg:mb-10 lg:grid-cols-[1fr_auto] lg:items-end">
      <div className="max-w-3xl">
        <p className="inline-flex items-center gap-2 rounded-full bg-ink-2 px-3.5 py-1.5 text-[13px] text-ink-muted ring-1 ring-ink-line">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-lime" />
          Live · {s.companies.toLocaleString()} companies<span className="hidden sm:inline">&apos; career pages</span>, checked every 15 min
        </p>
        <h1 className="mt-4 font-display text-[36px] font-semibold leading-[1.03] tracking-[-0.025em] text-balance sm:mt-5 sm:text-[66px]">
          Every job, <span className="text-lime">straight from the source.</span>
        </h1>
        <p className="mt-5 hidden max-w-xl text-lg leading-relaxed text-ink-muted sm:block">
          Roles show up here minutes after a company posts them, often hours before LinkedIn or Indeed. Apply while the pile is still small.
        </p>
      </div>
      <dl className="flex gap-8 lg:flex-col lg:gap-4 lg:text-right">
        {[
          [s.openJobs, "open roles"],
          [s.jobsToday, "found today"],
          [s.companies, "companies"],
        ].map(([v, k]) => (
          <div key={k as string} className="flex flex-col-reverse">
            <dt className="text-[13px] text-ink-muted">{k as string}</dt>
            <dd className="font-display text-[24px] font-semibold tabular-nums tracking-tight sm:text-[34px]">{(v as number).toLocaleString()}</dd>
          </div>
        ))}
      </dl>
    </div>
  );

  return (
    <>
      <SiteHeader />
      <main className="flex-1 pb-20 sm:pb-0">
        <Feed signedIn={!!user} hero={hero} />

        {!user && (
          <section className="mx-auto max-w-[1320px] px-4 pb-16 pt-4 sm:px-6">
            <div className="rounded-[32px] bg-ink p-6 text-ink-fg sm:p-10">
              <h2 className="max-w-xl font-display text-[30px] font-semibold leading-tight tracking-tight sm:text-[40px]">How you get there first</h2>
              <ol className="mt-8 grid gap-4 md:grid-cols-3">
                {[
                  [Radar, "We watch the source", `Every 15 minutes we read the careers pages of ${s.companies.toLocaleString()} companies directly: Workday, Greenhouse, Lever, Ashby and more.`],
                  [Zap, "New roles land here first", "No reposting, no middlemen. Each job links straight to the company's own application page."],
                  [BellRing, "You hear about it right away", "Save a search and we email you the moment a matching role appears, or once a day if you prefer."],
                ].map(([Icon, title, body], i) => {
                  const I = Icon as typeof Radar;
                  return (
                    <li key={i} className="rounded-3xl bg-ink-2 p-6 ring-1 ring-ink-line">
                      <div className="flex items-center justify-between">
                        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-lime text-lime-fg"><I size={20} /></span>
                        <span className="font-display text-[15px] text-ink-muted">0{i + 1}</span>
                      </div>
                      <h3 className="mt-6 font-display text-[20px] font-semibold tracking-tight">{title as string}</h3>
                      <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{body as string}</p>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link href="/sign-up" className="inline-flex h-12 items-center rounded-full bg-lime px-6 font-semibold text-lime-fg hover:bg-lime-hover">
                  Create a free account
                </Link>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {companies.slice(0, 7).map((c) => (
                      <Link key={`${c.ats}/${c.slug}`} href={`/companies/${c.slug}`} title={c.name} className="rounded-full ring-2 ring-ink transition-transform hover:z-10 hover:-translate-y-0.5">
                        <CompanyLogo name={c.name} domain={c.domain} size={34} className="!rounded-full !border-0 !p-1.5" />
                      </Link>
                    ))}
                  </div>
                  <Link href="/companies" className="text-sm text-ink-muted hover:text-ink-fg">and {Math.max(0, s.companies - 7).toLocaleString()} more →</Link>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
