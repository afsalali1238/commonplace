/**
 * Per-browser-session feed identity.
 *
 * The Feed's order is a pure function of (seed, interests, visited-snapshot).
 * Previously the seed was `useState(() => Date.now())` inside FeedScreen and
 * `visited` was a live dependency — so every Feed → node → Back round-trip
 * unmounted the screen, minted a new seed, and rebuilt a different order
 * under the restored scroll offset (the card you left was gone, and the one
 * you'd just read had been shuffled to the end). FEED-SPEC §5 asks for the
 * opposite: "back-swipe returns the same card; each new session feels fresh".
 *
 * sessionStorage is exactly that lifetime: survives in-app navigation and a
 * reload of the tab, dies when the tab/PWA is closed. The visited snapshot is
 * taken once per session too, so reading a card marks it "Read ✓" in place
 * instead of moving it.
 */
const SEED_KEY = "unknown:feed-seed";
const VISITED_KEY = "unknown:feed-visited";

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null; // privacy modes can throw on access
  }
}

export function getFeedSeed(): number {
  const s = storage();
  const existing = s ? Number(s.getItem(SEED_KEY)) : 0;
  if (existing > 0) return existing;
  const fresh = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0 || 1;
  s?.setItem(SEED_KEY, String(fresh));
  return fresh;
}

/**
 * The visited map frozen at the start of this session. `current` is only
 * consulted the first time in a session (when nothing is snapshotted yet).
 */
export function getSessionVisited(current: Record<string, boolean>): Record<string, boolean> {
  const s = storage();
  if (s) {
    const raw = s.getItem(VISITED_KEY);
    if (raw) {
      try {
        return JSON.parse(raw) as Record<string, boolean>;
      } catch {
        /* fall through and re-snapshot */
      }
    }
    s.setItem(VISITED_KEY, JSON.stringify(current));
  }
  return current;
}

/** Forget the session's order — used after interests change so the new feed is rebuilt. */
export function resetFeedSession() {
  const s = storage();
  s?.removeItem(SEED_KEY);
  s?.removeItem(VISITED_KEY);
}
