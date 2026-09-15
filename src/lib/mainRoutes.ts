/**
 * Single source of truth for the app's top-level, statically-routable
 * destinations. Reused by BottomNav (so every tab lives here) and by
 * useOfflineWarmup (so a destination can't silently go missing from the
 * offline precache list without also disappearing from the nav - the exact
 * bug that shipped once already, see useOfflineWarmup.ts).
 *
 * The bar is Feed · Explore · Review · You — PRODUCT-BRIEF.md §5 (revised
 * 2026-09-04) and FEED-SPEC.md §7 option A. Review carries the due-count
 * badge: it is the retention loop's daily trigger and the brief calls it a
 * primary destination; it had been demoted to a link inside You, which left
 * the bar with three browse surfaces and zero retention surfaces.
 *
 * To add a new top-level tab: add it here first, then BottomNav picks it up
 * automatically and useOfflineWarmup's document list stays correct by
 * construction instead of by remembering to update a second array by hand.
 */
export const MAIN_TABS = [
  {
    to: "/" as const,
    label: "Feed",
    match: (p: string) => p === "/" || p.startsWith("/node"),
  },
  {
    to: "/skim" as const,
    label: "Skim",
    match: (p: string) => p.startsWith("/skim") || p.startsWith("/map"),
  },
  {
    to: "/explore" as const,
    label: "Explore",
    match: (p: string) => p.startsWith("/explore"),
  },
  {
    to: "/you" as const,
    label: "You",
    match: (p: string) => p.startsWith("/you"),
  },
] as const;

export const MAIN_TAB_PATHS = MAIN_TABS.map((t) => t.to);

/**
 * Primary surfaces that are reached from a tab rather than being one. They
 * get the same offline warm-up as the tabs; listing them here (not inline in
 * useOfflineWarmup) keeps "what is a destination" in one file.
 */
export const SECONDARY_PATHS = ["/skim" as const];

/**
 * How "deep" a path is in the information architecture, for route
 * transitions: a tab is 0, a screen reached from a tab is 1, an idea (node
 * or its source) is 2. Going deeper slides the new page up, coming back
 * slides it down, same-depth changes cross-fade (see styles.css, "Route
 * transitions"). The numbers only matter relative to each other.
 */
export function routeDepth(pathname: string): number {
  if (pathname.startsWith("/node") || pathname.startsWith("/read")) return 2;
  if (MAIN_TAB_PATHS.includes(pathname as (typeof MAIN_TAB_PATHS)[number])) return 0;
  return 1;
}

/** View-transition type for a navigation, consumed by CSS. */
export function transitionType(
  from: string | undefined,
  to: string,
): "deeper" | "shallower" | "lateral" {
  if (from === undefined) return "lateral";
  const d = routeDepth(to) - routeDepth(from);
  if (d > 0) return "deeper";
  if (d < 0) return "shallower";
  return "lateral";
}
