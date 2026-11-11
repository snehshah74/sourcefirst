"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CompanyLogo } from "./ui/CompanyLogo";

interface C { slug: string; name: string; domain: string | null; open_jobs: number }

export default function CompanyDirectory({ companies }: { companies: C[] }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? companies.filter((c) => c.name.toLowerCase().includes(t) || c.domain?.includes(t)) : companies;
  }, [q, companies]);
  return (
    <>
      <label className="group relative mb-5 block max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle group-focus-within:text-accent" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Filter ${companies.length} companies`}
          aria-label="Filter companies"
          className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-3 text-[15px] shadow-sm outline-none placeholder:text-subtle focus:border-accent focus:ring-4 focus:ring-[var(--ring)]"
        />
      </label>
      <ul className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((c) => (
          <li key={c.slug}>
            <Link href={`/companies/${c.slug}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-sm transition-[border,transform] hover:-translate-y-px hover:border-line-strong">
              <CompanyLogo name={c.name} domain={c.domain} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{c.name}</span>
                <span className="block text-xs text-muted">{c.open_jobs.toLocaleString()} open {c.open_jobs === 1 ? "role" : "roles"}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {!shown.length && <p className="py-10 text-center text-sm text-muted">No company matches “{q}”.</p>}
    </>
  );
}
