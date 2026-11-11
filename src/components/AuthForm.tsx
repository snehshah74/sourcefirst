"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Bell, BookmarkCheck, Loader2, MailCheck, Radar } from "lucide-react";
import { Button } from "./ui/Button";
import { Logo } from "./ui/Logo";
import { cn } from "./ui/cn";

type Mode = "sign-in" | "sign-up" | "forgot" | "reset";

const TITLES: Record<Mode, string> = {
  "sign-in": "Welcome back",
  "sign-up": "Create your account",
  forgot: "Reset your password",
  reset: "Choose a new password",
};

export default function AuthForm({ mode, googleEnabled = false }: { mode: Mode; googleEnabled?: boolean }) {
  const router = useRouter();
  const sp = useSearchParams();
  // Only same-site paths: "//evil.com" and "/\evil.com" would leave the site.
  const raw = sp.get("next") ?? "";
  const next = /^\/(?![/\\])/.test(raw) ? raw : "/";
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "");
    const password = String(f.get("password") ?? "");
    setBusy(true);
    setError(null);
    try {
      if (mode === "sign-up") {
        const { error } = await authClient.signUp.email({ email, password, name: String(f.get("name") ?? "") });
        if (error) throw new Error(error.message);
      } else if (mode === "sign-in") {
        const { error } = await authClient.signIn.email({ email, password });
        if (error) throw new Error(error.message);
      } else if (mode === "forgot") {
        const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
        if (error) throw new Error(error.message);
        setNotice("If an account exists for that email, a reset link is on its way.");
        return;
      } else {
        const token = sp.get("token");
        if (!token) throw new Error("This reset link is missing its token. Request a new one.");
        const { error } = await authClient.resetPassword({ newPassword: password, token });
        if (error) throw new Error(error.message);
        router.push("/sign-in?reset=1");
        return;
      }
      router.push(next);
      router.refresh();
    } catch (err) {
      setError((err as Error).message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] outline-none transition-[border,box-shadow] placeholder:text-subtle focus:border-accent focus:ring-4 focus:ring-[var(--ring)]";
  const nextQs = next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  const SUB: Record<Mode, string> = {
    "sign-in": "Pick up where you left off.",
    "sign-up": "Free forever. Save jobs, track applications, get alerts.",
    forgot: "We'll email you a link to choose a new password.",
    reset: "At least 8 characters.",
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Value panel (desktop) */}
      <aside className="relative hidden overflow-hidden border-r border-line bg-surface lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Logo />
        <div className="max-w-md">
          <h2 className="text-[34px] font-semibold leading-[1.1] tracking-tight text-balance">Be the 1st applicant, not the 500th.</h2>
          <ul className="mt-8 space-y-4 text-[15px]">
            {[
              [Radar, "Jobs straight from company career pages, checked every 15 minutes"],
              [Bell, "Email alerts the moment a role matches your filters"],
              [BookmarkCheck, "A tracker for every application, from saved to offer"],
            ].map(([Icon, text], i) => {
              const I = Icon as typeof Radar;
              return (
                <li key={i} className="flex gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"><I size={16} /></span>
                  <span className="pt-1 text-muted">{text as string}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <p className="text-xs text-subtle">Free. No spam. Delete your account any time.</p>
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-soft blur-3xl" />
      </aside>

      {/* Form */}
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <div className="lg:hidden"><Logo /></div>
        <div className="mx-auto my-auto w-full max-w-sm py-10">
          <h1 className="text-2xl font-semibold tracking-tight">{TITLES[mode]}</h1>
          <p className="mt-1.5 text-sm text-muted">{SUB[mode]}</p>
          {sp.get("reset") && mode === "sign-in" && (
            <p className="mt-4 rounded-xl bg-accent-soft px-3.5 py-2.5 text-sm text-accent-soft-fg">Password updated. Sign in with your new password.</p>
          )}

          {googleEnabled && (mode === "sign-in" || mode === "sign-up") && (
            <>
              <Button size="lg" className="mt-7 w-full" onClick={() => authClient.signIn.social({ provider: "google", callbackURL: next })}>
                Continue with Google
              </Button>
              <div className="my-5 flex items-center gap-3 text-xs text-subtle"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
            </>
          )}

          {notice ? (
            <div className="mt-7 flex gap-3 rounded-xl border border-line bg-surface p-4 text-sm">
              <MailCheck size={18} className="shrink-0 text-accent" />
              {notice}
            </div>
          ) : (
            // method="post": if submitted before JS loads, the password must never end up in the URL.
            <form onSubmit={onSubmit} method="post" className={cn("space-y-3", !googleEnabled && "mt-7")}>
              {mode === "sign-up" && (
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-medium">Name</span>
                  <input name="name" autoComplete="name" required className={input} />
                </label>
              )}
              {mode !== "reset" && (
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-medium">Email</span>
                  <input name="email" type="email" autoComplete="email" required className={input} placeholder="you@example.com" />
                </label>
              )}
              {mode !== "forgot" && (
                <label className="block">
                  <span className="mb-1.5 flex items-center justify-between text-[13px] font-medium">
                    {mode === "reset" ? "New password" : "Password"}
                    {mode === "sign-in" && <Link href="/forgot-password" className="font-normal text-muted hover:text-fg">Forgot?</Link>}
                  </span>
                  <input
                    name="password"
                    type="password"
                    autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                    minLength={8}
                    required
                    className={input}
                    placeholder={mode === "sign-in" ? "" : "8+ characters"}
                  />
                </label>
              )}
              {error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
              <Button type="submit" variant="primary" size="lg" disabled={busy} className="!mt-5 w-full">
                {busy && <Loader2 size={16} className="animate-spin" />}
                {mode === "sign-up" ? "Create account" : mode === "sign-in" ? "Sign in" : mode === "forgot" ? "Send reset link" : "Update password"}
              </Button>
            </form>
          )}

          <p className="mt-6 text-sm text-muted">
            {mode === "sign-in" && <>New here? <Link href={`/sign-up${nextQs}`} className="font-medium text-fg hover:text-accent">Create a free account</Link></>}
            {mode === "sign-up" && <>Already have an account? <Link href={`/sign-in${nextQs}`} className="font-medium text-fg hover:text-accent">Sign in</Link></>}
            {(mode === "forgot" || mode === "reset") && <Link href="/sign-in" className="font-medium text-fg hover:text-accent">← Back to sign in</Link>}
          </p>
        </div>
      </div>
    </div>
  );
}
