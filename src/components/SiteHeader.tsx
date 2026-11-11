import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { Logo } from "./ui/Logo";
import { ThemeToggle } from "./ui/ThemeToggle";
import { buttonClass } from "./ui/Button";
import { NavLinks, MobileTabBar } from "./NavLinks";
import UserMenu from "./UserMenu";

export default async function SiteHeader() {
  const user = await currentUser();
  return (
    <>
      <header className="sticky top-0 z-30 h-14 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-[1320px] items-center gap-6 px-4 sm:px-6">
          <Logo />
          <NavLinks className="hidden sm:flex" />
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden md:block"><ThemeToggle /></div>
            {user ? (
              <UserMenu name={user.name || user.email} email={user.email} />
            ) : (
              <>
                <Link href="/sign-in" className={buttonClass("ghost", "sm")}>Sign in</Link>
                <Link href="/sign-up" className={buttonClass("primary", "sm")}>Sign up free</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <MobileTabBar signedIn={!!user} />
    </>
  );
}
