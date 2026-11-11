import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { Logo } from "./ui/Logo";
import { ThemeToggle } from "./ui/ThemeToggle";
import { NavLinks, MobileTabBar } from "./NavLinks";
import UserMenu from "./UserMenu";

export default async function SiteHeader() {
  const user = await currentUser();
  return (
    <>
      <header className="sticky top-0 z-30 h-16 border-b border-ink-line bg-ink text-ink-fg">
        <div className="mx-auto flex h-full max-w-[1320px] items-center gap-8 px-4 sm:px-6">
          <Logo tone="ink" />
          <NavLinks className="hidden sm:flex" />
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden md:block"><ThemeToggle tone="ink" /></div>
            {user ? (
              <UserMenu name={user.name || user.email} email={user.email} />
            ) : (
              <>
                <Link href="/sign-in" className="hidden whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium text-ink-muted hover:text-ink-fg sm:inline-flex">Sign in</Link>
                <Link href="/sign-up" className="whitespace-nowrap rounded-full bg-lime px-4 py-2 text-sm font-semibold text-lime-fg hover:bg-lime-hover">
                  Sign up<span className="hidden sm:inline"> free</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <MobileTabBar signedIn={!!user} />
    </>
  );
}
