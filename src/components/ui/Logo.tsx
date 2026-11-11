import Link from "next/link";
import { cn } from "./cn";

export function LogoMark({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={className}>
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path d="M10 21.5 21.5 10M13.5 10h8v8" stroke="var(--accent-fg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)} aria-label="SourceFirst home">
      <LogoMark />
      <span className="text-[17px]">
        Source<span className="text-accent">First</span>
      </span>
    </Link>
  );
}
