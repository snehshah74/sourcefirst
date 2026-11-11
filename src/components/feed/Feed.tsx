"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUp, ArrowUpDown, Loader2, SearchX } from "lucide-react";
import type { JobRow as Job } from "@/lib/types";
import { useTracker, type Status } from "@/lib/tracker";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/components/ui/cn";
import { FilterBar } from "./FilterBar";
import { JobRow, JobRowSkeleton } from "./JobRow";
import { JobDetail } from "./JobDetail";
import { useFeed, useUrlState } from "./useFeed";
import { ago, VISA_LABEL } from "./format";
import { Onboarding } from "./Onboarding";
import { usePrefs } from "./usePrefs";
import { describePrefs, prefsToQuery, type Prefs } from "@/lib/prefs";

/** URL params that are filters (as opposed to UI state like ?job=). */
const FILTER_PARAMS = ["q", "since", "visa", "category", "seniority", "ats", "maxExp", "remote", "company", "us", "sort"];
const PREF_PARAMS = ["category", "seniority", "remote", "us", "visa"];

const DESKTOP = "(min-width: 1024px)";
function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(DESKTOP);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => true,
  );
}

const typing = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  return !!t && (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable);
};

export default function Feed({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const { get, list, update } = useUrlState();
  const feed = useFeed();
  const tracker = useTracker(signedIn);
  const isDesktop = useIsDesktop();
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
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
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

  // Keep the sticky preview just under the sticky filter bar, whatever its height.
  const bar = useRef<HTMLDivElement>(null);
  const [barH, setBarH] = useState(120);
  useEffect(() => {
    if (!bar.current) return;
    const ro = new ResizeObserver(([e]) => setBarH(e.target.getBoundingClientRect().height));
    ro.observe(bar.current);
    return () => ro.disconnect();
  }, []);

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

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 sm:px-6">
      <div ref={bar} className="sticky top-14 z-20 -mx-4 border-b border-line bg-bg/85 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <FilterBar
          total={feed.total}
          onCreateAlert={createAlert}
          companyName={companyName}
          forYou={{ active: forYouActive, hasPrefs: !!prefs.prefs, onClick: () => setEditingPrefs(true) }}
        />
      </div>

      <div className="grid gap-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)]">
        {/* ── Results ── */}
        <section aria-label="Job results" className="min-w-0">
          <div className="mb-2 flex items-center gap-3 px-1 text-xs text-subtle">
            <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
              <span className="live-dot h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              {feed.lastRun ? `Checked ${ago(feed.lastRun, feed.now, true)}` : "Live"}
              {feed.total !== null && <span className="sm:hidden"> · {feed.total.toLocaleString()} jobs</span>}
            </span>
            <span className="ml-auto hidden xl:inline">
              <kbd className="rounded border border-line px-1 font-mono">j</kbd> <kbd className="rounded border border-line px-1 font-mono">k</kbd> browse ·{" "}
              <kbd className="rounded border border-line px-1 font-mono">s</kbd> save · <kbd className="rounded border border-line px-1 font-mono">x</kbd> hide
            </span>
            <label className="relative ml-auto inline-flex shrink-0 items-center gap-1 text-muted xl:ml-0">
              <ArrowUpDown size={12} />
              <span className="sr-only">Sort by</span>
              <select
                value={get("sort") === "salary" ? "salary" : "new"}
                onChange={(e) => update({ sort: e.target.value === "salary" ? "salary" : null, job: null })}
                className="cursor-pointer appearance-none bg-transparent pr-1 font-medium text-muted outline-none hover:text-fg"
              >
                <option value="new">Newest first</option>
                <option value="salary">Highest salary</option>
              </select>
            </label>
          </div>

          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            {feed.pendingCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  feed.showPending();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="fade-up flex w-full items-center justify-center gap-2 border-b border-line bg-accent-soft py-2.5 text-sm font-semibold text-accent-soft-fg hover:brightness-[.98]"
              >
                <ArrowUp size={15} />
                {feed.pendingCount >= 30 ? "30+" : feed.pendingCount} new {feed.pendingCount === 1 ? "job" : "jobs"} just discovered
              </button>
            )}

            {feed.error ? (
              <div className="p-10 text-center text-sm text-muted">{feed.error}</div>
            ) : !rows ? (
              <ul className="divide-y divide-line">{Array.from({ length: 8 }, (_, i) => <JobRowSkeleton key={i} />)}</ul>
            ) : rows.length === 0 && !feed.loading ? (
              <EmptyState onReset={() => update({ q: null, since: null, visa: null, category: null, seniority: null, ats: null, maxExp: null, remote: null, company: null, us: null })} />
            ) : (
              <ul className={cn("divide-y divide-line transition-opacity", feed.loading && "opacity-50")}>
                {rows.map((j) => (
                  <JobRow
                    key={j.id}
                    job={j}
                    now={feed.now}
                    selected={j.id === selectedId}
                    status={tracker.items[j.id]?.status}
                    onSelect={select}
                    onToggleSave={toggleSave}
                    onHide={hide}
                  />
                ))}
              </ul>
            )}

            <div ref={sentinel} />
            {feed.loadingMore && (
              <div className="flex items-center justify-center gap-2 border-t border-line py-4 text-sm text-muted">
                <Loader2 size={15} className="animate-spin" /> Loading more…
              </div>
            )}
            {!feed.loading && !feed.hasMore && feed.jobs.length > 0 && (
              <div className="border-t border-line py-4 text-center text-xs text-subtle">That&apos;s everything matching your filters.</div>
            )}
          </div>
        </section>

        {/* ── Preview (desktop) ── */}
        <aside
          aria-label="Job details"
          className="hidden min-w-0 lg:block"
        >
          <div
            className="sticky overflow-y-auto rounded-2xl border border-line bg-surface shadow-sm"
            style={{ top: 56 + barH + 16, maxHeight: `calc(100dvh - ${56 + barH + 32}px)` }}
          >
            {selectedId ? (
              <JobDetail key={selectedId} jobId={selectedId} preview={selectedPreview} status={tracker.items[selectedId]?.status} {...detailProps} />
            ) : feed.loading ? (
              <div className="h-96" />
            ) : (
              <div className="grid h-96 place-items-center text-sm text-muted">Select a job to see the details</div>
            )}
          </div>
        </aside>
      </div>

      {/* ── Preview (mobile sheet) ── */}
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

      <Dialog.Root open={!isDesktop && !!urlJob} onOpenChange={(o) => !o && closeSheet()}>
        <Dialog.Portal>
          <Dialog.Overlay className="overlay-in fixed inset-0 z-40 bg-black/40" />
          <Dialog.Content
            aria-describedby={undefined}
            className="sheet-in fixed inset-x-0 bottom-0 top-0 z-50 overflow-y-auto bg-surface outline-none sm:top-6 sm:rounded-t-2xl"
          >
            <Dialog.Title className="sr-only">Job details</Dialog.Title>
            {urlJob && <JobDetail key={urlJob} jobId={urlJob} preview={feed.jobs.find((j) => j.id === urlJob)} status={tracker.items[urlJob]?.status} onClose={closeSheet} {...detailProps} />}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 text-subtle">
        <SearchX size={22} />
      </div>
      <h3 className="font-semibold">No jobs match these filters</h3>
      <p className="mt-1 max-w-xs text-sm text-muted">Try fewer filters, a broader search, or “Anywhere” for location. You can also create an alert and we&apos;ll email you when one appears.</p>
      <Button className="mt-5" onClick={onReset}>Reset filters</Button>
    </div>
  );
}
