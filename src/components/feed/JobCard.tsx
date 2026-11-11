"use client";

import { memo } from "react";
import { ArrowRight, Bookmark, BookmarkCheck, EyeOff } from "lucide-react";
import type { JobRow as Job } from "@/lib/types";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { cn } from "@/components/ui/cn";
import { ago, cleanTitle, formatSalary, isFresh, splitLocations } from "./format";

/** Same company → same tint, so a company's cards are recognisable at a glance. */
function tintFor(slug: string) {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `var(--tint-${(h % 6) + 1})`;
}

function Tag({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <span className={cn("inline-flex h-7 items-center rounded-full border px-3 text-[12.5px]", strong ? "border-fg/25 font-semibold text-fg" : "border-fg/12 text-fg/75")}>
      {children}
    </span>
  );
}

export const JobCard = memo(function JobCard({
  job,
  now,
  status,
  onOpen,
  onToggleSave,
  onHide,
}: {
  job: Job;
  now: number;
  status?: string;
  onOpen: (id: string) => void;
  onToggleSave: (job: Job) => void;
  onHide: (job: Job) => void;
}) {
  const fresh = isFresh(job.first_seen_at, now, 1);
  const salary = formatSalary(job.salary);
  const loc = splitLocations(job.location);

  return (
    <li className="group fade-up">
      <article
        className="flex h-full cursor-pointer flex-col rounded-2xl border border-line bg-surface p-1 transition-colors duration-150 hover:border-line-strong"
        onClick={() => onOpen(job.id)}
      >
        <div className="flex flex-1 flex-col rounded-xl p-4 pb-5" style={{ background: tintFor(job.company_slug) }}>
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex h-7 items-center gap-2 rounded-full bg-surface px-3 font-mono text-xs tabular-nums text-fg/80" title={`Found ${new Date(job.first_seen_at).toLocaleString()}`}>
              <span className={cn("h-2 w-2 rounded-full ring-1 ring-fg/20", fresh ? "bg-lime" : "bg-fg/15")} />
              {now ? `found ${ago(job.first_seen_at, now)}`.replace("found just now", "just found") : " "}
            </span>
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                aria-label="Not interested"
                title="Not interested"
                onClick={() => onHide(job)}
                className="grid h-8 w-8 place-items-center rounded-full bg-surface text-subtle opacity-0 transition-opacity hover:text-fg focus-visible:opacity-100 group-hover:opacity-100"
              >
                <EyeOff size={15} />
              </button>
              <button
                type="button"
                aria-label={status ? `Saved (${status}). Remove from tracker` : "Save job"}
                aria-pressed={!!status}
                onClick={() => onToggleSave(job)}
                className={cn("grid h-8 w-8 place-items-center rounded-full bg-surface transition-colors", status ? "text-fg" : "text-subtle hover:text-fg")}
              >
                {status ? <BookmarkCheck size={16} className="fill-current" /> : <Bookmark size={16} />}
              </button>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-medium text-fg/70">{job.company_name}</div>
              <h3 className="mt-1 line-clamp-3 font-display text-[22px] font-medium leading-[1.15] tracking-tight text-fg">
                <a
                  href={`?job=${encodeURIComponent(job.id)}`}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return e.stopPropagation();
                    e.preventDefault();
                  }}
                  className="outline-none"
                >
                  {cleanTitle(job.title)}
                </a>
              </h3>
            </div>
            <CompanyLogo name={job.company_name} domain={job.company_domain} size={44} className="!rounded-full !border-0 !p-2 shadow-sm" />
          </div>

          <div className="mt-auto flex flex-wrap gap-1.5 pt-5">
            {status && status !== "Saved" && <Tag strong>{status}</Tag>}
            <Tag>{job.remote ? "Remote" : "On-site or hybrid"}</Tag>
            {job.visa === "Yes" && <Tag strong>Sponsors visa</Tag>}
            {job.visa === "No" && <Tag>No sponsorship</Tag>}
            <Tag>
              {job.seniority}
              {job.min_exp !== null && job.min_exp > 0 && ` · ${job.min_exp}+ yrs`}
            </Tag>
            <Tag>{job.category}</Tag>
          </div>
        </div>

        <footer className="flex items-center gap-3 px-3 pb-2 pt-3.5">
          <div className="min-w-0 flex-1">
            {salary && <div className="font-display text-[19px] font-medium tabular-nums tracking-tight">{salary}</div>}
            <div className={cn("truncate", salary ? "text-[13px] text-muted" : "text-[15px] font-medium text-fg")}>
              {loc.first}
              {loc.extra > 0 && <span className="font-normal text-subtle"> +{loc.extra}</span>}
            </div>
          </div>
          <span className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line-strong px-4 text-[13px] font-medium text-fg transition-colors group-hover:border-fg group-hover:bg-fg group-hover:text-bg">
            Details <ArrowRight size={14} strokeWidth={1.5} />
          </span>
        </footer>
      </article>
    </li>
  );
});

export function JobCardSkeleton() {
  return (
    <li className="rounded-2xl border border-line bg-surface p-1">
      <div className="space-y-4 rounded-xl bg-surface-2 p-4">
        <div className="skeleton h-7 w-28 !rounded-full" />
        <div className="space-y-2 pt-3">
          <div className="skeleton h-3.5 w-24" />
          <div className="skeleton h-6 w-4/5" />
          <div className="skeleton h-6 w-3/5" />
        </div>
        <div className="flex gap-1.5 pt-6">
          <div className="skeleton h-7 w-20 !rounded-full" />
          <div className="skeleton h-7 w-24 !rounded-full" />
          <div className="skeleton h-7 w-16 !rounded-full" />
        </div>
      </div>
      <div className="flex items-center justify-between px-3 pb-2 pt-3.5">
        <div className="space-y-1.5">
          <div className="skeleton h-5 w-24" />
          <div className="skeleton h-3 w-32" />
        </div>
        <div className="skeleton h-10 w-24 !rounded-full" />
      </div>
    </li>
  );
}
