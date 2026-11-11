import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { LANDINGS } from "@/lib/seo";
import { Logo } from "./ui/Logo";

const FAQ = [
  ["How do jobs show up here before LinkedIn?", "Companies post a role in their applicant tracking system (Greenhouse, Lever, Ashby) first. Big job boards only pick it up later through syndication or scraping. We read those career pages directly, every 15 minutes."],
  ["How fresh is the feed?", "Every tracked company's careers page is checked every 15 minutes. The time on each job is when we first found it, and the list updates itself while you browse."],
  ["How is visa sponsorship detected?", "We scan each description for explicit language such as \"we sponsor visas\", \"no sponsorship\", \"must be a US citizen\" or ITAR. When a posting says nothing, it's marked Not stated. Always confirm with the employer."],
  ["Is it free?", "Yes. Browsing and filtering are open to everyone. A free account adds saved jobs, an application tracker, and email alerts for new matches."],
];

export default function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-line bg-surface pb-24 sm:pb-0">
      <div className="mx-auto grid max-w-[1320px] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <Logo />
          <p className="max-w-sm text-sm text-muted">Jobs straight from company career pages, minutes after they&apos;re posted.</p>
          <div>
            <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-subtle">Browse</h2>
            <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm min-[420px]:grid-cols-2">
              {LANDINGS.map((l) => (
                <li key={l.slug}><Link href={`/jobs/${l.slug}`} className="text-muted hover:text-fg">{l.h1}</Link></li>
              ))}
            </ul>
          </div>
        </div>
        <div id="faq">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">Questions</h2>
          <div className="divide-y divide-line rounded-2xl border border-line">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group px-4 py-3.5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                  {q}
                  <ChevronDown size={16} className="shrink-0 text-subtle transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
              }),
            }}
          />
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-4 text-xs text-subtle sm:px-6">
          <span>© {new Date().getFullYear()} SourceFirst</span>
          <Link href="/status" className="hover:text-fg">Pipeline status</Link>
          <span className="ml-auto">Data from public company career pages. Always apply on the employer&apos;s site.</span>
        </div>
      </div>
    </footer>
  );
}
