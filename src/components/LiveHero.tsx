"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CompanyLogo } from "./ui/CompanyLogo";
import { ago, cleanTitle } from "./feed/format";

const EVERY_MS = 15 * 60_000;
const calm = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A number that counts up to its value once, so the size of the feed lands as you arrive. */
export function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const done = useRef(false);
  useEffect(() => {
    if (done.current || calm()) return;
    done.current = true;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1100);
      setShown(Math.round(value * (1 - Math.pow(1 - p, 4))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className="tabular-nums">{shown.toLocaleString()}</span>;
}

/** The current time, ticking every second (0 until mounted, so server and client markup match). */
function useNow() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const clock = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(clock);
    };
  }, []);
  return now;
}

/** When the boards were last read, polled every minute. */
function useLastRun(initial: string | null) {
  const [lastRun, setLastRun] = useState(initial);
  useEffect(() => {
    const poll = setInterval(async () => {
      const s = await fetch("/api/stats").then((r) => r.json()).catch(() => null);
      if (s?.lastRun) setLastRun(s.lastRun);
    }, 60_000);
    return () => clearInterval(poll);
  }, []);
  return lastRun;
}

/** "Updated every 15 minutes", with a bar that fills toward the next check. */
export function NextCheck({ lastRun: initial }: { lastRun: string | null }) {
  const lastRun = useLastRun(initial);
  const now = useNow();
  const since = lastRun && now ? now - new Date(lastRun).getTime() : null;
  const left = since === null ? null : EVERY_MS - since;
  const label =
    left === null ? "" : left <= 0 ? "checking now" : `next check in ${Math.floor(left / 60_000)}:${String(Math.floor((left % 60_000) / 1000)).padStart(2, "0")}`;
  return (
    <div className="mt-6 flex max-w-sm flex-col gap-2">
      <p className="flex items-center gap-2 text-sm text-ink-muted">
        <span className="live-dot h-1.5 w-1.5 rounded-full bg-accent" />
        Updated every 15 minutes
        {label && <span className="font-mono text-xs tabular-nums">· {label}</span>}
      </p>
      <div className="h-px w-full overflow-hidden bg-ink-line" aria-hidden>
        <div
          className="h-full bg-accent transition-[width] duration-1000 ease-linear"
          style={{ width: since === null ? "0%" : `${Math.min(100, (since / EVERY_MS) * 100)}%` }}
        />
      </div>
    </div>
  );
}

type Row = { id: string; title: string; company_name: string; company_domain: string | null; first_seen_at: string | Date };

/** The newest roles, one per company. New ones slide in as the crawler finds them. */
export function JustFound({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const now = useNow();
  useEffect(() => {
    const poll = setInterval(async () => {
      const d = await fetch("/api/jobs?us=0").then((r) => r.json()).catch(() => null);
      if (!d?.jobs) return;
      setRows((cur) => {
        const seen = new Set(cur.map((r) => r.id));
        const byCompany = new Map<string, Row>();
        for (const j of [...d.jobs, ...cur] as Row[]) if (!byCompany.has(j.company_name)) byCompany.set(j.company_name, j);
        const next = [...byCompany.values()].slice(0, 5);
        setFresh(new Set(next.filter((r) => !seen.has(r.id)).map((r) => r.id)));
        return next;
      });
    }, 60_000);
    return () => clearInterval(poll);
  }, []);

  return (
    <ul>
      {rows.map((j) => (
        <li key={j.id} className={fresh.has(j.id) ? "row-in" : undefined}>
          <Link
            href={`/?job=${encodeURIComponent(j.id)}`}
            className="grid grid-cols-[56px_28px_minmax(0,1fr)] items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-ink-3"
          >
            <span className="whitespace-nowrap font-mono text-xs tabular-nums text-accent">{now ? ago(j.first_seen_at, now) : ""}</span>
            <CompanyLogo name={j.company_name} domain={j.company_domain} size={28} className="!rounded-lg !border-0" />
            <span className="min-w-0">
              <span className="block truncate text-sm text-ink-fg">{cleanTitle(j.title)}</span>
              <span className="block truncate text-xs text-ink-muted">{j.company_name}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
