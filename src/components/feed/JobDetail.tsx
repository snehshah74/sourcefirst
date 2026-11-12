"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight, Banknote, Bookmark, BookmarkCheck, Briefcase, Building2, CalendarClock, EyeOff, GraduationCap, Link2, MapPin, Plane, Radar, Wifi, X,
} from "lucide-react";
import type { JobRow as Job } from "@/lib/types";
import { Button, buttonClass } from "@/components/ui/Button";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/components/ui/cn";
import { STATUSES, type Status } from "@/lib/tracker";
import { ago, ATS_LABEL, cleanTitle, formatSalary, splitLocations, VISA_LABEL } from "./format";

interface Detail {
  job: Job & { published_at: string | null };
  description: string | null;
  more: { id: string; title: string; location: string; first_seen_at: string }[];
}

const VISA_HELP: Record<string, string> = {
  Yes: "The description says the employer sponsors visas.",
  No: "The description rules out sponsorship (e.g. citizenship, clearance or ITAR requirements).",
  Maybe: "The description doesn't mention sponsorship. Ask the recruiter.",
};

function Fact({ icon: Icon, label, value, tone }: { icon: typeof MapPin; label: string; value: React.ReactNode; tone?: "accent" | "danger" }) {
  return (
    <div className="flex min-w-0 gap-2 rounded-xl bg-surface-2 px-2.5 py-2 sm:gap-2.5 sm:px-3 sm:py-2.5">
      <Icon size={16} className={cn("mt-0.5 shrink-0", tone === "accent" ? "text-accent" : tone === "danger" ? "text-danger" : "text-subtle")} />
      <div className="min-w-0">
        <div className="text-xs text-subtle">{label}</div>
        <div className="text-[13.5px] font-medium leading-snug text-fg">{value}</div>
      </div>
    </div>
  );
}

export function JobDetail({
  jobId,
  preview,
  now,
  status,
  signedIn,
  onStatus,
  onRemove,
  onSelect,
  onFilterCompany,
  onHide,
  onGone,
  onClose,
}: {
  jobId: string;
  preview?: Job; // row data shown instantly while the full detail loads
  now: number;
  status?: Status;
  signedIn: boolean;
  onStatus: (job: Job, s: Status) => void;
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
  onFilterCompany: (slug: string, name: string) => void;
  onHide?: (job: Job) => void;
  /** Called when the company has taken this posting down, so the list can drop it. */
  onGone?: (jobId: string) => void;
  onClose?: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  // Per job: "gone" = the company took the posting down; "error" = we couldn't reach it right now.
  const [failure, setFailure] = useState<{ jobId: string; kind: "gone" | "error" } | null>(null);
  const goneRef = useRef(onGone);
  useEffect(() => {
    goneRef.current = onGone;
  }, [onGone]);

  useEffect(() => {
    let alive = true;
    fetch(`/api/jobs/${encodeURIComponent(jobId)}`)
      .then(async (r) => {
        if (r.status === 410) {
          if (!alive) return;
          setFailure({ jobId, kind: "gone" });
          goneRef.current?.(jobId);
          return;
        }
        if (!r.ok) throw new Error(String(r.status));
        const d: Detail = await r.json();
        if (alive) setDetail(d);
      })
      .catch(() => alive && setFailure({ jobId, kind: "error" }));
    return () => {
      alive = false;
    };
  }, [jobId]);

  const [askApplied, setAskApplied] = useState(false);
  const pendingApply = useRef(false);
  useEffect(() => {
    const onBack = () => {
      if (pendingApply.current && document.visibilityState === "visible") {
        pendingApply.current = false;
        setAskApplied(true);
      }
    };
    document.addEventListener("visibilitychange", onBack);
    window.addEventListener("focus", onBack);
    return () => {
      document.removeEventListener("visibilitychange", onBack);
      window.removeEventListener("focus", onBack);
    };
  }, []);

  const d = detail?.job.id === jobId ? detail : null;
  const job = d?.job ?? preview;
  const failed = failure?.jobId === jobId && !d ? failure.kind : null;

  if (failed === "gone")
    return (
      <div className="flex min-h-80 flex-col items-center justify-center gap-2 p-10 text-center">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-surface-2 text-subtle"><X size={20} /></div>
        <p className="font-semibold">This job has been taken down</p>
        <p className="max-w-xs text-sm text-muted">{preview ? `${preview.company_name} closed this posting, so we've removed it.` : "The company closed this posting, so we've removed it."}</p>
        {onClose && <Button className="mt-3" onClick={onClose}>Back to jobs</Button>}
      </div>
    );
  if (!job)
    return failed === "error" ? (
      <div className="grid h-full min-h-80 place-items-center p-10 text-center text-sm text-muted">Couldn&apos;t load this job. Check your connection and try again.</div>
    ) : (
      <DetailSkeleton />
    );

  const salary = formatSalary(job.salary);
  const loc = splitLocations(job.location);
  const applyHref = job.apply_url ?? job.url;

  // Clicking Apply only opens the employer's page; it doesn't mean they applied. We ask when they come back.
  const apply = () => {
    if (!signedIn || (status && status !== "Saved")) return;
    pendingApply.current = true;
    // If the posting opened in a background tab (cmd-click), this tab never loses focus: ask after a moment.
    setTimeout(() => {
      if (pendingApply.current && document.visibilityState === "visible" && document.hasFocus()) {
        pendingApply.current = false;
        setAskApplied(true);
      }
    }, 4000);
  };

  const answerApplied = (didApply: boolean) => {
    setAskApplied(false);
    if (didApply) {
      const prev = status;
      onStatus(job, "Applied");
      toast.success("Moved to Applied", {
        description: "Track it from your tracker.",
        action: { label: "Undo", onClick: () => (prev ? onStatus(job, prev) : onRemove(job.id)) },
      });
    } else if (!status) {
      toast("No problem", { action: { label: "Save for later", onClick: () => onStatus(job, "Saved") } });
    }
  };

  const askBanner = askApplied && (!status || status === "Saved") && (
    <div role="status" className="fade-up flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-accent/30 bg-accent-soft px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-fg">Did you apply?</div>
        <div className="text-xs text-muted">We&apos;ll move it to Applied in your tracker.</div>
      </div>
      <div className="flex gap-1.5">
        <Button size="sm" variant="primary" onClick={() => answerApplied(true)}>Yes, I applied</Button>
        <Button size="sm" variant="secondary" onClick={() => answerApplied(false)}>Not yet</Button>
      </div>
    </div>
  );

  const copyLink = () => {
    const url = `${window.location.origin}/?job=${encodeURIComponent(job.id)}`;
    navigator.clipboard?.writeText(url).then(() => toast("Link copied"), () => toast("Couldn't copy link"));
  };

  const actions = (
    <div className="flex items-center gap-2">
      <a href={applyHref} target="_blank" rel="noreferrer" onClick={apply} className={buttonClass("primary", "lg", "min-w-0 flex-1 sm:flex-none")}>
        <span className="truncate">Apply on {job.company_name.split(" (")[0]}</span> <ArrowUpRight size={17} className="shrink-0" />
      </a>
      {status ? (
        <div className="flex h-11 shrink-0 items-center gap-1 rounded-xl border border-line bg-surface pl-3 pr-1 shadow-sm">
          <BookmarkCheck size={17} className="text-accent" />
          <select
            aria-label="Application status"
            value={status}
            onChange={(e) => onStatus(job, e.target.value as Status)}
            className="h-9 cursor-pointer bg-transparent pr-1 text-sm font-medium outline-none"
          >
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <Button variant="ghost" size="icon-sm" aria-label="Remove from tracker" onClick={() => onRemove(job.id)}>
            <X size={15} />
          </Button>
        </div>
      ) : (
        <Button size="lg" onClick={() => onStatus(job, "Saved")}>
          <Bookmark size={17} /> Save
        </Button>
      )}
    </div>
  );

  return (
    <article className="flex min-h-full flex-col" aria-label={cleanTitle(job.title)}>
      <header className="space-y-4 border-b border-line p-5 sm:p-6">
        <div className="flex items-start gap-3.5">
          <CompanyLogo name={job.company_name} domain={job.company_domain} size={52} />
          <div className="min-w-0 flex-1">
            <a href={`/companies/${job.company_slug}`} className="text-sm font-medium text-muted hover:text-accent hover:underline" title={`About ${job.company_name}`}>
              {job.company_name}
            </a>
            <h2 className="mt-0.5 font-display text-[22px] font-medium leading-tight tracking-tight text-fg sm:text-[26px]">{cleanTitle(job.title)}</h2>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
              <span className="inline-flex items-center gap-1"><MapPin size={13} />{loc.first}{loc.extra > 0 && ` +${loc.extra} more`}</span>
              <span className="text-subtle">·</span>
              <span className="inline-flex items-center gap-1"><Radar size={13} />Found {ago(job.first_seen_at, now, true)}</span>
            </p>
          </div>
          <div className="-mr-2 -mt-1 flex shrink-0">
            {onHide && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Not interested"
                title="Not interested (x)"
                onClick={() => {
                  onHide(job);
                  onClose?.();
                }}
              >
                <EyeOff size={17} />
              </Button>
            )}
            <Button variant="ghost" size="icon" aria-label="Copy link" title="Copy link" onClick={copyLink}>
              <Link2 size={17} />
            </Button>
            {onClose && (
              <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
                <X size={18} />
              </Button>
            )}
          </div>
        </div>

        {/* In the mobile sheet the actions live in a bar pinned to the bottom instead. */}
        {!onClose && actions}
        {!onClose && askBanner}
      </header>

      <div className="flex-1 space-y-6 p-5 sm:p-6">
        <section className="grid grid-cols-2 gap-2">
          <Fact icon={Banknote} label="Salary" value={salary ?? <span className="text-muted">Not listed</span>} />
          <Fact icon={Plane} label="Visa" value={<span title={VISA_HELP[job.visa]}>{VISA_LABEL[job.visa]}</span>} tone={job.visa === "Yes" ? "accent" : job.visa === "No" ? "danger" : undefined} />
          <Fact icon={GraduationCap} label="Level" value={`${job.seniority}${job.min_exp ? ` · ${job.min_exp}+ years` : ""}`} />
          <Fact icon={Wifi} label="Workplace" value={job.remote ? "Remote" : "On-site / hybrid"} />
          <Fact icon={Briefcase} label="Team" value={job.department ?? job.category} />
          <Fact icon={CalendarClock} label="Posted" value={d?.job.published_at ? new Date(d.job.published_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"} />
        </section>

        {job.visa !== "Maybe" && <p className="-mt-3 text-xs text-subtle">{VISA_HELP[job.visa]} Always confirm with the employer.</p>}

        {job.skills && job.skills.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold">Skills mentioned</h3>
            <div className="flex flex-wrap gap-1.5">
              {job.skills.map((k) => <span key={k} className="rounded-md bg-surface-2 px-2 py-1 text-xs text-muted">{k}</span>)}
            </div>
          </section>
        )}

        {loc.extra > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold">Locations</h3>
            <div className="flex flex-wrap gap-1.5">
              {loc.all.map((l) => <span key={l} className="rounded-md bg-surface-2 px-2 py-1 text-xs text-muted">{l}</span>)}
            </div>
          </section>
        )}

        <section>
          <h3 className="mb-3 text-sm font-semibold">About the role</h3>
          {d ? (
            d.description ? (
              <div className="prose-job" dangerouslySetInnerHTML={{ __html: d.description }} />
            ) : (
              <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">
                The full description isn&apos;t available here. <a href={job.url} target="_blank" rel="noreferrer" className="text-accent underline">Read it on the company site</a>.
              </p>
            )
          ) : failed === "error" ? (
            <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">
              Couldn&apos;t load the description right now. <a href={job.url} target="_blank" rel="noreferrer" className="text-accent underline">Read it on the company site</a>.
            </p>
          ) : (
            <div className="space-y-2.5">
              {[92, 100, 85, 96, 70, 0, 88, 94, 60].map((w, i) => (w ? <div key={i} className="skeleton h-3.5" style={{ width: `${w}%` }} /> : <div key={i} className="h-2" />))}
            </div>
          )}
        </section>

        {d && d.more.length > 0 && (
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">More at {job.company_name}</h3>
              <button type="button" onClick={() => onFilterCompany(job.company_slug, job.company_name)} className="text-xs text-muted hover:text-accent">
                See all →
              </button>
            </div>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
              {d.more.map((m) => (
                <li key={m.id}>
                  <button type="button" onClick={() => onSelect(m.id)} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-surface-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{cleanTitle(m.title)}</span>
                      <span className="block truncate text-xs text-muted">{splitLocations(m.location).first}</span>
                    </span>
                    <span className="shrink-0 text-xs text-subtle">{ago(m.first_seen_at, now)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="flex items-center gap-2 border-t border-line pt-4 text-xs text-subtle">
          <Building2 size={13} />
          Pulled from {job.company_name}&apos;s {ATS_LABEL[job.ats] ?? job.ats} careers page.
          <a href={job.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-0.5 hover:text-fg">
            Original posting <ArrowUpRight size={12} />
          </a>
        </footer>
      </div>

      {onClose && (
        <div className="sticky bottom-0 z-10 space-y-2.5 border-t border-line bg-surface/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          {askBanner}
          {actions}
        </div>
      )}
    </article>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-5 p-6">
      <div className="flex gap-3.5">
        <div className="skeleton h-[52px] w-[52px] !rounded-xl" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="skeleton h-3.5 w-24" />
          <div className="skeleton h-6 w-4/5" />
          <div className="skeleton h-3.5 w-1/2" />
        </div>
      </div>
      <div className="skeleton h-11 w-48 !rounded-xl" />
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-14 !rounded-xl" />)}
      </div>
    </div>
  );
}
