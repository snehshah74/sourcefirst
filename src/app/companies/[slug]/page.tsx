import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowUpRight, Globe, MapPin, Plane, Wifi } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import FollowCompany from "@/components/FollowCompany";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { ATS_LABEL, formatSalary, splitLocations } from "@/components/feed/format";
import { currentUser } from "@/lib/auth";
import { PROVIDERS } from "@/lib/ats";
import type { Company } from "@/lib/companies";
import type { Ats } from "@/lib/types";
import { companyWithJobs } from "@/lib/query";
import type { JobRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/companies/[slug]">): Promise<Metadata> {
  const data = await companyWithJobs((await params).slug);
  if (!data) return {};
  return {
    title: `${data.company.name} jobs (${data.jobs.length} open) · SourceFirst`,
    description: `${data.jobs.length} open roles at ${data.company.name}, straight from their careers page and updated every 15 minutes.`,
  };
}

function relative(d: Date | string, now: number) {
  const h = (now - new Date(d).getTime()) / 3600_000;
  return h < 1 ? "new" : h < 24 ? `${Math.floor(h)}h` : `${Math.floor(h / 24)}d`;
}

export default async function CompanyPage({ params }: PageProps<"/companies/[slug]">) {
  const { slug } = await params;
  const [data, user] = await Promise.all([companyWithJobs(slug), currentUser()]);
  if (!data) notFound();
  const { company, jobs } = data;
  const now = new Date().getTime();

  // Group by role area (departments are often raw cost-center codes like "1185 Account Executives (EMEA)").
  const groups = new Map<string, JobRow[]>();
  for (const j of jobs) {
    const k = j.category || "Other";
    groups.set(k, [...(groups.get(k) ?? []), j]);
  }
  const teams = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  const remote = jobs.filter((j) => j.remote).length;
  const visa = jobs.filter((j) => j.visa === "Yes").length;
  const cities = new Map<string, number>();
  for (const j of jobs) for (const c of splitLocations(j.location).all.slice(0, 3)) cities.set(c, (cities.get(c) ?? 0) + 1);
  const topCities = [...cities.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-8 sm:px-6 sm:pb-12">
        <Link href="/companies" className="text-sm text-muted hover:text-fg">← All companies</Link>

        <header className="mt-4 flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:flex-row sm:items-center sm:p-6">
          <CompanyLogo name={company.name} domain={company.domain} size={64} className="!rounded-2xl !p-2" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{company.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span className="font-semibold text-fg">{jobs.length} open {jobs.length === 1 ? "role" : "roles"}</span>
              {company.domain && (
                <a href={`https://${company.domain}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-fg">
                  <Globe size={13} />{company.domain}
                </a>
              )}
              <span>Hires on {ATS_LABEL[company.ats] ?? company.ats}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <FollowCompany slug={company.slug} name={company.name} signedIn={!!user} />
            <a
              href={PROVIDERS[company.ats as Ats]?.boardUrl({ ats: company.ats as Ats, slug: company.slug, name: company.name, board: (company.board ?? undefined) as Company["board"] })}
              target="_blank" rel="noreferrer" className={buttonClass("secondary", "lg")}>
              Careers page <ArrowUpRight size={16} />
            </a>
          </div>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            [MapPin, topCities[0]?.[0] ?? "—", "Top location"],
            [Wifi, `${remote}`, "Remote roles"],
            [Plane, `${visa}`, "Say they sponsor visas"],
            [ArrowUpRight, `${teams.length}`, teams.length === 1 ? "Role area" : "Role areas"],
          ].map(([Icon, v, k]) => {
            const I = Icon as typeof MapPin;
            return (
              <div key={k as string} className="rounded-xl border border-line bg-surface p-3.5 shadow-sm">
                <I size={15} className="text-subtle" />
                <div className="mt-1.5 truncate text-lg font-semibold tracking-tight">{v as string}</div>
                <div className="text-xs text-muted">{k as string}</div>
              </div>
            );
          })}
        </section>

        {teams.length > 1 && (
          <nav aria-label="Role areas" className="no-scrollbar -mx-4 mt-6 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {teams.map(([t, js]) => (
              <a key={t} href={`#team-${encodeURIComponent(t)}`} className="shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-muted hover:border-line-strong hover:text-fg">
                {t} <span className="text-subtle">{js.length}</span>
              </a>
            ))}
          </nav>
        )}

        <div className="mt-6 space-y-6">
          {teams.map(([team, js]) => (
            <section key={team} id={`team-${encodeURIComponent(team)}`} className="scroll-mt-20">
              <h2 className="mb-2 flex items-baseline gap-2 px-1 text-sm font-semibold">
                {team} <span className="font-normal text-subtle">{js.length}</span>
              </h2>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                {js.map((j) => {
                  const salary = formatSalary(j.salary);
                  const loc = splitLocations(j.location);
                  return (
                    <li key={j.id}>
                      <Link href={`/?company=${company.slug}&us=0&job=${encodeURIComponent(j.id)}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/70">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-medium">{j.title}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
                            {loc.first}{loc.extra > 0 && ` +${loc.extra}`}
                            {j.department && <span className="hidden text-subtle sm:inline">· {j.department.replace(/^\d+\s+/, "")}</span>}
                            {salary && <Badge tone="strong">{salary}</Badge>}
                            {j.remote && <Badge tone="info">Remote</Badge>}
                            {j.visa === "Yes" && <Badge tone="accent">Sponsors visa</Badge>}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-subtle">{relative(j.first_seen_at, now)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {!jobs.length && <p className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-muted">No open roles right now. Follow to hear the moment one opens.</p>}
        </div>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: company.name,
              url: company.domain ? `https://${company.domain}` : undefined,
            }),
          }}
        />
      </main>
      <SiteFooter />
    </>
  );
}
