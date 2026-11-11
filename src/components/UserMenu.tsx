"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { Activity, Bell, BookmarkCheck, LogOut } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { ThemeToggle } from "./ui/ThemeToggle";

const item = "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-surface-2";

export default function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const initials = name.split(/[\s@]/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  return (
    <Dropdown.Root>
      <Dropdown.Trigger
        aria-label="Account menu"
        className="grid h-9 w-9 place-items-center rounded-full bg-ink-3 text-[13px] font-medium text-ink-fg outline-none ring-1 ring-ink-line ring-offset-2 ring-offset-ink hover:bg-ink-line focus-visible:ring-2 focus-visible:ring-ink-fg"
      >
        {initials || "?"}
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content align="end" sideOffset={8} className="fade-up z-50 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-lg">
          <div className="px-2.5 pb-2 pt-1.5">
            <div className="truncate text-sm font-semibold">{name}</div>
            <div className="truncate text-xs text-muted">{email}</div>
          </div>
          <Dropdown.Separator className="my-1 h-px bg-line" />
          <Dropdown.Item asChild className={item}><Link href="/tracker"><BookmarkCheck size={16} className="text-subtle" />Tracker</Link></Dropdown.Item>
          <Dropdown.Item asChild className={item}><Link href="/account"><Bell size={16} className="text-subtle" />Alerts & account</Link></Dropdown.Item>
          <Dropdown.Item asChild className={item}><Link href="/status"><Activity size={16} className="text-subtle" />Pipeline status</Link></Dropdown.Item>
          <Dropdown.Separator className="my-1 h-px bg-line" />
          <div className="flex items-center justify-between px-2.5 py-1.5 text-sm text-muted md:hidden">
            Theme <ThemeToggle />
          </div>
          <Dropdown.Item
            className={item}
            onSelect={async () => {
              await signOut();
              router.push("/");
              router.refresh();
            }}
          >
            <LogOut size={16} className="text-subtle" />Sign out
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
