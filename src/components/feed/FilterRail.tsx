"use client";

import { useState } from "react";
import { Check, Search, X } from "lucide-react";
import { PLACES } from "@/lib/places";
import { POPULAR_SKILLS, SKILL_NAMES } from "@/lib/skills";
import { cn } from "@/components/ui/cn";
import { useUrlState } from "./useFeed";
import { ATS_LABEL, VISA_LABEL } from "./format";

const POSTED = [
  ["", "Any time"],
  ["1", "Past hour"],
  ["24", "Past 24 hours"],
  ["72", "Past 3 days"],
  ["168", "Past week"],
] as const;
const ROLES = ["Engineering", "Data & AI", "Product", "Design", "Sales", "Marketing", "Customer", "Operations", "People", "Finance & Legal", "Other"];
const LEVELS = ["Intern", "Entry", "Mid", "Senior", "Staff/Lead", "Director+"];

/** Filter params owned by the rail (the search deck owns q, loc, remote, minSalary). */
export const RAIL_PARAMS = ["since", "category", "seniority", "visa", "us", "place", "skills", "maxExp", "ats", "company"];

const PLACE_NAMES = PLACES.map((p) => p.name);
const REGION_SET = new Set(PLACES.filter((p) => !p.region).map((p) => p.name));
const POPULAR_PLACES = ["Canada", "United Kingdom", "India", "Germany", "Europe", "Asia-Pacific", "Latin America"];

function Box({ checked, radio }: { checked: boolean; radio?: boolean }) {
  return (
    <span
      className={cn(
        "grid h-[18px] w-[18px] shrink-0 place-items-center border transition-colors",
        radio ? "rounded-full" : "rounded-[5px]",
        checked ? "border-fg bg-fg text-bg" : "border-line-strong bg-surface group-hover:border-muted",
      )}
    >
      {checked && (radio ? <span className="h-1.5 w-1.5 rounded-full bg-bg" /> : <Check size={12} strokeWidth={3} />)}
    </span>
  );
}

function Row({ checked, onClick, radio, children }: { checked: boolean; onClick: () => void; radio?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" role={radio ? "radio" : "checkbox"} aria-checked={checked} onClick={onClick} className="group flex w-full items-center gap-3 py-2 text-left text-[14.5px]">
      <Box checked={checked} radio={radio} />
      <span className={checked ? "font-medium text-fg" : "text-fg/80"}>{children}</span>
    </button>
  );
}

function Section({ title, children, more }: { title: string; children: React.ReactNode; more?: React.ReactNode }) {
  return (
    <section className="border-t border-line py-4 first:border-t-0 first:pt-0">
      <h3 className="mb-1.5 text-[13px] font-medium text-subtle">{title}</h3>
      {children}
      {more}
    </section>
  );
}

/** Type to find an option; picked ones show as chips you can remove. */
function SearchPick({ label, options, popular, selected, onAdd, onRemove, hint }: {
  label: string;
  options: string[];
  popular: string[];
  selected: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  hint?: (v: string) => string | undefined;
}) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const matches = term
    ? options.filter((o) => !selected.includes(o) && o.toLowerCase().includes(term))
        .sort((a, b) => Number(!a.toLowerCase().startsWith(term)) - Number(!b.toLowerCase().startsWith(term)))
        .slice(0, 8)
    : [];
  const pick = (v: string) => {
    onAdd(v);
    setQ("");
  };
  return (
    <div>
      {selected.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {selected.map((v) => (
            <button key={v} type="button" onClick={() => onRemove(v)} aria-label={`Remove ${v}`} className="inline-flex items-center gap-1 rounded-lg bg-fg py-1 pl-2.5 pr-1.5 text-[13px] font-medium text-bg transition-opacity hover:opacity-85">
              {v}
              <X size={13} strokeWidth={2.5} />
            </button>
          ))}
        </div>
      )}
      <label className="flex h-9 items-center gap-2 rounded-[10px] border border-line bg-surface px-2.5 focus-within:border-muted">
        <Search size={15} className="shrink-0 text-subtle" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches[0]) {
              e.preventDefault();
              pick(matches[0]);
            }
            if (e.key === "Escape") setQ("");
          }}
          placeholder={label}
          aria-label={label}
          className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-subtle"
        />
      </label>
      {term ? (
        <ul className="mt-1.5">
          {matches.length === 0 && <li className="py-1.5 text-sm text-subtle">No match for “{q.trim()}”</li>}
          {matches.map((o) => (
            <li key={o}>
              <button type="button" onClick={() => pick(o)} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[14px] hover:bg-surface-2">
                {o}
                {hint?.(o) && <span className="text-xs text-subtle">{hint(o)}</span>}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {popular.filter((o) => !selected.includes(o)).map((o) => (
            <button key={o} type="button" onClick={() => pick(o)} className="rounded-lg border border-line px-2 py-1 text-[13px] text-muted transition-colors hover:border-muted hover:text-fg">
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** All the precise filters, as a scannable column (desktop) or inside the mobile filter sheet. */
export function FilterRail({ companyName }: { companyName?: string | null }) {
  const { get, list, update } = useUrlState();
  const [allRoles, setAllRoles] = useState(false);
  const toggle = (key: string, v: string) => {
    const cur = list(key);
    update({ [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v], job: null });
  };
  const since = get("since");
  // No pick means the US-only default; "Anywhere" (us=0) means no country filter at all.
  const places = list("place").length ? list("place") : get("us") !== "0" ? ["United States"] : [];
  const setPlaces = (next: string[]) =>
    update({
      place: next.length && !(next.length === 1 && next[0] === "United States") ? next : null,
      us: next.length ? null : "0",
      job: null,
    });
  const active = RAIL_PARAMS.some((k) => get(k)) ;

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-display text-[22px] font-medium tracking-tight">Filters</h2>
        {active && (
          <button type="button" onClick={() => update({ ...Object.fromEntries(RAIL_PARAMS.map((k) => [k, null])), job: null })} className="text-sm text-muted underline-offset-2 hover:text-fg hover:underline">
            Clear
          </button>
        )}
      </div>

      {get("company") && (
        <Section title="Company">
          <Row checked onClick={() => update({ company: null, job: null })}>{companyName ?? get("company")}</Row>
        </Section>
      )}

      <Section title="Found">
        <div role="radiogroup" aria-label="Found">
          {POSTED.map(([v, label]) => (
            <Row key={v} radio checked={since === v} onClick={() => update({ since: v || null, job: null })}>{label}</Row>
          ))}
        </div>
      </Section>

      <Section
        title="Role"
        more={
          <button type="button" onClick={() => setAllRoles((x) => !x)} className="mt-1 text-sm font-medium text-muted hover:text-fg">
            {allRoles ? "Show less" : `Show all ${ROLES.length}`}
          </button>
        }
      >
        {(allRoles ? ROLES : ROLES.filter((r, i) => i < 6 || list("category").includes(r))).map((r) => (
          <Row key={r} checked={list("category").includes(r)} onClick={() => toggle("category", r)}>{r}</Row>
        ))}
      </Section>

      <Section title="Experience level">
        {LEVELS.map((r) => <Row key={r} checked={list("seniority").includes(r)} onClick={() => toggle("seniority", r)}>{r}</Row>)}
      </Section>

      <Section title="Visa sponsorship">
        {(["Yes", "Maybe", "No"] as const).map((v) => (
          <Row key={v} checked={list("visa").includes(v)} onClick={() => toggle("visa", v)}>{VISA_LABEL[v]}</Row>
        ))}
      </Section>

      <Section title="Country or region">
        <SearchPick
          label="Search countries or regions"
          options={PLACE_NAMES}
          popular={POPULAR_PLACES}
          selected={places}
          onAdd={(v) => setPlaces([...places, v])}
          onRemove={(v) => setPlaces(places.filter((x) => x !== v))}
          hint={(v) => (REGION_SET.has(v) ? "Region" : undefined)}
        />
        <Row checked={places.length === 0} onClick={() => setPlaces(places.length ? [] : ["United States"])}>Anywhere in the world</Row>
      </Section>

      <Section title="Skills">
        <SearchPick
          label="Search skills, e.g. SQL"
          options={SKILL_NAMES}
          popular={POPULAR_SKILLS}
          selected={list("skills")}
          onAdd={(v) => update({ skills: [...list("skills"), v], job: null })}
          onRemove={(v) => update({ skills: list("skills").filter((x) => x !== v), job: null })}
        />
        {list("skills").length > 1 && <p className="mt-2 text-xs text-subtle">Showing jobs that ask for any of these.</p>}
      </Section>

      <Section title={`Max years required${get("maxExp") ? `: ${get("maxExp")}` : ""}`}>
        <input
          type="range"
          min={0}
          max={15}
          value={get("maxExp") || 15}
          onChange={(e) => update({ maxExp: e.target.value === "15" ? null : e.target.value, job: null })}
          className="mt-1 w-full accent-[var(--fg)]"
          aria-label="Max years of experience required"
        />
        <div className="flex justify-between text-xs text-subtle"><span>0</span><span>Any</span></div>
      </Section>

      <Section title="Source">
        {Object.entries(ATS_LABEL).map(([k, label]) => (
          <Row key={k} checked={list("ats").includes(k)} onClick={() => toggle("ats", k)}>{label}</Row>
        ))}
      </Section>
    </div>
  );
}
