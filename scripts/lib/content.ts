/**
 * The content layer's on-disk format and the one loader every script uses.
 *
 * Source of truth: `content/clusters/<clusterId>.json`, one file per cluster,
 * each `{ cluster: {...}, nodes: [...] }` with the full node objects. Plus
 * `content/tags.json` (the fixed interest vocabulary) and `content/clusters.json`
 * (the ordered list of cluster ids — the file system doesn't keep order).
 *
 * `bun run scripts/build-content.ts` derives from those:
 *   - src/data/nodes.ts             the always-bundled INDEX (no bodies)
 *   - public/content/bodies/<id>.json  per-cluster BODIES, fetched on demand
 *
 * Nothing in src/ reads content/ directly; nothing in scripts/ edits
 * src/data/nodes.ts. Write JSON, run the build, commit both.
 */
import fs from "node:fs";
import path from "node:path";
import * as prettier from "prettier";

export type FurtherReading = {
  label: string;
  source: string;
  url: string;
  type?: string;
  archive?: { status: "full" | "excerpt" | "unavailable"; path?: string; retrieved?: string };
};

export type Quiz = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
};

export type FullNode = {
  id: string;
  clusterId: string;
  title: string;
  author: string;
  year: number;
  medium: string;
  category: string;
  thesis: string;
  layer0?: string;
  layer1?: string;
  layer2?: string;
  quiz: Quiz;
  related: string[];
  furtherReading: FurtherReading[];
  tags: string[];
  epistemicStatus?: "Canonical" | "Contemporary" | "Speculative";
};

export type Cluster = { id: string; title: string; subtitle: string; icon: string };

export type ClusterFile = { cluster: Cluster; nodes: FullNode[] };

/** Fields that live in the body file, not the bundled index. */
export const BODY_FIELDS = ["layer1", "layer2", "quiz", "furtherReading"] as const;
export type BodyField = (typeof BODY_FIELDS)[number];

export const CONTENT_DIR = path.join(process.cwd(), "content");
export const CLUSTERS_DIR = path.join(CONTENT_DIR, "clusters");

/** Key order inside a node object — fixed so diffs stay minimal and readable. */
const NODE_KEY_ORDER: (keyof FullNode)[] = [
  "id",
  "clusterId",
  "title",
  "author",
  "year",
  "medium",
  "category",
  "epistemicStatus",
  "thesis",
  "layer0",
  "layer1",
  "layer2",
  "quiz",
  "related",
  "furtherReading",
  "tags",
];

export function normalizeNode(n: FullNode): FullNode {
  const out: Record<string, unknown> = {};
  for (const k of NODE_KEY_ORDER) if (n[k] !== undefined) out[k] = n[k];
  // Anything not in the known order goes last (so an unknown field is
  // visible in review rather than silently dropped).
  for (const k of Object.keys(n)) if (!(k in out)) out[k] = (n as Record<string, unknown>)[k];
  return out as FullNode;
}

export function readClusterOrder(): string[] {
  return JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, "clusters.json"), "utf8"));
}

export function readTags(): string[] {
  return JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, "tags.json"), "utf8"));
}

export function readClusterFile(clusterId: string): ClusterFile {
  return JSON.parse(fs.readFileSync(path.join(CLUSTERS_DIR, `${clusterId}.json`), "utf8"));
}

/**
 * Serialize JSON the way `bun run format` (Prettier) would, so a content file
 * written by a script is byte-stable under the formatter — otherwise every
 * archive run would be followed by a spurious whole-file re-format diff.
 */
export async function formatJson(value: unknown, filepath: string): Promise<string> {
  const config = (await prettier.resolveConfig(filepath)) ?? {};
  return prettier.format(JSON.stringify(value, null, 2), { ...config, filepath });
}

export async function writeClusterFile(file: ClusterFile): Promise<void> {
  fs.mkdirSync(CLUSTERS_DIR, { recursive: true });
  const body = { cluster: file.cluster, nodes: file.nodes.map(normalizeNode) };
  const target = path.join(CLUSTERS_DIR, `${file.cluster.id}.json`);
  fs.writeFileSync(target, await formatJson(body, target));
}

/** Everything, in canonical cluster order. */
export function readAllContent(): {
  clusters: Cluster[];
  nodes: FullNode[];
  tags: string[];
  files: ClusterFile[];
} {
  const order = readClusterOrder();
  const files = order.map(readClusterFile);
  return {
    clusters: files.map((f) => f.cluster),
    nodes: files.flatMap((f) => f.nodes),
    tags: readTags(),
    files,
  };
}
