import { cn } from "./cn";

type Tone = "neutral" | "accent" | "danger" | "warn" | "info" | "outline" | "strong";
const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted font-medium",
  accent: "bg-accent-soft text-accent-soft-fg font-medium",
  danger: "bg-danger-soft text-danger font-medium",
  warn: "bg-warn-soft text-warn font-medium",
  info: "bg-info-soft text-info font-medium",
  outline: "border border-line text-muted font-medium",
  strong: "border border-line-strong text-fg font-semibold",
};

export function Badge({ tone = "neutral", className, children, title }: { tone?: Tone; className?: string; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] leading-4 whitespace-nowrap", TONES[tone], className)}>
      {children}
    </span>
  );
}
