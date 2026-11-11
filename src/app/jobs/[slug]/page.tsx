import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { buttonClass } from "@/components/ui/Button";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LANDINGS } from "@/lib/seo";
import { parseFilters, searchJobs } from "@/lib/query";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/jobs/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const l = LANDINGS.find((x) => x.slug === slug);
  return l ? { title: `${l.h1} · SourceFirst`, description: l.blurb } : {};
}

/** Server-rendered, crawlable landing page: the programmatic-SEO play. */
export default async function Landing({ params }: PageProps<"/jobs/[slug]">) {
  const { slug } = await params;
  const l = LANDINGS.find((x) => x.slug === slug);
  if (!l) notFound();
  const qs = new URLSearchParams(l.filters);
  const { jobs, total } = await searchJobs({ ...parseFilters(qs), pageSize: 50 });

  return (
    <>
    <SiteHeader />
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-10 pt-8 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{l.h1}</h1>
      <p className="mt-2 text-muted">{l.blurb}</p>
      <p className="mt-1 text-sm text-muted">{total.toLocaleString()} open roles right now.</p>
      <Link href={`/?${qs.toString()}#search`} className={buttonClass("primary", "md", "mt-5")}>
        Filter these jobs →
      </Link>
      <ol className="mt-8 divide-y divide-line rounded-xl border border-line bg-surface shadow-sm">
        {jobs.map((j) => (
          <li key={j.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <a href={j.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{j.title}</a>
              <div className="truncate text-sm text-muted">{j.company_name} · {j.location} · visa: {j.visa}</div>
            </div>
            <time className="shrink-0 text-xs text-muted" dateTime={new Date(j.first_seen_at).toISOString()}>{new Date(j.first_seen_at).toLocaleDateString()}</time>
          </li>
        ))}
      </ol>
    </main>
    <SiteFooter />
    </>
  );
}
