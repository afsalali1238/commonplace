/**
 * Offline helpers for content the app has already saved to Cache Storage
 * (the service worker's precache, or an explicit "↓ Download").
 *
 * Why the page reads Cache Storage itself instead of trusting the service
 * worker to: a plain fetch() only reaches Cache Storage when the worker is
 * controlling the page. Whenever it isn't — the first load before it claims
 * the page, a hard reload, the worker evicted or not yet re-registered — the
 * request goes straight to the network, and an article that is sitting on
 * the device fails with "you're offline". These helpers close that gap.
 */

/** Cached copy of `url` from any of the app's caches, if one exists. */
export async function matchCached(url: string): Promise<Response | undefined> {
  if (typeof caches === "undefined") return undefined;
  try {
    const hit = await caches.match(url, { ignoreVary: true });
    // Older service workers cached error responses too; never treat one of
    // those as a saved copy.
    return hit?.ok ? hit : undefined;
  } catch {
    return undefined;
  }
}

/**
 * fetch() that falls back to the app's caches when the network fails or
 * answers with an error. When the service worker is in control it already
 * serves cached copies first, so this only changes behaviour when it isn't.
 */
export async function fetchWithCacheFallback(url: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    const cached = await matchCached(url);
    if (cached) return cached;
    throw err;
  }
  if (res.ok) return res;
  return (await matchCached(url)) ?? res;
}

/**
 * Ask the browser to keep this origin's storage under disk pressure. Without
 * it, Cache Storage is "best effort" and can be evicted — taking downloads
 * with it. Fire-and-forget: browsers may grant silently, prompt, or decline.
 */
export function requestPersistentStorage(): void {
  if (typeof navigator === "undefined") return;
  const storage = navigator.storage;
  if (!storage?.persist) return;
  void storage
    .persisted()
    .then((already) => (already ? true : storage.persist()))
    .catch(() => {});
}
