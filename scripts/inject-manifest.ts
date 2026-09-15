import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const dir = path.resolve(process.cwd(), "dist/client/assets");
const sourcesDir = path.resolve(process.cwd(), "dist/client/content/sources");
const bodiesDir = path.resolve(process.cwd(), "dist/client/content/bodies");

if (fs.existsSync(dir)) {
  const assetFiles = fs.readdirSync(dir).map((f) => `/assets/${f}`);

  // Precache every archived source markdown file too, so the /read/$id
  // archive reader works offline immediately after install instead of only
  // caching an article the first time it's opened while online.
  const sourceFiles = fs.existsSync(sourcesDir)
    ? fs
        .readdirSync(sourcesDir)
        .filter((f) => f.endsWith(".md"))
        .map((f) => `/content/sources/${f}`)
    : [];

  // And the per-cluster node bodies (layer1/layer2/quiz/further reading —
  // see scripts/build-content.ts): 38 small files, so an installed app can
  // open every node fully offline, not just the bundled index half.
  const bodyFiles = fs.existsSync(bodiesDir)
    ? fs
        .readdirSync(bodiesDir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => `/content/bodies/${f}`)
    : [];

  const swPath = path.resolve(process.cwd(), "dist/client/sw.js");
  if (fs.existsSync(swPath)) {
    let sw = fs.readFileSync(swPath, "utf-8");

    // Replace the placeholder precache list with our explicit manifest
    const replaceTarget = '["/", "/manifest.webmanifest"]';
    const manifestList = [
      "/",
      "/manifest.webmanifest",
      ...assetFiles,
      ...bodyFiles,
      ...sourceFiles,
    ];
    const newManifest = JSON.stringify(manifestList);

    // Content-addressed cache version: hash the exact set of precached
    // files instead of relying on a hand-bumped "commonplace-vN" string in
    // sw.js. A deploy that doesn't change any cached file keeps the same
    // version (no needless cache churn); any deploy that does gets a new
    // version automatically, so the old caches are guaranteed to be dropped
    // in the activate handler - nobody has to remember to bump anything.
    // Body file names are stable across deploys (A.json, B.json, ...), so
    // their content hashes (bodies/manifest.json) go into the version too —
    // otherwise an edit to one node's quiz would never bust the precache.
    const bodiesManifestPath = path.join(bodiesDir, "manifest.json");
    const bodiesVersion = fs.existsSync(bodiesManifestPath)
      ? fs.readFileSync(bodiesManifestPath, "utf-8")
      : "";
    const hash = crypto
      .createHash("sha256")
      .update(manifestList.join(",") + bodiesVersion)
      .digest("hex")
      .slice(0, 10);
    sw = sw.replace(/const VERSION = "[^"]+";/, `const VERSION = "commonplace-${hash}";`);

    sw = sw.replace(replaceTarget, newManifest);
    fs.writeFileSync(swPath, sw);
    console.log(
      `Injected ${assetFiles.length} assets, ${bodyFiles.length} node body files and ${sourceFiles.length} archived source files into sw.js precache manifest (version commonplace-${hash})`,
    );
  } else {
    console.error("sw.js not found in dist/client");
  }
} else {
  console.error("dist/client/assets not found");
}
