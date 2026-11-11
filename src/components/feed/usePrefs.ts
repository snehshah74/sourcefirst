"use client";

import { useCallback, useEffect, useState } from "react";
import { cleanPrefs, type Prefs } from "@/lib/prefs";

const KEY = "sf-prefs";
const SEEN = "sf-onboarded";

const readLocal = (): Prefs | null => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? cleanPrefs(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

/**
 * Feed preferences from onboarding. Signed-in users keep them on their account (so they follow
 * them across devices); visitors keep them in this browser.
 */
export function usePrefs(signedIn: boolean) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [seen, setSeen] = useState(true); // assume seen until we know, so the dialog never flashes

  useEffect(() => {
    let alive = true;
    const local = readLocal();
    let seenFlag = false;
    try {
      seenFlag = localStorage.getItem(SEEN) === "1";
    } catch {}
    const done = (p: Prefs | null) => {
      if (!alive) return;
      setPrefs(p);
      setSeen(seenFlag || !!p);
      setLoaded(true);
    };
    if (!signedIn) return done(local);
    fetch("/api/me/prefs")
      .then((r) => r.json())
      .then(async (d: { prefs: Prefs | null }) => {
        // First sign-in after onboarding as a visitor: carry those answers over to the account.
        if (!d.prefs && local) {
          await fetch("/api/me/prefs", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(local) }).catch(() => {});
          return done(local);
        }
        done(d.prefs ? cleanPrefs(d.prefs) : local);
      })
      .catch(() => done(local));
    return () => {
      alive = false;
    };
  }, [signedIn]);

  const save = useCallback(
    async (p: Prefs) => {
      setPrefs(p);
      setSeen(true);
      try {
        localStorage.setItem(KEY, JSON.stringify(p));
        localStorage.setItem(SEEN, "1");
      } catch {}
      if (signedIn) await fetch("/api/me/prefs", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(p) }).catch(() => {});
    },
    [signedIn],
  );

  const dismiss = useCallback(() => {
    setSeen(true);
    try {
      localStorage.setItem(SEEN, "1");
    } catch {}
  }, []);

  return { prefs, loaded, seen, save, dismiss };
}
