"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { JobRow } from "@/lib/types";

const PAGE = 30;

/** Filter state lives in the URL (shareable, back button works). Writes use the History API so
 *  changing a filter doesn't re-render the server page; Next keeps useSearchParams in sync. */
export function useUrlState() {
  const sp = useSearchParams();
  const get = useCallback((k: string) => sp.get(k) ?? "", [sp]);
  const list = useCallback((k: string) => (sp.get(k) ?? "").split(",").filter(Boolean), [sp]);
  const update = useCallback(
    (patch: Record<string, string | string[] | null>, mode: "replace" | "push" = "replace") => {
      const next = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(patch)) {
        const s = Array.isArray(v) ? v.join(",") : v;
        if (s) next.set(k, s);
        else next.delete(k);
      }
      const qs = next.toString();
      const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
      if (mode === "push") window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    },
    [],
  );
  return { sp, get, list, update };
}

/** The query that defines the result set: every URL param except UI-only ones. */
function feedQuery(sp: URLSearchParams) {
  const p = new URLSearchParams();
  sp.forEach((v, k) => {
    if (!["job", "tab"].includes(k)) p.set(k, v);
  });
  p.sort();
  return p.toString();
}

interface Page {
  jobs: JobRow[];
  total: number;
  /** true when there are more matches than the server counts ("10,000+") */
  capped?: boolean;
}

export function useFeed(guest: boolean) {
  const { sp } = useUrlState();
  const query = useMemo(() => feedQuery(sp), [sp]);

  const [state, setState] = useState<{ query: string; jobs: JobRow[]; total: number; capped?: boolean; page: number; now: number } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pending, setPending] = useState<{ query: string; data: Page; count: number } | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // First page whenever the filters change
  useEffect(() => {
    let alive = true;
    fetch(`/api/jobs?${query}&pageSize=${PAGE}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: Page) => {
        if (!alive) return;
        setState({ query, jobs: d.jobs, total: d.total, capped: d.capped, page: 1, now: Date.now() });
        setPending(null);
        setError(null);
      })
      .catch(() => alive && setError("Couldn't load jobs. Check your connection and try again."));
    return () => {
      alive = false;
    };
  }, [query]);

  const loadMore = useCallback(async () => {
    if (guest || !state || loadingMore || state.jobs.length >= state.total) return;
    setLoadingMore(true);
    try {
      const d: Page = await fetch(`/api/jobs?${state.query}&pageSize=${PAGE}&page=${state.page + 1}`).then((r) => r.json());
      setState((s) => {
        if (!s || s.query !== state.query) return s;
        const seen = new Set(s.jobs.map((j) => j.id));
        return { ...s, jobs: [...s.jobs, ...d.jobs.filter((j) => !seen.has(j.id))], total: d.total, capped: d.capped, page: s.page + 1 };
      });
    } finally {
      setLoadingMore(false);
    }
  }, [guest, state, loadingMore]);

  // Live updates: check every 60s (and when the tab comes back) for newly discovered jobs.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      if (document.visibilityState !== "visible") return;
      const stats = await fetch("/api/stats").then((r) => r.json()).catch(() => null);
      if (!alive || !stats) return;
      setLastRun(stats.lastRun);
      const cur = stateRef.current;
      setState((s) => (s ? { ...s, now: Date.now() } : s));
      if (!cur || cur.query !== query) return;
      const fresh: Page | null = await fetch(`/api/jobs?${query}&pageSize=${PAGE}`).then((r) => r.json()).catch(() => null);
      if (!alive || !fresh) return;
      const top = cur.jobs[0]?.id;
      const idx = fresh.jobs.findIndex((j) => j.id === top);
      const count = top ? (idx === -1 ? fresh.jobs.length : idx) : 0;
      setPending(count > 0 ? { query, data: fresh, count } : null);
    };
    poll();
    const t = setInterval(poll, 60_000);
    const onVis = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [query]);

  const showPending = useCallback(() => {
    if (!pending) return;
    setState({ query: pending.query, jobs: pending.data.jobs, total: pending.data.total, capped: pending.data.capped, page: 1, now: Date.now() });
    setPending(null);
  }, [pending]);

  /** Drop a job from the visible list right away (e.g. "not interested"); returns a function that puts it back. */
  const removeLocal = useCallback((id: string) => {
    let removed: { job: JobRow; index: number } | null = null;
    setState((s) => {
      if (!s) return s;
      const index = s.jobs.findIndex((j) => j.id === id);
      if (index === -1) return s;
      removed = { job: s.jobs[index], index };
      return { ...s, jobs: s.jobs.filter((j) => j.id !== id), total: s.total - 1 };
    });
    return () =>
      setState((s) => {
        if (!s || !removed || s.jobs.some((j) => j.id === id)) return s;
        const jobs = [...s.jobs];
        jobs.splice(removed.index, 0, removed.job);
        return { ...s, jobs, total: s.total + 1 };
      });
  }, []);

  const ready = state?.query === query;
  return {
    query,
    jobs: ready ? state!.jobs : [],
    total: ready ? state!.total : null,
    /** the total as people read it: "10,000+" when the count stopped early */
    totalLabel: ready ? `${state!.total.toLocaleString()}${state!.capped ? "+" : ""}` : "",
    stale: state && !ready ? state.jobs : null, // previous results, dimmed while the new ones load
    loading: !ready,
    loadingMore,
    hasMore: !guest && ready && state!.jobs.length < state!.total,
    loadMore,
    now: state?.now ?? 0,
    lastRun,
    error,
    pendingCount: pending?.query === query ? pending.count : 0,
    removeLocal,
    showPending,
  };
}
