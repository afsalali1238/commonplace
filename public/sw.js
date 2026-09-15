// Commonplace service worker — makes the app installable and offline-capable.
const VERSION = "commonplace-v3";
const APP_SHELL = "shell-" + VERSION;
const RUNTIME = "runtime-" + VERSION;

// Replaced at build time (see scripts/inject-manifest.ts) with the full list
// of hashed JS/CSS assets plus every archived source markdown file, so a
// fresh install has the whole archive available offline immediately instead
// of caching each article lazily on first read.
const PRECACHE_URLS = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL).then((cache) =>
      // Use per-file add() with a swallowed catch instead of addAll(), since
      // addAll aborts the entire install if even one of ~700 requests 404s.
      Promise.all(PRECACHE_URLS.map((url) => cache.add(url).catch(() => {}))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Navigations: network-first, fall back to cached shell when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/"))),
    );
    return;
  }

  // Cross-origin (fonts, etc.): cache-first.
  if (url.origin !== self.location.origin) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(RUNTIME).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Same-origin assets: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
