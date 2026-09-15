/**
 * next-id.ts — deterministic id assignment for a cluster/prefix.
 *
 * Ids are a letter prefix + number (e.g. A1, O24, U9). Some clusters also use a
 * doubled-letter sub-series (e.g. AA5 inside cluster A) — so this tool assigns
 * against an explicit PREFIX, not a clusterId, to stay unambiguous.
 *
 * Usage (from repo root):
 *   bun run scripts/next-id.ts O          # -> next free id with prefix O
 *   bun run scripts/next-id.ts AA         # -> next free id in the AA sub-series
 *   bun run scripts/next-id.ts O 3        # -> next 3 free ids
 *
 * Prints the next id(s) on stdout (one per line) plus a summary on stderr, so it
 * can be consumed programmatically by the add-content flow.
 */
import { readAllContent } from "./lib/content";

async function main() {
  const prefix = process.argv[2];
  const count = Math.max(1, parseInt(process.argv[3] ?? "1", 10) || 1);
  if (!prefix || !/^[A-Z]+$/.test(prefix)) {
    console.error(
      'Usage: next-id.ts <PREFIX> [count]   (PREFIX = uppercase letters, e.g. "O" or "AA")',
    );
    process.exit(2);
  }
  const NODES: { id: string }[] = readAllContent().nodes;

  const re = new RegExp(`^${prefix}(\\d+)$`);
  const nums = NODES.map((n) => n.id.match(re))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => parseInt(m[1], 10));
  const max = nums.length ? Math.max(...nums) : 0;

  const out: string[] = [];
  for (let i = 1; i <= count; i++) out.push(`${prefix}${max + i}`);

  console.error(
    `prefix=${prefix}: ${nums.length} existing, highest=${prefix}${max || "(none)"} -> assigning ${out.join(", ")}`,
  );
  console.log(out.join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
