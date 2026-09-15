/**
 * demote-missing-archives.ts — validator-repair codemod
 *
 * Finds every furtherReading item whose archive.status is "full"/"excerpt"
 * but whose archived file is NOT on disk under public/content/sources/ (the
 * state the repo was left in after the 2026-09 re-import lost 161 files) and
 * demotes the entry to `{ status: "unavailable" }` — the shape the validator
 * accepts and the app renders as an outbound-only link.
 *
 * Prefer recovery over demotion when a network with web access is available:
 * `npx tsx scripts/archive-sources.ts all --retry-unavailable` re-fetches and
 * re-archives everything this script (or a normal triage) marked unavailable.
 *
 * Usage (from repo root):
 *   npx tsx scripts/demote-missing-archives.ts            # write
 *   npx tsx scripts/demote-missing-archives.ts --dry-run   # report only
 *
 * Afterwards run `npx tsx scripts/build-content.ts` so the generated bundle
 * and bodies reflect the change (CI's freshness check enforces this).
 */
import fsSync from "node:fs";
import path from "node:path";
import {
  readClusterFile,
  readClusterOrder,
  writeClusterFile,
  type ClusterFile,
} from "./lib/content";

const DRY_RUN = process.argv.includes("--dry-run");
const PUBLIC_DIR = path.join(process.cwd(), "public");

async function run() {
  const touched = new Set<ClusterFile>();
  let demoted = 0;

  for (const id of readClusterOrder()) {
    const file = readClusterFile(id);
    for (const node of file.nodes) {
      for (const fr of node.furtherReading ?? []) {
        const a = fr.archive;
        if (!a || (a.status !== "full" && a.status !== "excerpt")) continue;
        if (a.path && fsSync.existsSync(path.join(PUBLIC_DIR, a.path))) continue;
        console.log(
          `  demote ${node.id} (${a.status}${a.path ? `, ${a.path}` : ", no path"}) ${fr.url}`,
        );
        fr.archive = { status: "unavailable" };
        touched.add(file);
        demoted++;
      }
    }
  }

  if (!DRY_RUN) for (const file of touched) await writeClusterFile(file);
  console.log(
    `${demoted} orphan archive reference(s) demoted to "unavailable" across ${touched.size} cluster file(s).${DRY_RUN ? " [DRY RUN]" : ""}`,
  );
  if (demoted > 0 && !DRY_RUN)
    console.log("Next: npx tsx scripts/build-content.ts && npx tsx scripts/validate-nodes.ts");
}

await run();
