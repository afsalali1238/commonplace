// Commonplace service worker — makes the app installable and offline-capable.
//
// Two tiers, so a fresh install is usable offline within seconds:
//
// 1. The app shell (the start page, hashed JS/CSS/fonts, node bodies; ~3 MB)
//    is precached at install. The worker activates only once it is complete.
// 2. The archived articles (~400 files, ~9 MB) fill in AFTER activation, in
//    their own long-lived cache, resuming on every launch until done.
//
// Before this split, install precached all ~530 files (~12.5 MB) at once. On
// iOS a Home Screen web app keeps its own storage, separate from Safari, and
// iOS suspends a backgrounded app's worker — so an install that couldn't
// finish in one sitting never activated, and launching offline showed
// Safari's "not connected to the internet" page.

const VERSION = "commonplace-v3";
const APP_SHELL = "shell-" + VERSION;
const RUNTIME = "runtime-" + VERSION;
// Explicit "↓ Download" taps land here (DownloadButton in routes/node.$id.tsx).
// The reader's own data, not a build artifact: never versioned, never
// deleted on update (it once was, which wiped every download on each deploy).
const DOWNLOADS = "commonplace-downloads";
// Archived articles. Not tied to VERSION: each entry carries the content hash
// it was fetched at (ARCHIVE_HASH_HEADER), so a deploy re-downloads only the
// articles that actually changed instead of all of them.
const ARCHIVE = "commonplace-archive";
const ARCHIVE_HASH_HEADER = "x-commonplace-hash";

// Replaced at build time (scripts/inject-manifest.ts): the app shell list,
// and { "/content/sources/<id>.md": "<content hash>" } for every article.
const PRECACHE_URLS = ["/", "/manifest.webmanifest"];
const ARCHIVE_FILES = {};

const PRECACHE_CONCURRENCY = 6;
const ARCHIVE_CONCURRENCY = 4;

// A navigation waits this long for the network before serving the cached
// shell, so a weak signal doesn't leave the installed app on a blank screen.
const NAVIGATION_TIMEOUT_MS = 4000;

const matchAny = (req) => caches.match(req, { ignoreVary: true });
const isArchiveUrl = (pathname) => Object.prototype.hasOwnProperty.call(ARCHIVE_FILES, pathname);

async function fetchOk(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res;
}

async function runLanes(items, concurrency, work) {
  const queue = [...items];
  const lane = async () => {
    while (queue.length) await work(queue.shift());
  };
  await Promise.all(Array.from({ length: concurrency }, lane));
}

// --- tier 1: the shell -------------------------------------------------------

async function precacheShell() {
  const cache = await caches.open(APP_SHELL);
  try {
    await runLanes(PRECACHE_URLS, PRECACHE_CONCURRENCY, async (url) => {
      await cache.put(url, await fetchOk(url).catch(() => fetchOk(url)));
    });
  } catch (err) {
    // A shell that can't fully load must not replace a working one: failing
    // the install keeps the current worker and its caches in charge, and the
    // browser retries the update on a later visit.
    await caches.delete(APP_SHELL);
    throw err;
  }
}

// Workers before the split kept articles inside their versioned shell cache.
// Copy those into ARCHIVE before activation deletes the old caches, so an
// update never leaves fewer articles readable offline than before. They are
// marked "legacy", so the next fill refreshes them when there is a network.
async function adoptLegacyArticles() {
  const archive = await caches.open(ARCHIVE);
  const keys = (await caches.keys()).filter((k) => k.startsWith("shell-") && k !== APP_SHELL);
  for (const key of keys) {
    const old = await caches.open(key);
    for (const req of await old.keys()) {
      const { pathname } = new URL(req.url);
      if (!isArchiveUrl(pathname) || (await archive.match(pathname))) continue;
      const res = await old.match(req);
      if (res?.ok) await archive.put(pathname, await withHash(res, "legacy"));
    }
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    precacheShell()
      .then(adoptLegacyArticles)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([APP_SHELL, RUNTIME, DOWNLOADS, ARCHIVE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(pruneArchive)
      .then(() => self.clients.claim()),
  );
});

// --- tier 2: the articles ----------------------------------------------------

async function withHash(res, hash) {
  const headers = new Headers(res.headers);
  headers.set(ARCHIVE_HASH_HEADER, hash);
  return new Response(await res.blob(), {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

/** Drop articles that are no longer part of the app. */
async function pruneArchive() {
  const archive = await caches.open(ARCHIVE);
  for (const req of await archive.keys()) {
    if (!isArchiveUrl(new URL(req.url).pathname)) await archive.delete(req);
  }
}

let filling = null;

/**
 * Download every article that is missing or out of date. Resumable: already
 * current entries are skipped, so each launch continues where the last one
 * stopped. A failed fetch keeps whatever copy the device already has.
 */
function fillArchive() {
  if (filling) return filling;
  filling = (async () => {
    const archive = await caches.open(ARCHIVE);
    await runLanes(Object.entries(ARCHIVE_FILES), ARCHIVE_CONCURRENCY, async ([url, hash]) => {
      const have = await archive.match(url);
      if (have?.headers.get(ARCHIVE_HASH_HEADER) === hash) return;
      try {
        await archive.put(url, await withHash(await fetchOk(url), hash));
      } catch {
        // offline or flaky: keep the existing copy, try again next launch
      }
    });
  })().finally(() => {
    filling = null;
  });
  return filling;
}

async function offlineStatus() {
  const shell = await caches.open(APP_SHELL);
  const archive = await caches.open(ARCHIVE);
  const downloads = await caches.open(DOWNLOADS);
  const urls = Object.keys(ARCHIVE_FILES);
  let saved = 0;
  for (const url of urls) {
    if ((await archive.match(url)) || (await downloads.match(url))) saved++;
  }
  return {
    shellReady: Boolean(await shell.match("/")),
    saved,
    total: urls.length,
    filling: Boolean(filling),
  };
}

// The page asks for a fill on every online launch (hooks/useOfflineWarmup.ts)
// and for the status line in You (hooks/useOfflineStatus.ts). waitUntil keeps
// the worker alive while the fill runs.
self.addEventListener("message", (event) => {
  const type = event.data?.type;
  if (type === "fill-archive") {
    event.waitUntil(fillArchive());
  } else if (type === "offline-status") {
    const port = event.ports?.[0];
    event.waitUntil(offlineStatus().then((status) => port?.postMessage(status)));
  }
});

// --- fetch -------------------------------------------------------------------

// Only successful responses are ever stored. A 404/503 used to be cached
// like any other response and then served as the "offline copy".
function putIfOk(req, res, cacheName = RUNTIME) {
  if (res.ok && res.type !== "opaque") {
    const copy = res.clone();
    caches.open(cacheName).then((c) => c.put(req, copy));
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

async function handleArticle(req, pathname) {
  // Articles barely change; cache-first means an article opens instantly
  // and identically online or off. A miss is fetched and kept.
  const cached = await matchAny(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) {
    const archive = await caches.open(ARCHIVE);
    await archive.put(pathname, await withHash(res.clone(), ARCHIVE_FILES[pathname]));
  }
  return res;
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

  if (isArchiveUrl(url.pathname)) {
    event.respondWith(handleArticle(req, url.pathname));
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
