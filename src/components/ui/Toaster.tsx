"use client";
import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      toastOptions={{
        className: "!bg-surface !text-fg !border-line !shadow-lg !rounded-xl !text-sm",
        actionButtonStyle: { background: "var(--accent)", color: "var(--accent-fg)" },
      }}
    />
  );
}
export { toast } from "sonner";
