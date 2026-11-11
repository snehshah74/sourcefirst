"use client";

import { useState } from "react";
import { Check } from "lucide-react";
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
export const RAIL_PARAMS = ["since", "category", "seniority", "visa", "us", "maxExp", "ats", "company"];

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
    <button type="button" role={radio ? "radio" : "checkbox"} aria-checked={checked} onClick={onClick} className="group flex w-full items-center gap-3 py-[7px] text-left text-[14.5px]">
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

/** All the precise filters, as a scannable column (desktop) or inside the mobile filter sheet. */
export function FilterRail({ companyName }: { companyName?: string | null }) {
  const { get, list, update } = useUrlState();
  const [allRoles, setAllRoles] = useState(false);
  const toggle = (key: string, v: string) => {
    const cur = list(key);
    update({ [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v], job: null });
  };
  const since = get("since");
  const us = get("us") !== "0";
  const active = RAIL_PARAMS.some((k) => get(k)) ;

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-display text-[22px] font-semibold tracking-tight">Filters</h2>
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

      <Section title="Location">
        <div role="radiogroup" aria-label="Location">
          <Row radio checked={us} onClick={() => update({ us: null, job: null })}>United States</Row>
          <Row radio checked={!us} onClick={() => update({ us: "0", job: null })}>Anywhere</Row>
        </div>
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
