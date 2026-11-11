import Link from "next/link";
import { cn } from "./cn";

/** `ink`: for the dark header (lime mark). Default: for light surfaces (green mark). */
function LogoMark({ size = 28, tone = "default" }: { size?: number; tone?: "ink" | "default" }) {
  const bg = tone === "ink" ? "var(--lime)" : "var(--accent)";
  const fg = tone === "ink" ? "var(--lime-fg)" : "var(--accent-fg)";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="10" fill={bg} />
      <path d="M10 21.5 21.5 10M13.5 10h8v8" stroke={fg} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function Logo({ className, tone = "default" }: { className?: string; tone?: "ink" | "default" }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2.5", className)} aria-label="SourceFirst home">
      <LogoMark tone={tone} />
      <span className="font-display text-[19px] font-semibold tracking-tight">
        Source<span className={tone === "ink" ? "text-lime" : "text-accent"}>First</span>
      </span>
    </Link>
  );
}
