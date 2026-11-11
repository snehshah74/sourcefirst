"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, GripVertical, NotebookPen, Search, Trash2 } from "lucide-react";
import { STATUSES, useTracker, type Status, type TrackedJob } from "@/lib/tracker";
import { CompanyLogo } from "./ui/CompanyLogo";
import { Button, buttonClass } from "./ui/Button";
import { toast } from "./ui/Toaster";
import { cn } from "./ui/cn";
import { ago, cleanTitle, splitLocations } from "./feed/format";

const DOT: Record<Status, string> = {
  Saved: "bg-subtle",
  Applied: "bg-info",
  Interviewing: "bg-warn",
  Offer: "bg-accent",
  Rejected: "bg-danger",
};
const HINT: Record<Status, string> = {
  Saved: "Jobs you want to apply to",
  Applied: "Waiting to hear back",
  Interviewing: "In the process",
  Offer: "Time to decide",
  Rejected: "On to the next one",
};

function Card({ t, now, onStatus, onNotes, onRemove, draggable }: {
  t: TrackedJob;
  now: number;
  onStatus: (s: Status) => void;
  onNotes: (n: string) => void;
  onRemove: () => void;
  draggable?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <article
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/job", t.jobId);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn("group rounded-xl border border-line bg-surface p-3 shadow-sm transition-shadow hover:shadow-md", draggable && "cursor-grab active:cursor-grabbing")}
    >
      <div className="flex gap-2.5">
        <CompanyLogo name={t.job.company_name} domain={t.job.company_domain} size={32} className="!rounded-lg !p-1" />
        <div className="min-w-0 flex-1">
          <Link href={`/?job=${encodeURIComponent(t.jobId)}`} className="line-clamp-2 text-sm font-semibold leading-snug hover:text-accent">
            {cleanTitle(t.job.title)}
          </Link>
          <div className="mt-0.5 truncate text-xs text-muted">
            {t.job.company_name} · {splitLocations(t.job.location).first}
          </div>
        </div>
        {draggable && <GripVertical size={14} className="mt-0.5 shrink-0 text-subtle opacity-0 group-hover:opacity-100" />}
      </div>

      {editing ? (
        <textarea
          autoFocus
          defaultValue={t.notes}
          rows={3}
          placeholder="Recruiter name, referral, interview dates…"
          onBlur={(e) => {
            onNotes(e.target.value);
            setEditing(false);
          }}
          className="mt-2.5 w-full resize-none rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-xs outline-none focus:border-accent"
        />
      ) : (
        t.notes && (
          <button type="button" onClick={() => setEditing(true)} className="mt-2.5 block w-full whitespace-pre-wrap rounded-lg bg-surface-2 px-2 py-1.5 text-left text-xs text-muted">
            {t.notes}
          </button>
        )
      )}

      <div className="mt-2.5 flex items-center gap-1">
        <select
          aria-label="Status"
          value={t.status}
          onChange={(e) => onStatus(e.target.value as Status)}
          className="h-7 rounded-md border border-line bg-surface px-1.5 text-xs font-medium outline-none"
        >
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <span className="ml-1 text-[11px] text-subtle">{now ? ago(t.updatedAt, now) : ""}</span>
        <div className="ml-auto flex">
          <Button variant="ghost" size="icon-sm" aria-label="Edit notes" title="Notes" onClick={() => setEditing(true)} className="!h-7 !w-7">
            <NotebookPen size={14} />
          </Button>
          <a href={t.job.apply_url ?? t.job.url} target="_blank" rel="noreferrer" aria-label="Open posting" title="Open posting" className={buttonClass("ghost", "icon-sm", "!h-7 !w-7")}>
            <ArrowUpRight size={14} />
          </a>
          <Button variant="ghost" size="icon-sm" aria-label="Remove" title="Remove" onClick={onRemove} className="!h-7 !w-7 hover:!text-danger">
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
    </article>
  );
}

export default function TrackerBoard() {
  const tracker = useTracker(true);
  const [over, setOver] = useState<Status | null>(null);
  const [tab, setTab] = useState<Status>("Saved");
  const [now] = useState(() => Date.now());

  const all = useMemo(() => Object.values(tracker.items).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))), [tracker.items]);
  const by = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s, all.filter((t) => t.status === s)])) as Record<Status, TrackedJob[]>, [all]);

  const remove = (t: TrackedJob) => {
    tracker.remove(t.jobId);
    toast("Removed from tracker", { action: { label: "Undo", onClick: () => tracker.setStatus(t.job, t.status) } });
  };
  const cardProps = (t: TrackedJob) => ({
    t,
    now,
    onStatus: (s: Status) => tracker.setStatus(t.job, s),
    onNotes: (n: string) => tracker.setNotes(t.jobId, n),
    onRemove: () => remove(t),
  });

  if (!all.length)
    return (
      <div className="mx-auto mt-6 flex max-w-md flex-col items-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent"><Search size={22} /></div>
        <h2 className="font-semibold">Nothing tracked yet</h2>
        <p className="mt-1 text-sm text-muted">Save jobs from the feed, or click Apply, and they&apos;ll show up here so you can follow each application.</p>
        <Link href="/" className={buttonClass("primary", "md", "mt-5")}>Find jobs</Link>
      </div>
    );

  return (
    <>
      {/* Phones: one status at a time */}
      <div className="md:hidden">
        <div className="no-scrollbar -mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setTab(s)}
              className={cn("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium", tab === s ? "border-transparent bg-fg text-bg" : "border-line bg-surface text-muted")}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", DOT[s])} />
              {s} <span className="opacity-60">{by[s].length}</span>
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {by[tab].map((t) => <Card key={t.jobId} {...cardProps(t)} />)}
          {!by[tab].length && <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">{HINT[tab]}. Nothing here yet.</p>}
        </div>
      </div>

      {/* Desktop: drag-and-drop board */}
      <div className="hidden gap-3 md:grid md:grid-cols-5">
        {STATUSES.map((s) => (
          <section
            key={s}
            aria-label={s}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(s);
            }}
            onDragLeave={() => setOver((o) => (o === s ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = e.dataTransfer.getData("text/job");
              const t = tracker.items[id];
              if (t && t.status !== s) tracker.setStatus(t.job, s);
            }}
            className={cn("flex min-h-[60vh] flex-col rounded-2xl border p-2 transition-colors", over === s ? "border-accent bg-accent-soft/50" : "border-transparent bg-surface-2/70")}
          >
            <header className="flex items-center gap-2 px-1.5 pb-2.5 pt-1">
              <span className={cn("h-2 w-2 rounded-full", DOT[s])} />
              <h2 className="text-sm font-semibold">{s}</h2>
              <span className="text-xs tabular-nums text-subtle">{by[s].length}</span>
            </header>
            <div className="flex flex-1 flex-col gap-2">
              {by[s].map((t) => <Card key={t.jobId} draggable {...cardProps(t)} />)}
              {!by[s].length && <p className="px-2 py-6 text-center text-xs text-subtle">{HINT[s]}</p>}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
