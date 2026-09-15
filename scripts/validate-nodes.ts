/**
 * validate-nodes.ts — schema validator for the content layer (content/clusters/*.json)
 *
 * READ-ONLY. Never mutates content or any file. Exits 1 if any ERROR is found,
 * 0 otherwise. Warnings never fail the build.
 *
 * Run from repo root:
 *   bun run scripts/validate-nodes.ts
 *   bun run scripts/validate-nodes.ts --quiet   # errors only
 *
 * Reads the source of truth directly (not the generated src/data/nodes.ts,
 * which no longer carries quiz/furtherReading). It also fails if the generated
 * files are stale relative to content/ — run `bun run build:content`.
 *
 * Checks (ERROR unless noted):
 *   - id is a non-empty string and unique
 *   - clusterId exists in CLUSTERS
 *   - every tag is a member of TAGS
 *   - quiz.options has 3 or 4 entries; correctIndex is an integer in 0..len-1
 *   - every related id resolves to a real node
 *   - each furtherReading entry has non-empty label, source, url
 *   - archive.status (if present) is one of full | excerpt | unavailable
 *   - archive.path (required when status is full/excerpt) points at a file that
 *     exists on disk under public/<path>  (path is the served URL, e.g.
 *     "content/sources/A1-0.md" -> public/content/sources/A1-0.md)
 *   - (WARN) related is empty; quiz.explanation missing; id doesn't match clusterId prefix
 *   - (WARN) quiz answer-length leak: the correct option is >LENGTH_LEAK_RATIO x longer
 *     than the longest distractor (the app shuffles positions, but "pick the longest"
 *     still works if distractors are terse — tighten or lengthen them)
 *   - (WARN) no inbound links: no other node's `related` points here, so the node is
 *     unreachable via "follow the thread" — add a back-link from a related node
 *
 * Pass --strict to promote warnings to errors (use in CI once the backlog is cleared).
 */
import path from "path";
import fs from "fs";
import { execFileSync } from "child_process";
import { readAllContent } from "./lib/content";

/** Run a script with the available runtime: prefer bun (the repo's canonical
 *  runtime), fall back to `npx tsx` so the gate also works on machines
 *  without bun (matches the package.json / CI "bun preferred, npx fallback"
 *  convention). */
function runScript(script: string, args: string[]): void {
  try {
    execFileSync("bun", ["run", script, ...args], { stdio: "pipe" });
  } catch (e) {
    const code = (e as { code?: string }).code;
    // ENOENT means bun itself is missing — fall through to tsx. Any other
    // error is a real failure: rethrow so the caller reports it.
    if (code !== "ENOENT") throw e;
    execFileSync("npx", ["tsx", script, ...args], { stdio: "pipe" });
  }
}

type Archive = { status?: string; path?: string; retrieved?: string };
type FurtherReading = {
  label?: string;
  source?: string;
  url?: string;
  type?: string;
  archive?: Archive;
};
type Quiz = { question?: string; options?: string[]; correctIndex?: number; explanation?: string };
type Node = {
  id?: string;
  clusterId?: string;
  quiz?: Quiz;
  related?: string[];
  furtherReading?: FurtherReading[];
  tags?: string[];
};

const ARCHIVE_STATUSES = new Set(["full", "excerpt", "unavailable"]);
// Correct option longer than the best distractor by more than this factor is
// flagged. Measured 2026-09-04: 321/387 nodes exceed 1.3x, 193 exceed 2x — the
// authored answers are systematically the most detailed option.
const LENGTH_LEAK_RATIO = 1.3;
const PUBLIC_DIR = path.join(process.cwd(), "public");

const errors: string[] = [];
const warnings: string[] = [];
const err = (id: string, msg: string) => errors.push(`  [${id}] ${msg}`);
const warn = (id: string, msg: string) => warnings.push(`  [${id}] ${msg}`);

async function main() {
  const quiet = process.argv.includes("--quiet");
  const strict = process.argv.includes("--strict");
  const content = readAllContent();
  const NODES: Node[] = content.nodes;
  const CLUSTERS: { id: string }[] = content.clusters;
  const TAGS: readonly string[] = content.tags;

  if (!Array.isArray(NODES) || NODES.length === 0) throw new Error("no nodes found in content/");

  // Generated outputs must match the source of truth, or the app ships
  // something other than what was reviewed.
  try {
    runScript("scripts/build-content.ts", ["--check"]);
  } catch (e) {
    const ee = e as { stderr?: Buffer; message?: string };
    const out = ee.stderr ? String(ee.stderr) : (ee.message ?? "unknown error");
    errors.push(`  [generated] ${out.trim().split("\n").join("\n  [generated] ")}`);
  }
  const clusterIds = new Set(CLUSTERS.map((c) => c.id));
  const tagSet = new Set(TAGS);
  const idSet = new Set<string>();

  // First pass: collect ids so related-checks can resolve forward references,
  // and count inbound links so unreachable nodes can be flagged.
  const inbound = new Map<string, number>();
  for (const n of NODES) {
    if (typeof n.id === "string") idSet.add(n.id);
    for (const r of n.related ?? []) inbound.set(r, (inbound.get(r) ?? 0) + 1);
  }

  const seen = new Set<string>();
  for (const n of NODES) {
    const id = typeof n.id === "string" && n.id ? n.id : "<missing-id>";

    if (id === "<missing-id>") {
      err(id, "node is missing a string id");
    } else if (seen.has(id)) {
      err(id, "duplicate id");
    }
    seen.add(id);

    // clusterId
    if (!n.clusterId || !clusterIds.has(n.clusterId)) {
      err(id, `clusterId "${n.clusterId}" not found in CLUSTERS`);
    } else if (id !== "<missing-id>" && !id.startsWith(n.clusterId)) {
      warn(id, `id does not start with its clusterId "${n.clusterId}"`);
    }

    // tags
    for (const t of n.tags ?? []) {
      if (!tagSet.has(t)) err(id, `tag "${t}" is not in TAGS`);
    }

    // quiz
    const q = n.quiz;
    if (!q) {
      err(id, "missing quiz");
    } else {
      const optLen = Array.isArray(q.options) ? q.options.length : 0;
      if (optLen < 3 || optLen > 4) {
        err(id, `quiz.options must have 3 or 4 entries (has ${optLen})`);
      }
      const maxIdx = Math.max(optLen - 1, 0);
      if (
        typeof q.correctIndex !== "number" ||
        !Number.isInteger(q.correctIndex) ||
        q.correctIndex < 0 ||
        q.correctIndex > maxIdx
      ) {
        err(id, `quiz.correctIndex must be an integer 0..${maxIdx} (is ${q.correctIndex})`);
      }
      if (!q.explanation) warn(id, "quiz has no explanation");
      if (
        Array.isArray(q.options) &&
        typeof q.correctIndex === "number" &&
        q.options[q.correctIndex] !== undefined
      ) {
        const correctLen = q.options[q.correctIndex].length;
        const longestDistractor = Math.max(
          0,
          ...q.options.filter((_, i) => i !== q.correctIndex).map((o) => o.length),
        );
        if (longestDistractor > 0 && correctLen > LENGTH_LEAK_RATIO * longestDistractor) {
          warn(
            id,
            `quiz answer-length leak: correct option is ${(correctLen / longestDistractor).toFixed(1)}x the longest distractor`,
          );
        }
      }
    }

    // related
    for (const r of n.related ?? []) {
      if (!idSet.has(r)) err(id, `related id "${r}" does not resolve to a real node`);
    }
    if ((n.related ?? []).length === 0) warn(id, "node has no related links");
    if (id !== "<missing-id>" && !inbound.has(id)) {
      warn(id, "no inbound links — unreachable via 'follow the thread'");
    }

    // furtherReading
    (n.furtherReading ?? []).forEach((f, i) => {
      const tag = `furtherReading[${i}]`;
      if (!f.label) err(id, `${tag} missing label`);
      if (!f.source) err(id, `${tag} missing source`);
      if (!f.url) err(id, `${tag} missing url`);
      const a = f.archive;
      if (a) {
        if (!a.status || !ARCHIVE_STATUSES.has(a.status)) {
          err(id, `${tag}.archive.status "${a.status}" invalid (full|excerpt|unavailable)`);
        }
        if (a.status === "full" || a.status === "excerpt") {
          if (!a.path) {
            err(id, `${tag}.archive.status is "${a.status}" but path is missing`);
          } else {
            const disk = path.join(PUBLIC_DIR, a.path);
            if (!fs.existsSync(disk)) {
              err(id, `${tag}.archive.path "${a.path}" -> missing file public/${a.path}`);
            }
          }
        }
      }
    });
  }

  // Report
  console.log(`Validated ${NODES.length} nodes.`);
  if (strict && warnings.length) {
    errors.push(...warnings);
    warnings.length = 0;
  }
  if (warnings.length) {
    if (quiet) {
      console.log(`${warnings.length} warning(s) (run without --quiet to list them).`);
    } else {
      console.log(`\n${warnings.length} WARNING(S):`);
      console.log(warnings.join("\n"));
    }
  }
  if (errors.length) {
    console.log(`\n${errors.length} ERROR(S):`);
    console.log(errors.join("\n"));
    console.log("\nFAIL");
    process.exit(1);
  }
  console.log("\nOK — no errors.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
