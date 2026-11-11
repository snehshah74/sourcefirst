"use client";

import { memo } from "react";
import { Bookmark, BookmarkCheck, EyeOff, MapPin } from "lucide-react";
import type { JobRow as Job } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { cn } from "@/components/ui/cn";
import { ago, formatSalary, isFresh, splitLocations } from "./format";

export const JobRow = memo(function JobRow({
  job,
  now,
  selected,
  status,
  onSelect,
  onToggleSave,
  onHide,
}: {
  job: Job;
  now: number;
  selected: boolean;
  status?: string;
  onSelect: (id: string) => void;
  onToggleSave: (job: Job) => void;
  onHide?: (job: Job) => void;
}) {
  const fresh = isFresh(job.first_seen_at, now, 1);
  const salary = formatSalary(job.salary);
  const loc = splitLocations(job.location);

  return (
    <li
      id={`job-${job.id}`}
      className={cn(
        "group relative flex cursor-pointer gap-3.5 px-4 py-3.5 transition-colors",
        selected ? "bg-accent-soft/60" : "hover:bg-surface-2/70",
      )}
      onClick={() => onSelect(job.id)}
    >
      {selected && <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-accent" />}
      <CompanyLogo name={job.company_name} domain={job.company_domain} size={40} className="mt-0.5" />

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1">
            {/* Real link for crawlers, middle-click and screen readers; plain click opens the preview. */}
            <a
              href={`?job=${encodeURIComponent(job.id)}`}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
                e.preventDefault();
              }}
              className="line-clamp-2 text-[15px] font-semibold leading-snug text-fg outline-none"
            >
              {job.title}
            </a>
          </h3>
          <span
            className={cn("mt-0.5 shrink-0 text-xs tabular-nums", fresh ? "font-semibold text-accent" : "text-subtle")}
            title={`Discovered ${new Date(job.first_seen_at).toLocaleString()}`}
          >
            {fresh && <span className="live-dot mr-1 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />}
            {ago(job.first_seen_at, now)}
          </span>
        </div>

        <div className="mt-0.5 flex min-w-0 items-center gap-1 text-[13px] text-muted">
          <span className="truncate font-medium text-fg/80">{job.company_name}</span>
          <span className="text-subtle">·</span>
          <MapPin size={12} className="shrink-0 text-subtle" />
          <span className="truncate">{loc.first}</span>
          {loc.extra > 0 && <span className="shrink-0 text-subtle">+{loc.extra}</span>}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 pr-8 sm:pr-16">
          {status && status !== "Saved" && <Badge tone={status === "Rejected" ? "danger" : status === "Offer" ? "accent" : "info"}>{status}</Badge>}
          {salary && <Badge tone="strong">{salary}</Badge>}
          {job.remote && <Badge tone="info">Remote</Badge>}
          {job.visa === "Yes" && <Badge tone="accent">Sponsors visa</Badge>}
          {job.visa === "No" && <Badge tone="danger">No sponsorship</Badge>}
          <Badge>{job.seniority}</Badge>
          {job.min_exp !== null && job.min_exp > 0 && <Badge>{job.min_exp}+ yrs</Badge>}
        </div>
      </div>

      <div className="absolute bottom-2.5 right-2.5 flex items-center gap-0.5">
        {onHide && (
          <button
            type="button"
            aria-label="Not interested"
            title="Not interested (x)"
            onClick={(e) => {
              e.stopPropagation();
              onHide(job);
            }}
            className="hidden h-8 w-8 place-items-center rounded-lg text-subtle opacity-0 transition-opacity hover:bg-surface-3 hover:text-fg focus-visible:opacity-100 group-hover:opacity-100 sm:grid"
          >
            <EyeOff size={16} />
          </button>
        )}
        <button
          type="button"
          aria-label={status ? `Saved (${status}). Remove from tracker` : "Save job"}
          title={status ? "Remove from tracker" : "Save (s)"}
          aria-pressed={!!status}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave(job);
          }}
          className={cn(
            "grid h-8 w-8 place-items-center rounded-lg transition-[opacity,colors]",
            status ? "text-accent opacity-100" : "text-subtle opacity-100 hover:bg-surface-3 hover:text-fg sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100",
          )}
        >
          {status ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
        </button>
      </div>
    </li>
  );
});

export function JobRowSkeleton() {
  return (
    <li className="flex gap-3.5 px-4 py-4">
      <div className="skeleton h-10 w-10 shrink-0 !rounded-[10px]" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-3 w-1/2" />
        <div className="flex gap-1.5 pt-1">
          <div className="skeleton h-5 w-16" />
          <div className="skeleton h-5 w-20" />
          <div className="skeleton h-5 w-12" />
        </div>
      </div>
    </li>
  );
}
