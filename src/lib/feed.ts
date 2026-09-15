import { NODES, type NodeIndex as Node } from "@/data/nodes";
import { readNextNodes } from "./store";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type FeedInputs = {
  interests: string[];
  likedIds: string[];
  visited: Record<string, boolean>;
  seed: number;
  readNext: string[];
  adjacencyShare?: number;
};

export type FeedSource = "queue" | "topic" | "adjacent";

export type FeedResult = {
  items: Node[];
  source: FeedSource[];
  exhausted: boolean;
  needsTopics: boolean;
};

export function buildFeed({
  interests,
  likedIds,
  visited,
  seed,
  readNext,
  adjacencyShare = 0.15,
}: FeedInputs): FeedResult {
  if (interests.length === 0) {
    return { items: [], source: [], exhausted: false, needsTopics: true };
  }

  const rand = mulberry32(seed || 1);
  const interestSet = new Set(interests);

  // Assign deterministic score to all nodes upfront so removing items from readNext
  // doesn't shift the PRNG sequence and cause the feed to reshuffle.
  const nodeScores = new Map<string, number>();
  for (const n of NODES) {
    nodeScores.set(n.id, rand() - 0.5);
  }

  const items: Node[] = [];
  const source: FeedSource[] = [];
  const includedIds = new Set<string>();

  // 1. Read Next nodes (deduped, queue order)
  const queuedNodes = readNextNodes(readNext, NODES);
  for (const n of queuedNodes) {
    if (!includedIds.has(n.id)) {
      items.push(n);
      source.push("queue");
      includedIds.add(n.id);
    }
  }

  // 2. Topic spine (tags intersect interests)
  const spineCandidates = NODES.filter(
    (n) => !includedIds.has(n.id) && n.tags.some((t) => interestSet.has(t)),
  );

  // Sort spine: !visited first, then shuffle with seeded PRNG
  spineCandidates.sort((a, b) => {
    const aVisited = visited[a.id] ? 1 : 0;
    const bVisited = visited[b.id] ? 1 : 0;
    if (aVisited !== bVisited) return aVisited - bVisited;
    return nodeScores.get(a.id)! - nodeScores.get(b.id)!;
  });

  // Exhausted = user has seen all topic+queue nodes
  const exhausted =
    queuedNodes.every((n) => visited[n.id]) && spineCandidates.every((n) => visited[n.id]);

  // Find adjacent candidates: NOT in interests, but in related of topic spine or liked nodes.
  const adjacentIds = new Set<string>();
  for (const n of NODES) {
    if (n.tags.some((t) => interestSet.has(t)) || likedIds.includes(n.id)) {
      if (n.related) {
        for (const r of n.related) {
          adjacentIds.add(r);
        }
      }
    }
  }

  const adjacentCandidates = NODES.filter(
    (n) =>
      !includedIds.has(n.id) && !n.tags.some((t) => interestSet.has(t)) && adjacentIds.has(n.id),
  );

  // Sort adjacent: !visited first, then shuffle
  adjacentCandidates.sort((a, b) => {
    const aVisited = visited[a.id] ? 1 : 0;
    const bVisited = visited[b.id] ? 1 : 0;
    if (aVisited !== bVisited) return aVisited - bVisited;
    return nodeScores.get(a.id)! - nodeScores.get(b.id)!;
  });

  let nonQueueCount = 0;
  let lastCluster = items.length > 0 ? items[items.length - 1].clusterId : "";
  const adjacentInterval = adjacencyShare > 0 ? Math.round(1 / adjacencyShare) : 0; // e.g. 1/0.15 = 7

  while (spineCandidates.length > 0 || adjacentCandidates.length > 0) {
    const isAdjacentTurn =
      adjacentInterval > 0 && nonQueueCount > 0 && (nonQueueCount + 1) % adjacentInterval === 0;

    let activePool =
      isAdjacentTurn && adjacentCandidates.length > 0 ? adjacentCandidates : spineCandidates;

    if (activePool.length === 0) {
      activePool = activePool === spineCandidates ? adjacentCandidates : spineCandidates;
    }

    if (activePool.length === 0) break;

    let idx = activePool.findIndex((n) => n.clusterId !== lastCluster);
    if (idx === -1) idx = 0;

    const [pick] = activePool.splice(idx, 1);

    items.push(pick);
    source.push(activePool === adjacentCandidates ? "adjacent" : "topic");
    includedIds.add(pick.id);
    lastCluster = pick.clusterId;
    nonQueueCount++;
  }

  return { items, source, exhausted, needsTopics: false };
}
