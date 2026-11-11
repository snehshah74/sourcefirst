"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Globe2, MapPin, Plane, Sparkles, Wifi, X } from "lucide-react";
import { LEVEL_OPTIONS, ROLE_OPTIONS, type Prefs } from "@/lib/prefs";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
        on ? "border-accent bg-accent-soft text-accent-soft-fg" : "border-line bg-surface text-muted hover:border-line-strong hover:text-fg",
      )}
    >
      {on && <Check size={14} strokeWidth={2.75} />}
      {children}
    </button>
  );
}

function Choice({ on, onClick, icon: Icon, title, hint }: { on: boolean; onClick: () => void; icon: typeof Globe2; title: string; hint: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "flex flex-1 items-start gap-2.5 rounded-xl border p-3 text-left transition-colors",
        on ? "border-accent bg-accent-soft/60" : "border-line bg-surface hover:border-line-strong",
      )}
    >
      <Icon size={17} className={cn("mt-0.5 shrink-0", on ? "text-accent" : "text-subtle")} />
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
    </button>
  );
}

const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <section>
    <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-surface-3 text-[11px] text-muted">{n}</span>
      {title}
    </h3>
    {children}
  </section>
);

/** "What are you looking for?": four quick questions that become the default feed filters. */
export function Onboarding({
  open,
  initial,
  signedIn,
  onSave,
  onSkip,
}: {
  open: boolean;
  initial: Prefs | null;
  signedIn: boolean;
  onSave: (p: Prefs, digest: boolean) => void;
  onSkip: () => void;
}) {
  const [p, setP] = useState<Prefs>(initial ?? { roles: [], levels: [], remote: false, location: "us", needVisa: false });
  const [digest, setDigest] = useState(true);
  const toggle = (k: "roles" | "levels", v: string) => setP((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }));

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onSkip()}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay-in fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
        <Dialog.Content
          className="sheet-in fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl border border-line bg-surface shadow-lg outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[560px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
        >
          <header className="flex items-start gap-3 border-b border-line p-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><Sparkles size={19} /></span>
            <div className="flex-1">
              <Dialog.Title className="text-lg font-semibold tracking-tight">What are you looking for?</Dialog.Title>
              <Dialog.Description className="text-sm text-muted">We&apos;ll tailor the feed. Change it any time from “For you”.</Dialog.Description>
            </div>
            <Dialog.Close className="grid h-8 w-8 place-items-center rounded-lg text-subtle hover:bg-surface-2 hover:text-fg" aria-label="Skip">
              <X size={17} />
            </Dialog.Close>
          </header>

          <div className="flex-1 space-y-6 overflow-y-auto p-5">
            <Step n={1} title="Roles">
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map((r) => <Chip key={r} on={p.roles.includes(r)} onClick={() => toggle("roles", r)}>{r}</Chip>)}
              </div>
            </Step>
            <Step n={2} title="Experience level">
              <div className="flex flex-wrap gap-2">
                {LEVEL_OPTIONS.map((r) => <Chip key={r} on={p.levels.includes(r)} onClick={() => toggle("levels", r)}>{r}</Chip>)}
              </div>
            </Step>
            <Step n={3} title="Where">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Choice on={p.location === "us"} onClick={() => setP({ ...p, location: "us" })} icon={MapPin} title="United States" hint="US-based roles" />
                <Choice on={p.location === "anywhere"} onClick={() => setP({ ...p, location: "anywhere" })} icon={Globe2} title="Anywhere" hint="Include other countries" />
              </div>
              <label className="mt-2.5 flex cursor-pointer items-center gap-2.5 text-sm">
                <input type="checkbox" checked={p.remote} onChange={(e) => setP({ ...p, remote: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
                <Wifi size={15} className="text-subtle" /> Remote only
              </label>
            </Step>
            <Step n={4} title="Visa">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Choice on={!p.needVisa} onClick={() => setP({ ...p, needVisa: false })} icon={Check} title="I don't need sponsorship" hint="Show every job" />
                <Choice on={p.needVisa} onClick={() => setP({ ...p, needVisa: true })} icon={Plane} title="I need sponsorship" hint="Hide jobs that rule it out" />
              </div>
            </Step>
          </div>

          <footer className="space-y-3 border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {signedIn && (
              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl bg-surface-2 px-3 py-2.5 text-sm">
                <input type="checkbox" checked={digest} onChange={(e) => setDigest(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
                Email me a daily digest of new matches
              </label>
            )}
            <div className="flex gap-2">
              <Button variant="ghost" size="lg" onClick={onSkip}>Skip</Button>
              <Button variant="primary" size="lg" className="flex-1" onClick={() => onSave(p, signedIn && digest)}>
                Show my jobs
              </Button>
            </div>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
