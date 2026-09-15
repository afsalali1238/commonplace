/**
 * archive-sources.ts — offline source archiver (rebuilt)
 *
 * Snapshots each furtherReading URL to a local markdown file and records an
 * `archive` prop on the node (in content/clusters/<id>.json — the source of
 * truth; run `bun run build:content` afterwards) so the app can serve it offline.
 *
 * CANONICAL LOCATIONS (do not "simplify" these — they differ on purpose):
 *   - Disk write dir : public/content/sources/     (Vite serves public/ at URL root)
 *   - Stored path    : content/sources/<id>-<i>.md  (the URL, public/-stripped)
 *   The app links to `/${archive.path}` (see src/routes/node.$id.tsx), so a file
 *   written to repo-root content/sources/ would 404. Writing anywhere other than
 *   public/content/sources/ is a bug and is asserted against below.
 *
 * Fixes vs the old version:
 *   #1 removes the ambiguous rootSourcesDir constant; one canonical dir, guarded.
 *   #2 never silently drops an `archive` prop and re-queues — every miss/failure
 *      is written to archive-failures.log with a reason, and retries are capped.
 *
 * Usage (from repo root):
 *   bun run scripts/archive-sources.ts A          # one cluster
 *   bun run scripts/archive-sources.ts all        # everything
 *   bun run scripts/archive-sources.ts all --dry-run   # report, no fetch/write
 */
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { createRequire } from "module";
import {
  readClusterFile,
  readClusterOrder,
  writeClusterFile,
  type ClusterFile,
  type FurtherReading,
} from "./lib/content";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

// ---- canonical paths -------------------------------------------------------
const SOURCES_DISK_DIR = path.join(process.cwd(), "public", "content", "sources");
const URL_PREFIX = "content/sources"; // what gets stored in node.archive.path
const FAILURE_LOG = path.join(process.cwd(), "archive-failures.log");
const MAX_RETRIES = 3;

const DRY_RUN = process.argv.includes("--dry-run");
const clusterLimit = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "all";

// Assert every write stays inside the canonical dir. Called before any writeFile.
function assertInSourcesDir(absPath: string) {
  const rel = path.relative(SOURCES_DISK_DIR, absPath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(
      `Refusing to write outside canonical sources dir.\n  target: ${absPath}\n  canonical: ${SOURCES_DISK_DIR}`,
    );
  }
}

// ---- failure log + retry cap ----------------------------------------------
type FailCounts = Record<string, number>;
function loadFailureCounts(): FailCounts {
  const counts: FailCounts = {};
  if (!fsSync.existsSync(FAILURE_LOG)) return counts;
  for (const line of fsSync.readFileSync(FAILURE_LOG, "utf-8").split("\n")) {
    const m = line.match(/\bkey=([^\s]+)/);
    if (m) counts[m[1]] = (counts[m[1]] ?? 0) + 1;
  }
  return counts;
}
async function logFailure(key: string, url: string, reason: string) {
  const line = `${new Date().toISOString()} key=${key} reason="${reason}" url=${url}\n`;
  await fs.appendFile(FAILURE_LOG, line, "utf-8");
  console.warn(`  ! ${key}: ${reason}`);
}

// ---- triage buckets (unchanged — working correctly) ------------------------
function getBucket(url: string): {
  bucket: "full" | "pdf-or-wiki" | "unavailable";
  reason: string;
} {
  let domain = "";
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch (e) {
    domain = url;
  }
  if (url.endsWith(".pdf") || domain === "arxiv.org")
    return { bucket: "pdf-or-wiki", reason: "PDF" };
  if (domain === "en.wikipedia.org" || domain === "wikipedia.org")
    return { bucket: "pdf-or-wiki", reason: "Wiki" };
  if (
    domain.includes("youtube.com") ||
    domain.includes("youtu.be") ||
    domain.includes("ted.com") ||
    url.includes("podcast") ||
    domain.includes("spotify.com") ||
    domain.includes("apple.com") ||
    domain === "wsj.com" ||
    domain === "bloomberg.com" ||
    domain === "nytimes.com" ||
    domain === "cnbc.com" ||
    domain === "fortune.com" ||
    domain === "cnn.com" ||
    domain === "netflix.com" ||
    domain === "imdb.com" ||
    domain === "jrepodcast.com" ||
    domain === "npr.org" ||
    domain === "freakonomics.com" ||
    domain === "allinpodcast.co" ||
    domain === "joincolossus.com" ||
    domain === "stitcher.com" ||
    domain === "overcast.fm" ||
    domain === "fs.blog"
  ) {
    return { bucket: "unavailable", reason: "Media/Paywall" };
  }
  return { bucket: "full", reason: "Article" };
}

async function fetchWiki(url: string) {
  const title = url.split("/wiki/")[1];
  const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=${title}&format=json`;
  const res = await fetch(apiUrl, { headers: { "User-Agent": "Epistemoph/1.0" } });
  const data = await res.json();
  const pages = data.query?.pages;
  if (!pages) return null;
  const pageId = Object.keys(pages)[0];
  return pages[pageId].extract ?? null;
}
async function fetchPdf(url: string) {
  if (url.includes("arxiv.org/abs/")) url = url.replace("/abs/", "/pdf/") + ".pdf";
  const res = await fetch(url, { headers: { "User-Agent": "Epistemoph/1.0" } });
  const buffer = await res.arrayBuffer();
  const data = await pdfParse(Buffer.from(buffer));
  return data.text ?? null;
}
async function fetchArticle(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": "Epistemoph/1.0 (offline archiver)" } });
  const html = await res.text();
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  return reader.parse()?.textContent ?? null;
}

// ---- attribution block (unchanged) -----------------------------------------
function buildMarkdown(a: {
  label: string;
  sourceName: string;
  url: string;
  retrievedDate: string;
  content: string;
}) {
  const esc = (s: string) => s.replace(/"/g, '\\"');
  return `---
title: "${esc(a.label)}"
author: "${esc(a.sourceName)}"
source: "${esc(a.sourceName)}"
url: ${a.url}
retrieved: ${a.retrievedDate}
---

> Originally published by ${a.sourceName}, ${a.sourceName} — ${a.url}
> Archived ${a.retrievedDate} for personal offline reading. All rights remain with the original author.

${a.content.trim()}
`;
}

async function run() {
  await fs.mkdir(SOURCES_DISK_DIR, { recursive: true });
  const failCounts = loadFailureCounts();

  // Source of truth is content/clusters/<id>.json; we mutate the parsed
  // objects in place and write back only the files that changed, then the
  // caller regenerates src/data/nodes.ts + public/content/bodies via
  // `bun run build:content` (the add-content skill does this for you).
  const clusterIds = readClusterOrder().filter(
    (id) => clusterLimit === "all" || id === clusterLimit,
  );
  if (clusterIds.length === 0) throw new Error(`unknown cluster "${clusterLimit}"`);
  const files: ClusterFile[] = clusterIds.map(readClusterFile);
  const touched = new Set<ClusterFile>();

  type Job = {
    frItem: FurtherReading;
    file: ClusterFile;
    key: string;
    id: string;
    idx: number;
    url: string;
    label: string;
    sourceName: string;
    bucket: ReturnType<typeof getBucket>["bucket"];
    existingStatus: string | null;
  };
  const jobs: Job[] = [];
  let skippedOk = 0;
  let cappedCount = 0;

  for (const file of files)
    for (const node of file.nodes) {
      const id = node.id;
      const frItems = node.furtherReading ?? [];

      for (let i = 0; i < frItems.length; i++) {
        const frItem = frItems[i];
        const key = `${id}-${i}`;
        const diskFile = path.join(SOURCES_DISK_DIR, `${id}-${i}.md`);
        const existingStatus: string | null = frItem.archive?.status ?? null;

        // Idempotent: a valid archive whose file exists on disk needs nothing.
        if (existingStatus && (existingStatus === "full" || existingStatus === "excerpt")) {
          if (fsSync.existsSync(diskFile)) {
            skippedOk++;
            continue;
          }
          // File referenced but missing — record why, don't silently drop.
          await logFailure(
            key,
            frItem.url ?? "",
            `archived file missing on disk (status=${existingStatus})`,
          );
          if (existingStatus === "excerpt") continue; // excerpts are hand-curated, never auto-refetched
        }
        if (existingStatus === "unavailable") {
          // Already triaged as unavailable — leave it, idempotent.
          continue;
        }

        // Retry cap
        if ((failCounts[key] ?? 0) >= MAX_RETRIES) {
          cappedCount++;
          console.warn(
            `  ⤫ ${key}: retry cap (${MAX_RETRIES}) reached — skipping. See ${path.basename(FAILURE_LOG)}`,
          );
          continue;
        }

        const { url, source: sourceName, label } = frItem;
        if (!url || !sourceName || !label) continue;

        jobs.push({
          frItem,
          file,
          key,
          id,
          idx: i,
          url,
          label,
          sourceName,
          bucket: getBucket(url).bucket,
          existingStatus,
        });
      }
    }

  console.log(
    `Cluster=${clusterLimit} — ${jobs.length} to process, ${skippedOk} already archived, ${cappedCount} retry-capped.${DRY_RUN ? " [DRY RUN]" : ""}`,
  );
  if (DRY_RUN) {
    for (const j of jobs) console.log(`  would fetch ${j.key} [${j.bucket}] ${j.url}`);
    return;
  }

  const MAX_CONCURRENT = 5;
  const retrievedDate = new Date().toISOString().split("T")[0];
  for (let i = 0; i < jobs.length; i += MAX_CONCURRENT) {
    const chunk = jobs.slice(i, i + MAX_CONCURRENT);
    await Promise.all(
      chunk.map(async (j) => {
        console.log(`Processing ${j.key}: ${j.url} [${j.bucket}]`);
        let content: string | null = null;
        try {
          if (j.bucket === "full") content = await fetchArticle(j.url);
          else if (j.bucket === "pdf-or-wiki")
            content = j.url.includes("wikipedia.org")
              ? await fetchWiki(j.url)
              : await fetchPdf(j.url);
        } catch (e) {
          await logFailure(
            j.key,
            j.url,
            `fetch threw: ${e instanceof Error ? e.message : String(e)}`,
          );
          content = null;
        }

        // Any stale archive is replaced below (we logged the reason above if it existed).
        touched.add(j.file);

        if (content && content.trim()) {
          const diskFile = path.join(SOURCES_DISK_DIR, `${j.id}-${j.idx}.md`);
          assertInSourcesDir(diskFile);
          await fs.writeFile(
            diskFile,
            buildMarkdown({
              label: j.label,
              sourceName: j.sourceName,
              url: j.url,
              retrievedDate,
              content,
            }),
            "utf-8",
          );
          j.frItem.archive = {
            status: "full",
            path: `${URL_PREFIX}/${j.id}-${j.idx}.md`,
            retrieved: retrievedDate,
          };
        } else {
          if (j.bucket !== "unavailable")
            await logFailure(j.key, j.url, "fetch returned no content");
          j.frItem.archive = { status: "unavailable" };
        }
      }),
    );
  }

  for (const file of touched) await writeClusterFile(file);
  console.log(`Done. Updated ${touched.size} cluster file(s). Now run: bun run build:content`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
