import Link from "next/link";
import { cn } from "./cn";

/**
 * The origin point: a lime signal at the source with a ring around it. The ring follows the text color
 * and the dot keeps an ink edge, so the same mark reads on the ink header and on light pages.
 */
function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <circle cx="12" cy="12" r="10.75" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      <circle cx="12" cy="12" r="5.5" fill="var(--lime)" stroke="#0e0f12" strokeWidth="1" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2", className)} aria-label="SourceFirst home">
      <LogoMark />
      <span className="font-display text-[18px] font-medium tracking-tight">SourceFirst</span>
    </Link>
  );
}
