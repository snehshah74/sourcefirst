"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUp, LayoutGrid, Loader2, Rows3, SearchX } from "lucide-react";
import type { JobRow as Job } from "@/lib/types";
import { useTracker, type Status } from "@/lib/tracker";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/components/ui/cn";
import { SearchDeck } from "./SearchDeck";
import { FilterRail, RAIL_PARAMS } from "./FilterRail";
import { JobCard, JobCardSkeleton } from "./JobCard";
import { JobRow, JobRowSkeleton } from "./JobRow";
import { JobDetail } from "./JobDetail";
import { useFeed, useUrlState } from "./useFeed";
import { ago, VISA_LABEL } from "./format";
import { Onboarding } from "./Onboarding";
import { usePrefs } from "./usePrefs";
import { describePrefs, prefsToQuery, type Prefs } from "@/lib/prefs";

/** URL params that are filters (as opposed to UI state like ?job=). */
const FILTER_PARAMS = ["q", "loc", "minSalary", "since", "visa", "category", "seniority", "ats", "maxExp", "remote", "company", "us", "sort"];
const PREF_PARAMS = ["category", "seniority", "remote", "us", "visa"];

function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Cards (visual, default) or List (dense, with a preview pane on wide screens); remembered per browser. */
type View = "cards" | "list";
const VIEW_KEY = "sf-view";
const viewListeners = new Set<() => void>();
function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "cards";
  } catch {
    return "cards";
  }
}
function useView(): [View, (v: View) => void] {
  const view = useSyncExternalStore((cb) => (viewListeners.add(cb), () => viewListeners.delete(cb)), readView, () => "cards" as View);
  const set = (v: View) => {
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
    viewListeners.forEach((l) => l());
  };
  return [view, set];
}

const typing = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  return !!t && (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable);
};

export default function Feed({ signedIn, hero }: { signedIn: boolean; hero?: React.ReactNode }) {
  const router = useRouter();
  const { get, list, update } = useUrlState();
  const feed = useFeed();
  const tracker = useTracker(signedIn);
  const [view, setView] = useView();
  const wide = useMedia("(min-width: 1280px)");
  // The inline preview pane exists only in List view on wide screens; otherwise details open in a drawer.
  const isDesktop = view === "list" && wide;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const prefs = usePrefs(signedIn);
  const [editingPrefs, setEditingPrefs] = useState(false);
  // Whether the visitor arrived on a filtered link (then we don't interrupt them with onboarding).
  const [arrivedFiltered] = useState(() => typeof window !== "undefined" && FILTER_PARAMS.some((k) => new URLSearchParams(window.location.search).has(k)));
  const showOnboarding = editingPrefs || (prefs.loaded && !prefs.seen && !arrivedFiltered);

  // Arriving with no filters in the URL? Start from the user's saved preferences ("For you").
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current || !prefs.loaded) return;
    applied.current = true;
    const hasFilters = FILTER_PARAMS.some((k) => new URLSearchParams(window.location.search).has(k));
    if (prefs.prefs && !hasFilters) update(Object.fromEntries(prefsToQuery(prefs.prefs)));
  }, [prefs.loaded, prefs.prefs, update]);

  const applyPrefs = useCallback(
    async (p: Prefs, digest: boolean) => {
      setEditingPrefs(false);
      await prefs.save(p);
      const q = prefsToQuery(p);
      update({ ...Object.fromEntries(PREF_PARAMS.map((k) => [k, null])), ...Object.fromEntries(q), job: null });
      if (digest) {
        const res = await fetch("/api/me/searches", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: `For you · ${describePrefs(p)}`, query: q.toString(), frequency: "daily" }),
        });
        if (res.ok) toast.success("Feed personalized", { description: "You'll get a daily email with new matches." });
      } else toast.success("Feed personalized");
    },
    [prefs, update],
  );
  // "For you" is active when the URL's preference filters match the saved preferences exactly.
  const forYouActive =
    !!prefs.prefs && PREF_PARAMS.every((k) => (get(k) || "") === (prefsToQuery(prefs.prefs!).get(k) || ""));

  // Selected job: from the URL (?job=…), or on desktop the first result so the preview is never empty.
  const urlJob = get("job") || null;
  const selectedId = urlJob ?? (isDesktop ? feed.jobs[0]?.id ?? null : null);
  const selectedPreview = feed.jobs.find((j) => j.id === selectedId);

  // The URL updates on the next render; keyboard handlers need the selection *now* (key repeat is fast).
  const selRef = useRef<string | null>(selectedId);
  useEffect(() => {
    selRef.current = selectedId;
  }, [selectedId]);
  const select = useCallback(
    (id: string) => {
      selRef.current = id;
      update({ job: id }, isDesktop ? "replace" : "push");
    },
    [update, isDesktop],
  );
  const closeSheet = useCallback(() => update({ job: null }), [update]);

  const requireSignIn = useCallback(
    (why: string) => {
      toast(why, {
        action: { label: "Sign in", onClick: () => router.push(`/sign-in?next=${encodeURIComponent(window.location.pathname + window.location.search)}`) },
      });
    },
    [router],
  );

  const setStatus = useCallback(
    (job: Job, s: Status) => {
      if (!signedIn) return requireSignIn("Sign in to save jobs and track applications");
      tracker.setStatus(job, s);
    },
    [signedIn, tracker, requireSignIn],
  );

  const toggleSave = useCallback(
    (job: Job) => {
      if (!signedIn) return requireSignIn("Sign in to save jobs and track applications");
      if (tracker.items[job.id]) {
        tracker.remove(job.id);
        toast("Removed from tracker");
      } else {
        tracker.setStatus(job, "Saved");
        toast("Saved to tracker", { action: { label: "View", onClick: () => router.push("/tracker") } });
      }
    },
    [signedIn, tracker, requireSignIn, router],
  );

  const createAlert = useCallback(async () => {
    if (!signedIn) return requireSignIn("Sign in to get emailed when new jobs match your filters");
    const parts = [
      get("q") && `“${get("q")}”`,
      ...list("category"),
      ...list("seniority"),
      ...list("visa").map((v) => VISA_LABEL[v]),
      get("remote") && "Remote",
      get("company") && (feed.jobs.find((j) => j.company_slug === get("company"))?.company_name ?? get("company")),
    ].filter(Boolean);
    const res = await fetch("/api/me/searches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: parts.join(" · ") || "All new jobs", query: feed.query, alertsEnabled: true }),
    });
    if (res.ok) toast.success("Alert created", { description: "We'll email you when new jobs match these filters.", action: { label: "Manage", onClick: () => router.push("/account") } });
    else toast.error("Couldn't create the alert. Try again.");
  }, [signedIn, requireSignIn, get, list, feed.jobs, feed.query, router]);

  const hide = useCallback(
    async (job: Job) => {
      if (!signedIn) return requireSignIn("Sign in to hide jobs you're not interested in");
      const idx = feed.jobs.findIndex((j) => j.id === job.id);
      const next = feed.jobs[idx + 1] ?? feed.jobs[idx - 1];
      const undoLocal = feed.removeLocal(job.id);
      if (selRef.current === job.id && next) select(next.id);
      const res = await fetch("/api/me/hidden", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jobId: job.id }) });
      if (!res.ok) {
        undoLocal();
        return toast.error("Couldn't hide that job");
      }
      toast("Hidden from your feed and alerts", {
        action: {
          label: "Undo",
          onClick: () => {
            undoLocal();
            fetch(`/api/me/hidden?jobId=${encodeURIComponent(job.id)}`, { method: "DELETE" });
          },
        },
      });
    },
    [signedIn, requireSignIn, feed, select],
  );

  // The company took a posting down since the last crawl: drop it from the list and move on.
  const gone = useCallback(
    (id: string) => {
      const idx = feed.jobs.findIndex((j) => j.id === id);
      if (idx === -1) return;
      const next = feed.jobs[idx + 1] ?? feed.jobs[idx - 1];
      const title = feed.jobs[idx].title;
      feed.removeLocal(id);
      if (isDesktop && selRef.current === id && next) {
        select(next.id);
        toast(`“${title}” was just taken down by the company`, { description: "We've removed it from your feed." });
      }
    },
    [feed, isDesktop, select],
  );

  const filterCompany = useCallback(
    (slug: string) => {
      update({ company: slug, job: null, q: null });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [update],
  );

  // Keyboard: j/k or ↓/↑ move, s saves, Esc closes the mobile sheet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey || !isDesktop) return;
      const idx = feed.jobs.findIndex((j) => j.id === selRef.current);
      if (e.key === "j" || (e.key === "ArrowDown" && isDesktop)) {
        const next = feed.jobs[Math.min(feed.jobs.length - 1, idx + 1)];
        if (next) {
          e.preventDefault();
          select(next.id);
          document.getElementById(`job-${next.id}`)?.scrollIntoView({ block: "nearest" });
          if (idx >= feed.jobs.length - 4) feed.loadMore();
        }
      } else if (e.key === "k" || (e.key === "ArrowUp" && isDesktop)) {
        const prev = feed.jobs[Math.max(0, idx - 1)];
        if (prev) {
          e.preventDefault();
          select(prev.id);
          document.getElementById(`job-${prev.id}`)?.scrollIntoView({ block: "nearest" });
        }
      } else if (e.key === "s" || e.key === "x") {
        const job = feed.jobs.find((j) => j.id === selRef.current);
        if (job) (e.key === "s" ? toggleSave : hide)(job);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [feed, isDesktop, select, toggleSave, hide]);

  // Infinite scroll
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => es[0].isIntersecting && feed.loadMore(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [feed.loadMore]); // eslint-disable-line react-hooks/exhaustive-deps

  const companyName = get("company") ? feed.jobs.find((j) => j.company_slug === get("company"))?.company_name ?? null : null;
  const rows = feed.loading ? feed.stale : feed.jobs;
  const detailProps = {
    now: feed.now,
    signedIn,
    onStatus: setStatus,
    onRemove: (id: string) => tracker.remove(id),
    onSelect: select,
    onFilterCompany: filterCompany,
    onHide: hide,
    onGone: gone,
  };

  const railCount = RAIL_PARAMS.filter((k) => get(k)).length;
  const reset = () =>
    update({ q: null, loc: null, minSalary: null, since: null, visa: null, category: null, seniority: null, ats: null, maxExp: null, remote: null, company: null, us: null });
  const heading = companyName ? `${companyName} jobs` : get("q") ? `“${get("q")}”` : forYouActive ? "Picked for you" : "Fresh jobs";

  const results = feed.error ? (
    <div className="rounded-3xl border border-line bg-surface p-10 text-center text-sm text-muted">{feed.error}</div>
  ) : !rows ? (
    view === "cards" ? (
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <JobCardSkeleton key={i} />)}</ul>
    ) : (
      <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">{Array.from({ length: 8 }, (_, i) => <JobRowSkeleton key={i} />)}</ul>
    )
  ) : rows.length === 0 && !feed.loading ? (
    <EmptyState onReset={reset} />
  ) : view === "cards" ? (
    <ul className={cn("grid grid-cols-[minmax(0,1fr)] gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3", feed.loading && "opacity-50")}>
      {rows.map((j) => (
        <JobCard key={j.id} job={j} now={feed.now} status={tracker.items[j.id]?.status} onOpen={select} onToggleSave={toggleSave} onHide={hide} />
      ))}
    </ul>
  ) : (
    <ul className={cn("divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface shadow-sm transition-opacity", feed.loading && "opacity-50")}>
      {rows.map((j) => (
        <JobRow key={j.id} job={j} now={feed.now} selected={isDesktop && j.id === selectedId} status={tracker.items[j.id]?.status} onSelect={select} onToggleSave={toggleSave} onHide={hide} />
      ))}
    </ul>
  );

  return (
    <>
      <SearchDeck
        hero={hero}
        onCreateAlert={createAlert}
        onOpenFilters={() => setFiltersOpen(true)}
        filterCount={railCount}
        forYou={{ active: forYouActive, hasPrefs: !!prefs.prefs, onClick: () => setEditingPrefs(true) }}
      />

      <div className="mx-auto grid w-full max-w-[1320px] grid-cols-[minmax(0,1fr)] gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside aria-label="Filters" className="hidden lg:block">
          <div className="no-scrollbar sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pb-6">
            <FilterRail companyName={companyName} />
          </div>
        </aside>

        <section aria-label="Job results" className="min-w-0">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <h2 className="truncate font-display text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]">{heading}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-accent" />
                {feed.total === null ? "Loading…" : `${feed.total.toLocaleString()} open ${feed.total === 1 ? "role" : "roles"}`}
                {feed.lastRun && <span className="text-subtle">· boards checked {ago(feed.lastRun, feed.now, true)}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex h-10 items-center gap-2 rounded-full border border-line bg-surface pl-4 pr-2 text-sm shadow-sm">
                <span className="text-subtle">Sort</span>
                <select
                  value={get("sort") === "salary" ? "salary" : "new"}
                  onChange={(e) => update({ sort: e.target.value === "salary" ? "salary" : null, job: null })}
                  className="cursor-pointer bg-transparent pr-1 font-medium outline-none"
                >
                  <option value="new">Newest first</option>
                  <option value="salary">Highest salary</option>
                </select>
              </label>
              <div role="radiogroup" aria-label="Layout" className="flex h-10 items-center rounded-full border border-line bg-surface p-1 shadow-sm">
                {([
                  ["cards", LayoutGrid, "Cards"],
                  ["list", Rows3, "List"],
                ] as const).map(([v, Icon, label]) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={view === v}
                    aria-label={`${label} view`}
                    title={`${label} view`}
                    onClick={() => setView(v)}
                    className={cn("grid h-8 w-9 place-items-center rounded-full transition-colors", view === v ? "bg-primary text-primary-fg" : "text-subtle hover:text-fg")}
                  >
                    <Icon size={16} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {feed.pendingCount > 0 && (
            <button
              type="button"
              onClick={() => {
                feed.showPending();
                document.querySelector('[aria-label="Job results"]')?.scrollIntoView({ behavior: "smooth" });
              }}
              className="fade-up mb-4 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-3 text-sm font-semibold text-ink-fg hover:bg-ink-3"
            >
              <ArrowUp size={15} className="text-lime" />
              {feed.pendingCount >= 30 ? "30+" : feed.pendingCount} new {feed.pendingCount === 1 ? "job" : "jobs"} just found. Show {feed.pendingCount === 1 ? "it" : "them"}
            </button>
          )}

          {view === "list" && wide ? (
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-5">
              <div className="min-w-0">{results}</div>
              <aside aria-label="Job details" className="min-w-0">
                <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-3xl border border-line bg-surface shadow-sm">
                  {selectedId ? (
                    <JobDetail key={selectedId} jobId={selectedId} preview={selectedPreview} status={tracker.items[selectedId]?.status} {...detailProps} />
                  ) : (
                    <div className="grid h-96 place-items-center text-sm text-muted">{feed.loading ? "" : "Select a job to see the details"}</div>
                  )}
                </div>
              </aside>
            </div>
          ) : (
            results
          )}

          <div ref={sentinel} />
          {feed.loadingMore && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted">
              <Loader2 size={15} className="animate-spin" /> Loading more…
            </div>
          )}
          {!feed.loading && !feed.hasMore && feed.jobs.length > 0 && (
            <p className="py-8 text-center text-sm text-subtle">That&apos;s every open role matching your filters.</p>
          )}
        </section>
      </div>

      {prefs.loaded && (
        <Onboarding
          key={editingPrefs ? "edit" : "first"}
          open={showOnboarding}
          initial={prefs.prefs}
          signedIn={signedIn}
          onSave={applyPrefs}
          onSkip={() => {
            prefs.dismiss();
            setEditingPrefs(false);
          }}
        />
      )}

      {/* Details drawer: Cards view, or List view on smaller screens */}
      <Dialog.Root open={!isDesktop && !!urlJob} onOpenChange={(o) => !o && closeSheet()}>
        <Dialog.Portal>
          <Dialog.Overlay className="overlay-in fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" />
          <Dialog.Content
            aria-describedby={undefined}
            className="panel-in fixed inset-0 z-50 overflow-y-auto bg-surface shadow-lg outline-none sm:inset-y-3 sm:left-auto sm:right-3 sm:w-[620px] sm:rounded-3xl"
          >
            <Dialog.Title className="sr-only">Job details</Dialog.Title>
            {urlJob && <JobDetail key={urlJob} jobId={urlJob} preview={feed.jobs.find((j) => j.id === urlJob)} status={tracker.items[urlJob]?.status} onClose={closeSheet} {...detailProps} />}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Filters sheet on phones and tablets */}
      <Dialog.Root open={filtersOpen} onOpenChange={setFiltersOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="overlay-in fixed inset-0 z-40 bg-black/40" />
          <Dialog.Content aria-describedby={undefined} className="sheet-in fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-3xl bg-surface outline-none">
            <div className="flex justify-center px-5 pb-3 pt-3">
              <Dialog.Title className="sr-only">Filters</Dialog.Title>
              <span aria-hidden className="h-1 w-10 rounded-full bg-line-strong" />
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-4">
              <FilterRail companyName={companyName} />
            </div>
            <div className="border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button variant="primary" size="lg" className="w-full" onClick={() => setFiltersOpen(false)}>
                Show {feed.total === null ? "" : feed.total.toLocaleString()} {feed.total === 1 ? "job" : "jobs"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-line-strong px-6 py-16 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 text-subtle">
        <SearchX size={22} />
      </div>
      <h3 className="font-semibold">No jobs match these filters</h3>
      <p className="mt-1 max-w-xs text-sm text-muted">Try fewer filters, a broader search, or “Anywhere” for location. You can also create an alert and we&apos;ll email you when one appears.</p>
      <Button className="mt-5" onClick={onReset}>Reset filters</Button>
    </div>
  );
}
