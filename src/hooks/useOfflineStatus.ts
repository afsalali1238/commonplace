import { useEffect, useState } from "react";

export type OfflineStatus =
  | { state: "checking" }
  /** No service worker support (or it failed to register). */
  | { state: "unsupported" }
  /** Worker not active yet: launching offline would fail. */
  | { state: "not-ready" }
  /** The app opens offline; some articles are still downloading. */
  | { state: "saving"; saved: number; total: number }
  /** The app and every archived article open offline. */
  | { state: "ready"; saved: number; total: number };

interface WorkerStatus {
  shellReady: boolean;
  saved: number;
  total: number;
  filling: boolean;
}

function askWorker(worker: ServiceWorker): Promise<WorkerStatus | null> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => resolve(null), 3000);
    channel.port1.onmessage = (e) => {
      window.clearTimeout(timer);
      resolve(e.data as WorkerStatus);
    };
    worker.postMessage({ type: "offline-status" }, [channel.port2]);
  });
}

/**
 * Whether this device can open the app with no connection, read from the
 * service worker itself (public/sw.js, "offline-status"). Polls while
 * articles are still downloading so the line in You counts up.
 *
 * The point is to answer "can I go offline now?" before someone finds out
 * the hard way — on iOS a Home Screen app has its own storage, separate
 * from Safari, so installing it starts the offline copy from scratch.
 */
export function useOfflineStatus(): OfflineStatus {
  const [status, setStatus] = useState<OfflineStatus>({ state: "checking" });

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      setStatus({ state: "unsupported" });
      return;
    }
    let cancelled = false;
    let timer: number | undefined;

    async function check() {
      const registration = await navigator.serviceWorker.getRegistration().catch(() => undefined);
      const worker = registration?.active;
      const result = worker ? await askWorker(worker) : null;
      if (cancelled) return;
      if (!result || !result.shellReady) {
        setStatus({ state: "not-ready" });
      } else if (result.saved < result.total) {
        setStatus({ state: "saving", saved: result.saved, total: result.total });
      } else {
        setStatus({ state: "ready", saved: result.saved, total: result.total });
      }
      const done = result?.shellReady && result.saved >= result.total;
      if (!done) timer = window.setTimeout(check, 2500);
    }

    void check();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  return status;
}
