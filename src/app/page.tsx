import Link from "next/link";
import Feed from "@/components/feed/Feed";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { currentUser } from "@/lib/auth";
import { stats, topCompanies } from "@/lib/query";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [s, companies, user] = await Promise.all([stats(), topCompanies(10), currentUser()]);

  return (
    <>
      <SiteHeader />
      <main className="flex-1 pb-20 sm:pb-0">
        {!user && (
          <section className="mx-auto max-w-[1320px] px-4 pb-1 pt-7 sm:px-6 sm:pt-10">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <h1 className="text-[28px] font-semibold leading-[1.1] tracking-tight text-balance sm:text-[40px]">
                  Apply before everyone else sees the job.
                </h1>
                <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted sm:text-base">
                  We check {s.companies.toLocaleString()} company career pages every 15 minutes, so new roles show up here hours or days before they reach LinkedIn or Indeed.
                </p>
              </div>
              <div className="flex flex-col gap-3 lg:items-end">
                <dl className="flex gap-6 text-sm">
                  {[
                    [s.openJobs.toLocaleString(), "open roles"],
                    [s.jobsToday.toLocaleString(), "found today"],
                    [s.jobsLastHour.toLocaleString(), "in the last hour"],
                  ].map(([v, k]) => (
                    <div key={k} className="flex flex-col-reverse">
                      <dt className="text-xs text-muted">{k}</dt>
                      <dd className="text-xl font-semibold tabular-nums tracking-tight">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex items-center gap-1.5">
                  <div className="flex -space-x-1.5">
                    {companies.slice(0, 8).map((c) => (
                      <Link key={`${c.ats}/${c.slug}`} href={`/?company=${c.slug}`} title={c.name} className="rounded-[10px] ring-2 ring-bg transition-transform hover:z-10 hover:-translate-y-0.5">
                        <CompanyLogo name={c.name} domain={c.domain} size={28} className="!rounded-[8px] !p-[3px]" />
                      </Link>
                    ))}
                  </div>
                  <span className="text-xs text-muted">and {Math.max(0, s.companies - 8)} more</span>
                </div>
              </div>
            </div>
          </section>
        )}
        {/* No <Suspense>: the page is rendered per request, so the feed ships in the first HTML chunk. */}
        <Feed signedIn={!!user} />
      </main>
      <SiteFooter />
    </>
  );
}
