"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "./cn";

type Theme = "system" | "light" | "dark";
const KEY = "sf-theme";
const listeners = new Set<() => void>();

function read(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}
function set(t: Theme) {
  try {
    if (t === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {}
  if (t === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  listeners.forEach((l) => l());
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    read,
    () => "system" as Theme,
  );
  const opts: [Theme, typeof Sun, string][] = [
    ["light", Sun, "Light"],
    ["system", Monitor, "System"],
    ["dark", Moon, "Dark"],
  ];
  return (
    <div role="radiogroup" aria-label="Theme" className={cn("inline-flex rounded-lg border border-line bg-surface p-0.5", className)}>
      {opts.map(([t, Icon, label]) => (
        <button
          key={t}
          role="radio"
          aria-checked={theme === t}
          aria-label={label}
          title={label}
          onClick={() => set(t)}
          className={cn("grid h-7 w-7 place-items-center rounded-md transition-colors", theme === t ? "bg-surface-3 text-fg" : "text-subtle hover:text-fg")}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
