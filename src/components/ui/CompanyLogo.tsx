"use client";
import { useState } from "react";
import { cn } from "./cn";

/** Company favicon via our /api/logo proxy, falling back to initials. */
export function CompanyLogo({ name, domain, size = 40, className }: { name: string; domain: string | null; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  if (domain && !failed)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/logo?domain=${domain}`}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        onError={() => setFailed(true)}
        style={style}
        className={cn("shrink-0 rounded-[10px] border border-line bg-white object-contain p-1", className)}
      />
    );
  const initials = name.replace(/[^A-Za-z0-9 ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  return (
    <div style={style} className={cn("grid shrink-0 place-items-center rounded-[10px] bg-surface-3 text-xs font-semibold text-muted", className)}>
      {initials}
    </div>
  );
}
