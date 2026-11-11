"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, MapPin, Plane, Search, SlidersHorizontal, UserRound, Wifi, X } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { useUrlState } from "./useFeed";

function Chip({ active, children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      {...props}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-2 rounded-[10px] px-3 text-sm font-medium transition-colors",
        active ? "bg-ink-fg text-ink" : "text-ink-fg/85 ring-1 ring-inset ring-ink-line hover:bg-ink-3 hover:text-ink-fg",
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
  const fieldCls = "h-14 w-full bg-transparent text-[16px] text-ink-fg outline-none placeholder:text-ink-muted";

  return (
    <section className="bg-ink text-ink-fg">
      <div className="mx-auto max-w-[1320px] px-4 pb-8 pt-6 sm:px-6 sm:pb-10 sm:pt-12">
        {hero}
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: q.trim() || null, loc: loc.trim() || null, job: null });
            input.current?.blur();
          }}
          className="rounded-2xl bg-ink-2 p-1 ring-1 ring-ink-line transition-colors focus-within:ring-ink-muted/50"
        >
          <div className="flex flex-col md:flex-row md:items-center">
            <label className="relative flex flex-1 items-center gap-3 px-4">
              <Search size={18} strokeWidth={1.5} className="shrink-0 text-ink-muted" />
              <input ref={input} enterKeyHint="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Job title, skill or company" aria-label="Search jobs" className={fieldCls} />
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
              <MapPin size={18} strokeWidth={1.5} className="shrink-0 text-ink-muted" />
              <input enterKeyHint="search" value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="City, state or country" aria-label="Location" className={fieldCls} />
              {loc && (
                <button type="button" aria-label="Clear location" onClick={() => setLoc("")} className="grid h-7 w-7 place-items-center rounded-full text-ink-muted hover:bg-ink-3 hover:text-ink-fg">
                  <X size={15} />
                </button>
              )}
            </label>
            <button type="submit" className="m-1 hidden h-12 rounded-xl bg-ink-fg px-6 text-[15px] font-medium text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] transition-colors hover:bg-white md:ml-2 md:block">
              Search
            </button>
          </div>
        </form>

        <div className="no-scrollbar -mx-4 mt-3 flex items-center gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
          <Chip active={forYou.active} onClick={forYou.onClick}>
            <UserRound size={16} strokeWidth={1.5} /> {forYou.hasPrefs ? "For you" : "Personalize"}
          </Chip>
          <Chip active={get("remote") === "1"} onClick={() => update({ remote: get("remote") === "1" ? null : "1", job: null })}>
            <Wifi size={16} strokeWidth={1.5} /> Remote
          </Chip>
          <Chip active={visaOnly} onClick={() => update({ visa: visaOnly ? null : "Yes", job: null })}>
            <Plane size={16} strokeWidth={1.5} /> Sponsors visa
          </Chip>
          <div className="flex h-9 shrink-0 items-center gap-3 rounded-[10px] px-3 text-sm ring-1 ring-inset ring-ink-line">
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
            <span className={cn("w-12 font-semibold tabular-nums", salary ? "text-ink-fg" : "text-ink-fg/85")}>{fmtK(salary)}</span>
          </div>
          <Chip onClick={onOpenFilters} className="order-first lg:hidden">
            <SlidersHorizontal size={16} strokeWidth={1.5} /> Filters{filterCount ? ` · ${filterCount}` : ""}
          </Chip>
          <Chip onClick={onCreateAlert} className="lg:ml-auto">
            <Bell size={16} strokeWidth={1.5} /> Create alert
          </Chip>
        </div>
      </div>
    </section>
  );
}
