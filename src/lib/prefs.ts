/** What a user told us in onboarding. Turned into feed filters (URL params) by prefsToQuery. */
export interface Prefs {
  roles: string[]; // categories
  levels: string[]; // seniority
  remote: boolean;
  location: "us" | "anywhere";
  needVisa: boolean;
}

export const ROLE_OPTIONS = ["Engineering", "Data & AI", "Product", "Design", "Sales", "Marketing", "Customer", "Operations", "People", "Finance & Legal"];
export const LEVEL_OPTIONS = ["Intern", "Entry", "Mid", "Senior", "Staff/Lead", "Director+"];

export function cleanPrefs(raw: unknown): Prefs {
  const r = (raw ?? {}) as Partial<Prefs>;
  const pick = (v: unknown, allowed: string[]) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && allowed.includes(x)) : []);
  return {
    roles: pick(r.roles, ROLE_OPTIONS),
    levels: pick(r.levels, LEVEL_OPTIONS),
    remote: r.remote === true,
    location: r.location === "anywhere" ? "anywhere" : "us",
    needVisa: r.needVisa === true,
  };
}

export function prefsToQuery(p: Prefs): URLSearchParams {
  const q = new URLSearchParams();
  if (p.roles.length) q.set("category", p.roles.join(","));
  if (p.levels.length) q.set("seniority", p.levels.join(","));
  if (p.remote) q.set("remote", "1");
  if (p.location === "anywhere") q.set("us", "0");
  if (p.needVisa) q.set("visa", "Yes,Maybe"); // hide only the jobs that rule sponsorship out
  return q;
}

export function describePrefs(p: Prefs): string {
  const parts = [p.roles.length ? p.roles.join(", ") : "All roles", p.levels.length ? p.levels.join(", ") : null, p.remote ? "Remote" : null, p.needVisa ? "Needs visa" : null];
  return parts.filter(Boolean).join(" · ");
}
