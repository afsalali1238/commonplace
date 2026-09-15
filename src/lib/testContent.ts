/**
 * Test-only: the full corpus (index + bodies) read straight from
 * content/clusters/*.json — the source of truth — so whole-corpus tests
 * (quiz shuffle bias, validator invariants) keep covering every node after
 * the bundle split. Never import this from app code: it uses node:fs.
 */
import fs from "node:fs";
import path from "node:path";
import type { Node } from "@/data/nodes";

let cache: Node[] | undefined;

export function allFullNodes(): Node[] {
  if (cache) return cache;
  const root = path.join(process.cwd(), "content");
  const order: string[] = JSON.parse(fs.readFileSync(path.join(root, "clusters.json"), "utf8"));
  cache = order.flatMap(
    (id) =>
      JSON.parse(fs.readFileSync(path.join(root, "clusters", `${id}.json`), "utf8"))
        .nodes as Node[],
  );
  return cache;
}
