"use client";

import Link from "next/link";
import { useState } from "react";
import { BellOff, BellRing, Search, Trash2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "./ui/Button";
import { toast } from "./ui/Toaster";
import { cn } from "./ui/cn";

interface SavedSearch {
  id: number;
  name: string;
  query: string;
  alertsEnabled: boolean;
  frequency: string;
}

const LABELS: Record<string, string> = { since: "", us: "", remote: "Remote", maxExp: "Max years", ats: "Source", company: "Company", q: "Search" };

/** "category=Engineering&visa=Yes" → ["Engineering", "Visa: Yes"] for display. */
function describe(query: string): string[] {
  const out: string[] = [];
  new URLSearchParams(query).forEach((v, k) => {
    if (k === "us") out.push(v === "0" ? "Anywhere" : "United States");
    else if (k === "remote") out.push("Remote");
    else if (k === "visa") out.push(...v.split(",").map((x) => (x === "Yes" ? "Sponsors visa" : x === "No" ? "No sponsorship" : "Visa not stated")));
    else if (k === "category" || k === "seniority") out.push(...v.split(","));
    else if (k === "q") out.push(`“${v}”`);
    else if (LABELS[k] !== "") out.push(`${LABELS[k] ?? k}: ${v}`);
  });
  if (!new URLSearchParams(query).has("us")) out.push("United States");
  return out;
}

/** Shown until the account's email is confirmed; alerts are held back until then. */
export function ConfirmEmail({ email }: { email: string }) {
  const [sent, setSent] = useState(false);
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-info-soft px-3.5 py-2.5 text-[13px] text-info">
      Confirm {email} to start getting alerts. Check your inbox for the link.
      <button
        type="button"
        disabled={sent}
        onClick={async () => {
          const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/account" });
          if (error) toast.error("Couldn't send the email", { description: error.message });
          else setSent(true);
        }}
        className="font-medium underline underline-offset-2 disabled:no-underline disabled:opacity-70"
      >
        {sent ? "Sent" : "Send it again"}
      </button>
    </p>
  );
}

export default function SavedSearches({ initial }: { initial: SavedSearch[] }) {
  const [items, setItems] = useState(initial);

  async function toggle(s: SavedSearch) {
    setItems((xs) => xs.map((x) => (x.id === s.id ? { ...x, alertsEnabled: !x.alertsEnabled } : x)));
    const res = await fetch("/api/me/searches", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: s.id, alertsEnabled: !s.alertsEnabled }) });
    if (!res.ok) {
      setItems((xs) => xs.map((x) => (x.id === s.id ? s : x)));
      toast.error("Couldn't update the alert");
    } else toast(s.alertsEnabled ? "Alert paused" : "Alert on");
  }

  async function setFrequency(s: SavedSearch, frequency: string) {
    setItems((xs) => xs.map((x) => (x.id === s.id ? { ...x, frequency } : x)));
    const res = await fetch("/api/me/searches", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: s.id, frequency }) });
    if (!res.ok) {
      setItems((xs) => xs.map((x) => (x.id === s.id ? s : x)));
      toast.error("Couldn't update the alert");
    } else toast(frequency === "instant" ? "You'll get an email within minutes of a match" : "You'll get one email a day");
  }

  async function remove(s: SavedSearch) {
    setItems((xs) => xs.filter((x) => x.id !== s.id));
    const res = await fetch(`/api/me/searches?id=${s.id}`, { method: "DELETE" });
    if (!res.ok) {
      setItems((xs) => [...xs, s]);
      toast.error("Couldn't delete the alert");
    } else toast("Alert deleted");
  }

  if (!items.length)
    return (
      <div className="mt-4 flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-10 text-center">
        <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent"><BellRing size={18} /></div>
        <p className="text-sm font-medium">No alerts yet</p>
        <p className="mt-1 max-w-sm text-sm text-muted">
          Set some filters on the <Link href="/" className="font-medium text-fg underline">job feed</Link>, then click <b>Create alert</b>.
        </p>
      </div>
    );

  return (
    <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      {items.map((s) => (
        <li key={s.id} className="flex items-center gap-3 p-4">
          <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", s.alertsEnabled ? "bg-accent-soft text-accent" : "bg-surface-2 text-subtle")}>
            {s.alertsEnabled ? <BellRing size={16} /> : <BellOff size={16} />}
          </div>
          <div className="min-w-0 flex-1">
            <Link href={`/?${s.query}`} className="block truncate text-sm font-semibold hover:text-accent">{s.name}</Link>
            <div className="mt-1 flex flex-wrap gap-1">
              {describe(s.query).map((t) => <span key={t} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">{t}</span>)}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <select
              aria-label={`How often to email ${s.name}`}
              value={s.frequency}
              disabled={!s.alertsEnabled}
              onChange={(e) => setFrequency(s, e.target.value)}
              className="mr-1 hidden h-8 rounded-lg border border-line bg-surface px-2 text-xs font-medium text-muted outline-none hover:border-line-strong disabled:opacity-50 min-[480px]:block"
            >
              <option value="instant">Instant</option>
              <option value="daily">Daily digest</option>
            </select>
            <Link href={`/?${s.query}`} aria-label="Open search" title="Open search" className="grid h-8 w-8 place-items-center rounded-lg text-subtle hover:bg-surface-2 hover:text-fg">
              <Search size={15} />
            </Link>
            <button
              type="button"
              role="switch"
              aria-checked={s.alertsEnabled}
              aria-label={`Email alerts for ${s.name}`}
              onClick={() => toggle(s)}
              className={cn("relative h-5 w-9 rounded-full transition-colors", s.alertsEnabled ? "bg-accent" : "bg-line-strong")}
            >
              <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left]", s.alertsEnabled ? "left-[18px]" : "left-0.5")} />
            </button>
            <Button variant="ghost" size="icon-sm" aria-label={`Delete ${s.name}`} title="Delete" onClick={() => remove(s)} className="hover:!text-danger">
              <Trash2 size={15} />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
