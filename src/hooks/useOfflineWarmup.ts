import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { NODES } from "@/data/nodes";
import { MAIN_TAB_PATHS, SECONDARY_PATHS } from "@/lib/mainRoutes";
import { loadClusterBodies } from "@/lib/bodies";

/**
 * Once the service worker is controlling the page, silently warm the
 * offline cache for the whole app - not just the pages the user has
 * already opened - so an installed/offline launch works right away.
 *
 * Two things need warming, for two different reasons:
 * 1. Each route's server-rendered HTML document (`fetch(url)`). This is
 *    what a fresh navigation needs - most importantly "/", since that's
 *    the PWA's start_url and is what loads when the installed app icon is
 *    opened. The very first time someone ever visits the site, that
 *    request happens *before* any service worker exists, so it's never
 *    cached unless we explicitly refetch it once the worker is active.
 * 2. Each route's JS chunk (`router.preloadRoute`), so that once "/" has
 *    loaded, navigating to any other page is a client-side transition
 *    that doesn't need the network at all.
 *
 * Node content is in two halves. The index (title, thesis, layer0,
 * related, tags for every node) is bundled into the JS, so every
 * `/node/$id` URL is served by the same route chunk and warming it once
 * (with any valid id) covers all of them. The bodies (layer1, layer2,
 * quiz, further reading) are 38 per-cluster JSON files under
 * /content/bodies/ — they're in the service worker's precache list (see
 * scripts/inject-manifest.ts), and this hook also pulls them into the
 * in-memory cache so the first node opened offline doesn't even need the
 * SW round-trip. The archive reader (`/read/$id`) fetches per-item
 * markdown, precached the same way; its route chunk gets the one-time warm.
 */
export function useOfflineWarmup() {
  const router = useRouter();

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    if (navigator.onLine === false) return;

    let cancelled = false;

    async function warm() {
      try {
        // Wait until a service worker is actually active and controlling
        // fetches - warming before that would just hit the network
        // without landing in our offline cache.
        await navigator.serviceWorker.ready;
      } catch {
        return;
      }
      if (cancelled) return;

      const firstNodeId = NODES[0]?.id;
      // Every bottom-nav tab, sourced from MAIN_TABS (see lib/mainRoutes.ts)
      // instead of a second hand-maintained list - a tab going missing here
      // was exactly how Skim and Explore fell out of the offline precache
      // once already. "/review" isn't a bottom-nav tab but is still a
      // primary destination (linked from You), so it's added on top.
      const documentUrls: string[] = [...MAIN_TAB_PATHS, "/review"];
      if (firstNodeId) documentUrls.push(`/node/${firstNodeId}`);

      for (const url of documentUrls) {
        if (cancelled) return;
        await fetch(url, { credentials: "same-origin" }).catch(() => {});
      }

      for (const to of MAIN_TAB_PATHS) {
        if (cancelled) return;
        await router.preloadRoute({ to }).catch(() => {});
      }
      if (cancelled) return;
      await router.preloadRoute({ to: "/review" }).catch(() => {});
      if (cancelled) return;
      if (firstNodeId) {
        await router.preloadRoute({ to: "/node/$id", params: { id: firstNodeId } }).catch(() => {});
      }
      // Any archived source id works to warm the reader's route chunk; the
      // first node's first source is archived (validate-nodes.ts would flag
      // an un-archived source in cluster A), and a 404 here is harmless.
      if (firstNodeId) {
        await router
          .preloadRoute({ to: "/read/$id", params: { id: `${firstNodeId}-0` } })
          .catch(() => {});
      }

      // Bodies, one cluster at a time so a slow connection isn't saturated.
      const clusterIds = [...new Set(NODES.map((n) => n.clusterId))];
      for (const clusterId of clusterIds) {
        if (cancelled) return;
        await loadClusterBodies(clusterId).catch(() => {});
      }
    }

    // Give the initial page its own bandwidth before warming the rest.
    const timer = window.setTimeout(warm, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [router]);
}
