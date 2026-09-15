import { useEffect, useState } from "react";
import { useStore } from "./store";

/**
 * True only after the persisted Zustand store has finished rehydrating from
 * IndexedDB. A one-frame `useEffect` flag is not enough: idb-keyval is async,
 * so `onboardingComplete` / `seenHints` / `interests` still read as defaults
 * for a beat after first paint — which flashed returning users through
 * onboarding and re-showed dismissed hints.
 */
export function useHydrated() {
  const [h, setH] = useState(() =>
    typeof window === "undefined" ? false : useStore.persist.hasHydrated(),
  );
  useEffect(() => {
    if (useStore.persist.hasHydrated()) {
      setH(true);
      return;
    }
    return useStore.persist.onFinishHydration(() => setH(true));
  }, []);
  return h;
}
