// Commonplace service worker — makes the app installable and offline-capable.
const VERSION = "commonplace-v3";
const APP_SHELL = "shell-" + VERSION;
const RUNTIME = "runtime-" + VERSION;
// Explicit "↓ Download" taps land here (DownloadButton in routes/node.$id.tsx).
// This is the reader's own data, not a build artifact, so it is deliberately
// NOT versioned and never deleted on update — it used to be, because the
// activate handler dropped every cache not ending in VERSION, which silently
// wiped every download whenever a new deploy reached the device.
const DOWNLOADS = "commonplace-downloads";

// Replaced at build time (see scripts/inject-manifest.ts) with the full list
// of hashed JS/CSS assets plus every archived source markdown file, so a
// fresh install has the whole archive available offline immediately instead
// of caching each article lazily on first read.
const PRECACHE_URLS = ["/", "/manifest.webmanifest"];

// Archived sources are standalone articles: if one can't be fetched during
// an update, the copy the device already holds is still correct to serve.
// Everything else (the shell document, hashed assets, node bodies) has to
// match this build, so a failure there aborts the update instead (see below).
const isArchivedSource = (url) => url.startsWith("/content/sources/");

// Precache few requests at a time; ~530 parallel fetches on a phone mostly
// produces timeouts, and each one used to be silently dropped.
const PRECACHE_CONCURRENCY = 6;

// A navigation waits this long for the network before serving the cached
// shell, so a weak signal doesn't leave the installed app on a blank screen.
const NAVIGATION_TIMEOUT_MS = 4000;

const matchAny = (req) => caches.match(req, { ignoreVary: true });

async function fetchOk(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res;
}

async function precache() {
  const cache = await caches.open(APP_SHELL);
  const queue = [...PRECACHE_URLS];

  async function lane() {
    while (queue.length) {
      const url = queue.shift();
      try {
        await cache.put(url, await fetchOk(url).catch(() => fetchOk(url)));
      } catch (err) {
        if (!isArchivedSource(url)) throw err;
        // Patchy network mid-update: carry over the copy this device already
        // has (previous version's precache, or the user's own download), so
        // an update never leaves less readable offline than there was before.
        const previous = await matchAny(url);
        if (previous) await cache.put(url, previous);
      }
    }
  }

  try {
    await Promise.all(Array.from({ length: PRECACHE_CONCURRENCY }, lane));
  } catch (err) {
    // A shell that can't fully load must not replace a working one: throwing
    // here fails the install, the current worker and its caches stay in
    // charge, and the browser retries the update on a later visit.
    await caches.delete(APP_SHELL);
    throw err;
  }
}

self.addEventListener("install", (event) => {
  // skipWaiting only takes effect once precache() resolves; a failed install
  // is discarded without ever activating.
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  const keep = new Set([APP_SHELL, RUNTIME, DOWNLOADS]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Only successful responses are ever stored. A 404/503 used to be cached
// like any other response and then served as the "offline copy" — and the
// Download button's cache check counted it as downloaded.
function putIfOk(req, res) {
  if (res.ok && res.type !== "opaque") {
    const copy = res.clone();
    caches.open(RUNTIME).then((c) => c.put(req, copy));
  }
  return res;
}

async function handleNavigation(req) {
  const network = fetch(req).then((res) => putIfOk(req, res));
  network.catch(() => {}); // may settle after we've answered from cache
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("navigation timeout")), NAVIGATION_TIMEOUT_MS),
  );
  try {
    return await Promise.race([network, timeout]);
  } catch {
    // Any route can boot from the cached "/" shell — the client router then
    // renders the requested URL itself.
    const cached = (await matchAny(req)) || (await matchAny("/"));
    return cached || network;
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Navigations: network-first with a timeout, falling back to the shell.
  if (req.mode === "navigate") {
    event.respondWith(handleNavigation(req));
    return;
  }

  // Cross-origin (fonts, etc.): cache-first.
  if (url.origin !== self.location.origin) {
    event.respondWith(
      matchAny(req).then((cached) => cached || fetch(req).then((res) => putIfOk(req, res))),
    );
    return;
  }

  // Same-origin assets: stale-while-revalidate.
  event.respondWith(
    matchAny(req).then((cached) => {
      const network = fetch(req)
        .then((res) => putIfOk(req, res))
        .catch((err) => {
          if (cached) return cached;
          throw err;
        });
      if (cached) network.catch(() => {});
      return cached || network;
    }),
  );
});
