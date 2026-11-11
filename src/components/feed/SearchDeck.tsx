"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CalendarClock, MapPin, Plane, Search, SlidersHorizontal, Sparkles, Wifi, X } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { useUrlState } from "./useFeed";

function Chip({ active, children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      {...props}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors",
        active ? "bg-lime text-lime-fg" : "text-ink-fg/85 ring-1 ring-inset ring-ink-line hover:bg-ink-3 hover:text-ink-fg",
        className,
      )}
    >
      {children}
    </button>
  );
}

const fmtK = (n: number) => (n ? `$${n}k+` : "Any");

/** The dark search deck: keywords, location, and the quick filters people use most. */
export function SearchDeck({
  hero,
  onCreateAlert,
  onOpenFilters,
  filterCount,
  forYou,
}: {
  hero?: React.ReactNode;
  onCreateAlert: () => void;
  onOpenFilters: () => void;
  filterCount: number;
  forYou: { active: boolean; hasPrefs: boolean; onClick: () => void };
}) {
  const { get, list, update } = useUrlState();
  const [q, setQ] = useState(get("q"));
  const [loc, setLoc] = useState(get("loc"));
  const [salary, setSalary] = useState(Number(get("minSalary") || 0) / 1000);
  const input = useRef<HTMLInputElement>(null);

  // Typing updates the results as you go (debounced); Enter/Search applies immediately.
  useEffect(() => {
    const t = setTimeout(() => {
      if (q.trim() !== get("q") || loc.trim() !== get("loc")) update({ q: q.trim() || null, loc: loc.trim() || null, job: null });
    }, 300);
    return () => clearTimeout(t);
  }, [q, loc, get, update]);
  useEffect(() => {
    const t = setTimeout(() => {
      const v = salary ? String(salary * 1000) : null;
      if ((v ?? "") !== get("minSalary")) update({ minSalary: v, job: null });
    }, 200);
    return () => clearTimeout(t);
  }, [salary, get, update]);

  // "/" jumps to search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) && !el.isContentEditable) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visaOnly = list("visa").length === 1 && list("visa")[0] === "Yes";
  const today = get("since") === "24";
  const fieldCls = "h-14 w-full bg-transparent text-[16px] text-ink-fg outline-none placeholder:text-ink-muted";

  return (
    <section className="bg-ink text-ink-fg">
      <div className="mx-auto max-w-[1320px] px-4 pb-7 pt-6 sm:px-6 sm:pb-9 sm:pt-8">
        {hero}
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: q.trim() || null, loc: loc.trim() || null, job: null });
            input.current?.blur();
          }}
          className="rounded-[22px] bg-ink-2 p-1.5 ring-1 ring-ink-line focus-within:ring-ink-muted/50"
        >
          <div className="flex flex-col md:flex-row md:items-center">
            <label className="relative flex flex-1 items-center gap-3 px-4">
              <Search size={20} className="shrink-0 text-ink-muted" />
              <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Job title, skill or company" aria-label="Search jobs" className={fieldCls} />
              {q ? (
                <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="grid h-7 w-7 place-items-center rounded-full text-ink-muted hover:bg-ink-3 hover:text-ink-fg">
                  <X size={15} />
                </button>
              ) : (
                <kbd className="hidden rounded-md border border-ink-line px-1.5 font-mono text-[11px] text-ink-muted sm:block">/</kbd>
              )}
            </label>
            <span aria-hidden className="mx-4 h-px bg-ink-line md:mx-0 md:h-8 md:w-px" />
            <label className="relative flex items-center gap-3 px-4 md:w-[300px]">
              <MapPin size={20} className="shrink-0 text-ink-muted" />
              <input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="City, state or country" aria-label="Location" className={fieldCls} />
              {loc && (
                <button type="button" aria-label="Clear location" onClick={() => setLoc("")} className="grid h-7 w-7 place-items-center rounded-full text-ink-muted hover:bg-ink-3 hover:text-ink-fg">
                  <X size={15} />
                </button>
              )}
            </label>
            <button type="submit" className="m-1 h-12 rounded-[16px] bg-lime px-7 text-[15px] font-semibold text-lime-fg transition-colors hover:bg-lime-hover md:ml-2">
              Search
            </button>
          </div>
        </form>

        <div className="no-scrollbar -mx-4 mt-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <Chip active={forYou.active} onClick={forYou.onClick}>
            <Sparkles size={15} /> {forYou.hasPrefs ? "For you" : "Personalize"}
          </Chip>
          <Chip active={get("remote") === "1"} onClick={() => update({ remote: get("remote") === "1" ? null : "1", job: null })}>
            <Wifi size={15} /> Remote
          </Chip>
          <Chip active={visaOnly} onClick={() => update({ visa: visaOnly ? null : "Yes", job: null })}>
            <Plane size={15} /> Sponsors visa
          </Chip>
          <Chip active={today} onClick={() => update({ since: today ? null : "24", job: null })}>
            <CalendarClock size={15} /> Last 24 hours
          </Chip>
          <div className="flex h-10 shrink-0 items-center gap-3 rounded-full px-4 text-sm ring-1 ring-inset ring-ink-line">
            <span className="text-ink-muted">Min salary</span>
            <input
              type="range"
              min={0}
              max={300}
              step={10}
              value={salary}
              onChange={(e) => setSalary(Number(e.target.value))}
              aria-label="Minimum yearly salary"
              aria-valuetext={fmtK(salary)}
              className="range-ink w-28"
            />
            <span className={cn("w-12 font-semibold tabular-nums", salary ? "text-lime" : "text-ink-fg/85")}>{fmtK(salary)}</span>
          </div>
          <Chip onClick={onOpenFilters} className="lg:hidden">
            <SlidersHorizontal size={15} /> Filters{filterCount ? ` · ${filterCount}` : ""}
          </Chip>
          <Chip onClick={onCreateAlert} className="sm:ml-auto">
            <Bell size={15} className="text-lime" /> Create alert
          </Chip>
        </div>
      </div>
    </section>
  );
}
