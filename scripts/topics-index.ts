/**
 * topics-index.ts — regenerates docs/TOPICS-INDEX.md AND docs/TOPICS-INDEX.csv, a full
 * internal directory of every cluster (topic) and every node (id, title, author,
 * category/subtopic) currently in content/clusters/*.json.
 *
 * The .csv is the one to open for quick checking — sort/filter by cluster, author, or
 * category in Excel/Sheets to answer "do we already have a node for X?" at a glance.
 * The .md is the same data as a readable table.
 *
 * Neither is wired into any route or the public/ folder — both are maintenance artifacts,
 * not a feature.
 *
 * Run after any content addition: `bun run scripts/topics-index.ts`
 * (also invoked automatically as the last step of the add-content skill's validate gate)
 */
import fs from "fs";
import { readAllContent } from "./lib/content";
import path from "path";

type Node = Record<string, unknown> & {
  id: string;
  clusterId: string;
  title: string;
  author?: string;
  year?: number;
  category?: string;
  subtopicId?: string;
};

async function main() {
  const content = readAllContent();
  const NODES: Node[] = content.nodes;
  const CLUSTERS: { id: string; title: string; subtitle?: string }[] = content.clusters;

  const lines: string[] = [];
  lines.push("# Topics Index (auto-generated — do not hand-edit)");
  lines.push("");
  // No "last generated" date: the CI freshness gate diffs this file against
  // a fresh regeneration, so a date stamp made the gate fail on every day
  // after the commit date (verified: run 34812646581 failed on main for
  // exactly this). Content changes still trip the gate; the date adds noise.
  lines.push("Regenerate with `bun run scripts/topics-index.ts`.");
  lines.push(`Total clusters: ${CLUSTERS.length}. Total nodes: ${NODES.length}.`);
  lines.push("");
  lines.push("Internal reference only — not linked from the app, not served from public/.");
  lines.push("");

  for (const c of CLUSTERS) {
    const nodes = NODES.filter((n) => n.clusterId === c.id).sort((a, b) =>
      a.id.localeCompare(b.id, undefined, { numeric: true }),
    );
    lines.push(`## ${c.id} — ${c.title} (${nodes.length})`);
    if (c.subtitle) lines.push(`_${c.subtitle}_`);
    lines.push("");
    if (nodes.length === 0) {
      lines.push("_(no nodes yet)_");
    } else {
      lines.push("| id | title | author | category/subtopic |");
      lines.push("| --- | --- | --- | --- |");
      for (const n of nodes) {
        lines.push(
          `| ${n.id} | ${n.title} | ${n.author ?? ""} | ${n.subtopicId ?? n.category ?? ""} |`,
        );
      }
    }
    lines.push("");
  }

  const outPath = path.join(process.cwd(), "docs/TOPICS-INDEX.md");
  fs.writeFileSync(outPath, lines.join("\n") + "\n");

  // --- CSV (the one to open for checking coverage) ---
  const csvEscape = (v: string) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csvRows: string[] = [
    "cluster_id,cluster_title,node_id,title,author,year,category_subtopic",
  ];
  for (const c of CLUSTERS) {
    const nodes = NODES.filter((n) => n.clusterId === c.id).sort((a, b) =>
      a.id.localeCompare(b.id, undefined, { numeric: true }),
    );
    if (nodes.length === 0) {
      csvRows.push([c.id, c.title, "", "", "", "", ""].map(csvEscape).join(","));
      continue;
    }
    for (const n of nodes) {
      csvRows.push(
        [
          c.id,
          c.title,
          n.id,
          n.title,
          n.author ?? "",
          n.year ?? "",
          n.subtopicId ?? n.category ?? "",
        ]
          .map(csvEscape)
          .join(","),
      );
    }
  }
  const csvPath = path.join(process.cwd(), "docs/TOPICS-INDEX.csv");
  fs.writeFileSync(csvPath, csvRows.join("\n") + "\n");

  console.log(
    `Wrote ${outPath} and ${csvPath} — ${NODES.length} nodes across ${CLUSTERS.length} clusters.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
