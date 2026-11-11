"use client";

import { useEffect, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Bell, Check, ChevronDown, Globe2, Search, SlidersHorizontal, Sparkles, Wifi, X } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { useUrlState } from "./useFeed";
import { ATS_LABEL, VISA_LABEL } from "./format";

const CATEGORIES = ["Engineering", "Data & AI", "Product", "Design", "Sales", "Marketing", "Customer", "Operations", "People", "Finance & Legal", "Other"];
const LEVELS = ["Intern", "Entry", "Mid", "Senior", "Staff/Lead", "Director+"];
const POSTED = [
  ["", "Any time"],
  ["1", "Past hour"],
  ["24", "Past 24 hours"],
  ["72", "Past 3 days"],
  ["168", "Past week"],
] as const;

function Pill({ active, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
        active ? "border-transparent bg-accent-soft text-accent-soft-fg" : "border-line bg-surface text-muted hover:border-line-strong hover:text-fg",
        props.className,
      )}
    >
      {children}
    </button>
  );
}

function Menu({ label, active, children, align = "start" }: { label: React.ReactNode; active?: boolean; children: React.ReactNode; align?: "start" | "end" }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Pill active={active}>
          {label}
          <ChevronDown size={13} className="opacity-60" />
        </Pill>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={6}
          collisionPadding={12}
          className="fade-up z-50 w-64 rounded-xl border border-line bg-surface p-1.5 shadow-lg outline-none"
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Option({ checked, onClick, children, radio }: { checked: boolean; onClick: () => void; children: React.ReactNode; radio?: boolean }) {
  return (
    <button
      type="button"
      role={radio ? "menuitemradio" : "menuitemcheckbox"}
      aria-checked={checked}
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-surface-2"
    >
      <span
        className={cn(
          "grid h-4 w-4 shrink-0 place-items-center border transition-colors",
          radio ? "rounded-full" : "rounded",
          checked ? "border-accent bg-accent text-accent-fg" : "border-line-strong",
        )}
      >
        {checked && <Check size={11} strokeWidth={3} />}
      </span>
      {children}
    </button>
  );
}

const MenuTitle = ({ children }: { children: React.ReactNode }) => <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-subtle">{children}</div>;

export function FilterBar({
  total,
  onCreateAlert,
  companyName,
  forYou,
}: {
  total: number | null;
  onCreateAlert: () => void;
  companyName?: string | null;
  forYou?: { active: boolean; hasPrefs: boolean; onClick: () => void };
}) {
  const { get, list, update } = useUrlState();
  const [q, setQ] = useState(get("q"));
  const input = useRef<HTMLInputElement>(null);

  // Debounce typing into the URL.
  useEffect(() => {
    const t = setTimeout(() => q !== get("q") && update({ q: q.trim() || null }), 250);
    return () => clearTimeout(t);
  }, [q, get, update]);

  // "/" focuses search, like most search-first apps.
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

  const toggle = (key: string, value: string) => {
    const cur = list(key);
    update({ [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] });
  };
  const summary = (key: string, label: string) => {
    const v = list(key);
    return v.length === 0 ? label : v.length === 1 ? (key === "visa" ? VISA_LABEL[v[0]] : v[0]) : `${label} · ${v.length}`;
  };

  const since = get("since");
  const usOnly = get("us") !== "0";
  const moreCount = list("ats").length + (get("maxExp") ? 1 : 0);
  const anyFilter = ["q", "since", "visa", "category", "seniority", "ats", "maxExp", "remote", "company"].some((k) => get(k)) || !usOnly;

  return (
    <div className="space-y-2.5">
      <div className="flex gap-2">
        <label className="group relative flex-1">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle group-focus-within:text-accent" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && (setQ(""), e.currentTarget.blur())}
            placeholder="Search jobs or companies"
            aria-label="Search jobs"
            className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-16 text-[15px] shadow-sm outline-none transition-[border,box-shadow] placeholder:text-subtle focus:border-accent focus:ring-4 focus:ring-[var(--ring)]"
          />
          {q ? (
            <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-subtle hover:bg-surface-2 hover:text-fg">
              <X size={15} />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-line px-1.5 font-mono text-[11px] text-subtle sm:block">/</kbd>
          )}
        </label>
        <button
          type="button"
          onClick={onCreateAlert}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-sm font-medium shadow-sm hover:border-line-strong hover:bg-surface-2"
        >
          <Bell size={16} className="text-accent" />
          <span className="hidden sm:inline">Create alert</span>
        </button>
      </div>

      <div className="no-scrollbar -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {forYou && (
          <>
            <Pill active={forYou.active} onClick={forYou.onClick} title="Edit your preferences">
              <Sparkles size={13} />
              {forYou.hasPrefs ? "For you" : "Personalize"}
            </Pill>
            <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-line" />
          </>
        )}
        <Menu label={POSTED.find(([v]) => v === since)?.[1] ?? "Any time"} active={!!since}>
          <MenuTitle>Discovered</MenuTitle>
          {POSTED.map(([v, label]) => (
            <Option key={v} radio checked={since === v} onClick={() => update({ since: v || null })}>{label}</Option>
          ))}
        </Menu>

        <Menu label={summary("category", "Role")} active={list("category").length > 0}>
          <MenuTitle>Role</MenuTitle>
          <div className="max-h-72 overflow-y-auto">
            {CATEGORIES.map((c) => (
              <Option key={c} checked={list("category").includes(c)} onClick={() => toggle("category", c)}>{c}</Option>
            ))}
          </div>
        </Menu>

        <Menu label={summary("seniority", "Level")} active={list("seniority").length > 0}>
          <MenuTitle>Experience level</MenuTitle>
          {LEVELS.map((c) => (
            <Option key={c} checked={list("seniority").includes(c)} onClick={() => toggle("seniority", c)}>{c}</Option>
          ))}
        </Menu>

        <Menu label={summary("visa", "Visa")} active={list("visa").length > 0}>
          <MenuTitle>Visa sponsorship</MenuTitle>
          {(["Yes", "Maybe", "No"] as const).map((v) => (
            <Option key={v} checked={list("visa").includes(v)} onClick={() => toggle("visa", v)}>
              <span className="flex-1">{VISA_LABEL[v]}</span>
            </Option>
          ))}
          <p className="px-2.5 pb-1.5 pt-1 text-xs text-subtle">Read from each job description. Always confirm with the employer.</p>
        </Menu>

        <Pill active={get("remote") === "1"} onClick={() => update({ remote: get("remote") === "1" ? null : "1" })} aria-pressed={get("remote") === "1"}>
          <Wifi size={13} /> Remote
        </Pill>

        <Menu label={<><Globe2 size={13} />{usOnly ? "United States" : "Anywhere"}</>} active={!usOnly}>
          <MenuTitle>Location</MenuTitle>
          <Option radio checked={usOnly} onClick={() => update({ us: null })}>United States</Option>
          <Option radio checked={!usOnly} onClick={() => update({ us: "0" })}>Anywhere</Option>
        </Menu>

        <Menu label={<><SlidersHorizontal size={13} />More{moreCount ? ` · ${moreCount}` : ""}</>} active={moreCount > 0} align="end">
          <MenuTitle>Max years of experience required</MenuTitle>
          <div className="px-2.5 pb-3 pt-1">
            <input
              type="range"
              min={0}
              max={15}
              value={get("maxExp") || 15}
              onChange={(e) => update({ maxExp: e.target.value === "15" ? null : e.target.value })}
              className="w-full accent-[var(--accent)]"
              aria-label="Max years of experience"
            />
            <div className="mt-1 text-xs text-muted">{get("maxExp") ? `${get("maxExp")} years or less` : "Any"}</div>
          </div>
          <MenuTitle>Source</MenuTitle>
          {Object.entries(ATS_LABEL).map(([k, label]) => (
            <Option key={k} checked={list("ats").includes(k)} onClick={() => toggle("ats", k)}>{label}</Option>
          ))}
        </Menu>

        {get("company") && (
          <Pill active onClick={() => update({ company: null })} aria-label="Remove company filter">
            {companyName ?? get("company")} <X size={13} />
          </Pill>
        )}

        {anyFilter && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              update({ q: null, since: null, visa: null, category: null, seniority: null, ats: null, maxExp: null, remote: null, company: null, us: null });
            }}
            className="h-8 shrink-0 px-2 text-[13px] text-muted underline-offset-2 hover:text-fg hover:underline"
          >
            Reset
          </button>
        )}

        <span className="ml-auto hidden shrink-0 pl-2 text-[13px] tabular-nums text-subtle sm:inline">
          {total === null ? "" : `${total.toLocaleString()} ${total === 1 ? "job" : "jobs"}`}
        </span>
      </div>
    </div>
  );
}
