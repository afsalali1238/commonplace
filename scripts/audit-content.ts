/**
 * audit-content.ts — generalized content audit (replaces root-level find-health.ts).
 *
 * READ-ONLY. Inspects any tag, cluster, or field for consistency and coverage.
 *
 * Usage (from repo root):
 *   bun run scripts/audit-content.ts summary            # counts per cluster & per tag
 *   bun run scripts/audit-content.ts tag "Health & Body"
 *   bun run scripts/audit-content.ts cluster A
 *   bun run scripts/audit-content.ts field author       # missing/empty + distribution
 *   bun run scripts/audit-content.ts orphans            # nodes with no related links
 *   bun run scripts/audit-content.ts dupes title        # duplicate values of a field
 *   bun run scripts/audit-content.ts hooks               # flag weak layer0 cold-opens (for the feed)
 */
import { readAllContent } from "./lib/content";

type Node = Record<string, unknown> & {
  id: string;
  clusterId: string;
  tags?: string[];
  related?: string[];
};

function table(rows: [string, string | number][], head: [string, string]) {
  const w = Math.max(head[0].length, ...rows.map((r) => String(r[0]).length));
  console.log(`${head[0].padEnd(w)}  ${head[1]}`);
  console.log(`${"-".repeat(w)}  ${"-".repeat(head[1].length)}`);
  for (const [a, b] of rows) console.log(`${String(a).padEnd(w)}  ${b}`);
}

async function main() {
  const [cmd, arg] = [process.argv[2] ?? "summary", process.argv[3]];
  const content = readAllContent();
  const NODES: Node[] = content.nodes;
  const CLUSTERS: { id: string; title: string }[] = content.clusters;
  const TAGS: readonly string[] = content.tags;

  switch (cmd) {
    case "summary": {
      console.log(`Total nodes: ${NODES.length}\n`);
      const byCluster = CLUSTERS.map(
        (c) =>
          [`${c.id} ${c.title}`, NODES.filter((n) => n.clusterId === c.id).length] as [
            string,
            number,
          ],
      );
      table(byCluster, ["Cluster", "Nodes"]);
      console.log();
      const tagCount = new Map<string, number>();
      for (const n of NODES)
        for (const t of n.tags ?? []) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
      const tagRows = [...tagCount.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([t, c]) => {
          const known = TAGS.includes(t) ? "" : "  ⚠ not in TAGS";
          return [`${t}${known}`, c] as [string, number];
        });
      table(tagRows, ["Tag", "Uses"]);
      break;
    }
    case "tag": {
      if (!arg) return console.error('Usage: audit-content.ts tag "<Tag>"');
      const hits = NODES.filter((n) => (n.tags ?? []).includes(arg));
      console.log(`${hits.length} node(s) tagged "${arg}":`);
      for (const n of hits) console.log(`  ${n.id}  [${n.clusterId}]  ${n.title}`);
      break;
    }
    case "cluster": {
      if (!arg) return console.error("Usage: audit-content.ts cluster <ID>");
      const hits = NODES.filter((n) => n.clusterId === arg);
      console.log(`${hits.length} node(s) in cluster ${arg}:`);
      for (const n of hits) console.log(`  ${n.id}  ${n.title}`);
      break;
    }
    case "field": {
      if (!arg) return console.error("Usage: audit-content.ts field <name>");
      const missing = NODES.filter(
        (n) =>
          n[arg] === undefined || n[arg] === "" || (Array.isArray(n[arg]) && n[arg].length === 0),
      );
      console.log(
        `Field "${arg}": ${NODES.length - missing.length}/${NODES.length} populated, ${missing.length} empty/missing.`,
      );
      for (const n of missing) console.log(`  empty: ${n.id}  ${n.title}`);
      break;
    }
    case "orphans": {
      const noRelated = NODES.filter((n) => (n.related ?? []).length === 0);
      const inbound = new Set<string>();
      for (const n of NODES) for (const r of n.related ?? []) inbound.add(r);
      const noInbound = NODES.filter((n) => !inbound.has(n.id));
      console.log(`${noRelated.length} node(s) with no outgoing related links:`);
      for (const n of noRelated) console.log(`  ${n.id}  ${n.title}`);
      console.log(
        `\n${noInbound.length} node(s) with no incoming links (nothing relates to them):`,
      );
      for (const n of noInbound) console.log(`  ${n.id}  ${n.title}`);
      break;
    }
    case "dupes": {
      if (!arg) return console.error("Usage: audit-content.ts dupes <field>");
      const seen = new Map<string, string[]>();
      for (const n of NODES) {
        const v = String(n[arg]).trim().toLowerCase();
        if (!seen.has(v)) seen.set(v, []);
        seen.get(v)!.push(n.id);
      }
      const dupes = [...seen.entries()].filter(([, ids]) => ids.length > 1);
      console.log(`${dupes.length} duplicate value(s) of "${arg}":`);
      for (const [v, ids] of dupes) console.log(`  "${v}" -> ${ids.join(", ")}`);
      break;
    }
    case "hooks": {
      // A feed card shows layer0 as a cold open — it must stop the thumb without
      // any surrounding context. Flag hooks that bury the idea or don't fit a card.
      const WEAK_OPENER =
        /^\s*(this |in this |the (essay|paper|article|author|book|video|piece|chapter|report)\b|here,? |it |these )/i;
      const flagged: { id: string; title: string; reasons: string[] }[] = [];
      for (const n of NODES) {
        const l0 = (n.layer0 ?? "").trim();
        const reasons: string[] = [];
        if (!l0) reasons.push("empty layer0");
        else {
          if (WEAK_OPENER.test(l0)) reasons.push("weak/meta opener");
          if (l0.length < 120) reasons.push(`short (${l0.length} chars)`);
          const firstSentence = l0.split(/(?<=[.!?])\s/)[0] ?? l0;
          if (firstSentence.length > 240)
            reasons.push(`long first sentence (${firstSentence.length} chars)`);
        }
        if (reasons.length) flagged.push({ id: n.id, title: n.title, reasons });
      }
      console.log(
        `Hook check: ${flagged.length}/${NODES.length} nodes flagged (review — not all are wrong).`,
      );
      for (const f of flagged) console.log(`  ${f.id}  [${f.reasons.join(", ")}]  ${f.title}`);
      break;
    }
    default:
      console.error(
        `Unknown command "${cmd}". Try: summary | tag | cluster | field | orphans | dupes | hooks`,
      );
      process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
