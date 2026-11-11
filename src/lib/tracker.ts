"use client";
import { useCallback, useEffect, useState } from "react";
import type { JobRow } from "./types";

export const STATUSES = ["Saved", "Applied", "Interviewing", "Offer", "Rejected"] as const;
export type Status = (typeof STATUSES)[number];

export interface TrackedJob {
  jobId: string;
  job: JobRow; // snapshot, so the tracker survives the posting closing
  status: Status;
  notes: string;
  updatedAt: string;
}
type Items = Record<string, TrackedJob>;

/** Saved jobs + application tracker, stored on the user's account (/api/me/saved). */
export function useTracker(signedIn: boolean) {
  const [items, setItems] = useState<Items>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    fetch("/api/me/saved")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { items: TrackedJob[] }) => alive && setItems(Object.fromEntries(d.items.map((i) => [i.jobId, i]))))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [signedIn]);

  const save = useCallback(async (jobId: string, patch: { status?: Status; notes?: string }, optimistic: TrackedJob | null, prev: TrackedJob | undefined) => {
    setItems((p) => (optimistic ? { ...p, [jobId]: optimistic } : p));
    const res = await fetch("/api/me/saved", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jobId, ...patch }) });
    if (!res.ok) {
      setError("Couldn't save. Try again.");
      setItems((p) => {
        const n = { ...p };
        if (prev) n[jobId] = prev;
        else delete n[jobId];
        return n;
      });
      return;
    }
    const { item } = (await res.json()) as { item: TrackedJob };
    setItems((p) => ({ ...p, [jobId]: item }));
  }, []);

  const setStatus = useCallback(
    (job: JobRow, status: Status) => {
      const prev = items[job.id];
      const optimistic: TrackedJob = { jobId: job.id, job, status, notes: prev?.notes ?? "", updatedAt: new Date().toISOString() };
      return save(job.id, { status }, optimistic, prev);
    },
    [items, save],
  );

  const setNotes = useCallback(
    (jobId: string, notes: string) => {
      const prev = items[jobId];
      if (!prev || prev.notes === notes) return;
      return save(jobId, { notes }, { ...prev, notes }, prev);
    },
    [items, save],
  );

  const remove = useCallback(
    async (jobId: string) => {
      const prev = items[jobId];
      setItems((p) => {
        const n = { ...p };
        delete n[jobId];
        return n;
      });
      const res = await fetch(`/api/me/saved?jobId=${encodeURIComponent(jobId)}`, { method: "DELETE" });
      if (!res.ok && prev) setItems((p) => ({ ...p, [jobId]: prev }));
    },
    [items],
  );

  return { items, error, setStatus, setNotes, remove };
}
