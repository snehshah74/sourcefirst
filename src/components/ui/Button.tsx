import { forwardRef } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm" | "icon-lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg hover:bg-primary-hover shadow-sm",
  secondary: "bg-surface text-fg border border-line hover:border-line-strong hover:bg-surface-2 shadow-sm",
  ghost: "text-muted hover:text-fg hover:bg-surface-2",
  danger: "bg-danger-soft text-danger hover:brightness-95",
};
const SIZES: Record<Size, string> = {
  sm: "h-8 px-2.5 text-[13px] gap-1.5 rounded-lg",
  md: "h-9 px-3.5 text-sm gap-2 rounded-lg",
  lg: "h-11 px-5 text-[15px] gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-lg",
  "icon-sm": "h-8 w-8 rounded-lg",
  "icon-lg": "h-11 w-11 rounded-xl",
};

export const buttonClass = (variant: Variant = "secondary", size: Size = "md", extra?: string) =>
  cn(
    "inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 select-none",
    VARIANTS[variant],
    SIZES[size],
    extra,
  );

export const Button = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }>(
  function Button({ variant = "secondary", size = "md", className, type = "button", ...props }, ref) {
    return <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...props} />;
  },
);
