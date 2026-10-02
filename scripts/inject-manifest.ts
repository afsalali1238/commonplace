import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

/**
 * Fills the two build-time constants in dist/client/sw.js (see public/sw.js):
 *
 * - PRECACHE_URLS: the app shell — "/", the manifest, every hashed asset and
 *   the per-cluster node bodies. Precached at install; the worker activates
 *   only once all of it is cached, so keep it small.
 * - ARCHIVE_FILES: { url: contentHash } for every archived article. These
 *   download after activation and are re-fetched only when their hash changes.
 *
 * The worker's VERSION hashes the shell alone. Articles are versioned per
 * file, so an article fix no longer re-downloads the whole app, and a code
 * deploy no longer re-downloads ~400 unchanged articles.
 */

const clientDir = path.resolve(process.cwd(), "dist/client");
const assetsDir = path.join(clientDir, "assets");
const sourcesDir = path.join(clientDir, "content/sources");
const bodiesDir = path.join(clientDir, "content/bodies");
const swPath = path.join(clientDir, "sw.js");

// Fontsource ships every script subset, each as .woff2 plus a legacy .woff;
// the browser only downloads the woff2 subsets a page's text needs, but a
// precache would fetch them all. The content is English (Latin + Latin
// Extended), so other scripts and every .woff stay out of the shell; if one
// is ever needed it loads on demand like any other asset.
const UNUSED_FONT_SUBSET =
  /(\.woff$)|(-(cyrillic|cyrillic-ext|greek|greek-ext|vietnamese)-[a-z0-9]+-normal-[^/]*\.woff2$)/;

const hashOf = (data: string | Buffer, len = 12) =>
  crypto.createHash("sha256").update(data).digest("hex").slice(0, len);

const list = (dir: string, ext: string) =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(ext))
        .sort()
    : [];

if (!fs.existsSync(assetsDir) || !fs.existsSync(swPath)) {
  console.error("dist/client/assets or dist/client/sw.js not found — run vite build first");
  process.exit(1);
}

const assetFiles = fs
  .readdirSync(assetsDir)
  .sort()
  .map((f) => `/assets/${f}`)
  .filter((f) => !UNUSED_FONT_SUBSET.test(f));
const skippedFonts = fs.readdirSync(assetsDir).filter((f) => UNUSED_FONT_SUBSET.test(f)).length;

const bodyFiles = list(bodiesDir, ".json").map((f) => `/content/bodies/${f}`);
const shell = ["/", "/manifest.webmanifest", ...assetFiles, ...bodyFiles];

const archive: Record<string, string> = {};
for (const f of list(sourcesDir, ".md")) {
  archive[`/content/sources/${f}`] = hashOf(fs.readFileSync(path.join(sourcesDir, f)));
}

// Body file names are stable across deploys (A.json, B.json, ...), so their
// content hashes (bodies/manifest.json) go into the version too — otherwise
// an edit to one node's quiz would never refresh the precached copy.
const bodiesManifestPath = path.join(bodiesDir, "manifest.json");
const bodiesVersion = fs.existsSync(bodiesManifestPath)
  ? fs.readFileSync(bodiesManifestPath, "utf-8")
  : "";
const version = `commonplace-${hashOf(shell.join(",") + bodiesVersion, 10)}`;

let sw = fs.readFileSync(swPath, "utf-8");
const replacements: [RegExp | string, string][] = [
  [/const VERSION = "[^"]+";/, `const VERSION = "${version}";`],
  [
    'const PRECACHE_URLS = ["/", "/manifest.webmanifest"];',
    `const PRECACHE_URLS = ${JSON.stringify(shell)};`,
  ],
  ["const ARCHIVE_FILES = {};", `const ARCHIVE_FILES = ${JSON.stringify(archive)};`],
];
for (const [from, to] of replacements) {
  const next = sw.replace(from, to);
  if (next === sw) {
    console.error(`inject-manifest: placeholder not found in sw.js: ${from}`);
    process.exit(1);
  }
  sw = next;
}
fs.writeFileSync(swPath, sw);

const kb = (urls: string[]) =>
  Math.round(
    urls
      .filter((u) => u !== "/")
      .reduce(
        (s, u) =>
          s +
          (fs.existsSync(path.join(clientDir, u)) ? fs.statSync(path.join(clientDir, u)).size : 0),
        0,
      ) / 1024,
  );
console.log(
  `sw.js ${version}: shell ${shell.length} files (~${kb(shell)} KB; ${skippedFonts} unused font subsets left out), ` +
    `archive ${Object.keys(archive).length} articles (~${kb(Object.keys(archive))} KB, filled after activation)`,
);
