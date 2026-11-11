"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, BookmarkCheck, Building2, Search, UserRound } from "lucide-react";
import { cn } from "./ui/cn";

const LINKS = [
  { href: "/", label: "Jobs", icon: Search },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/tracker", label: "Tracker", icon: BookmarkCheck },
  { href: "/account", label: "Alerts", icon: Bell },
];

export function NavLinks({ className }: { className?: string }) {
  const path = usePathname();
  return (
    <nav className={cn("items-center gap-1", className)}>
      {LINKS.map(({ href, label }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition-colors", active ? "bg-surface-2 text-fg" : "text-muted hover:text-fg")}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** App-style bottom navigation on phones. */
export function MobileTabBar({ signedIn }: { signedIn: boolean }) {
  const path = usePathname();
  const items = signedIn ? LINKS : [...LINKS.slice(0, 3), { href: "/sign-in", label: "Sign in", icon: UserRound }];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden" aria-label="Primary">
      <div className="grid grid-cols-4">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link key={label} href={href} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-accent" : "text-subtle")}>
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
