import { describe, it, expect } from "vitest";
import { buildFeed } from "./feed";
import { NODES, TAGS } from "@/data/nodes";

// A real tag with a healthy node count. The previous version of this file
// used "Startups Fundamentals" — which is NOT in TAGS — so buildFeed returned
// zero items and every assertion below the first passed vacuously (the
// adjacency check was behind `if (items.length > 7)` and never ran).
const TAG = "Startups & Founders";
const nodesWithTag = (tag: string) => NODES.filter((n) => n.tags.includes(tag));

describe("buildFeed", () => {
  it("test fixture tag actually exists and has content", () => {
    expect(TAGS).toContain(TAG);
    expect(nodesWithTag(TAG).length).toBeGreaterThan(10);
  });

  it("returns needsTopics=true when interests are empty", () => {
    const res = buildFeed({ interests: [], likedIds: [], visited: {}, seed: 1, readNext: [] });
    expect(res.needsTopics).toBe(true);
    expect(res.items).toEqual([]);
    expect(res.source).toEqual([]);
    expect(res.exhausted).toBe(false);
  });

  it("surfaces every node tagged with an interest, each exactly once", () => {
    const res = buildFeed({ interests: [TAG], likedIds: [], visited: {}, seed: 7, readNext: [] });
    const ids = res.items.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const n of nodesWithTag(TAG)) expect(ids).toContain(n.id);
    expect(res.items.length).toBeGreaterThan(nodesWithTag(TAG).length); // plus adjacent picks
    expect(res.source.length).toBe(res.items.length);
  });

  it("puts the Read Next queue first, in order, deduped, and never repeats it later", () => {
    const res = buildFeed({
      interests: [TAG],
      likedIds: [],
      visited: {},
      seed: 1,
      readNext: ["A1", "A1", "B1"],
    });
    expect(res.items[0].id).toBe("A1");
    expect(res.items[1].id).toBe("B1");
    expect(res.source.slice(0, 2)).toEqual(["queue", "queue"]);
    expect(res.items.filter((n) => n.id === "A1")).toHaveLength(1);
  });

  it("is deterministic for a seed and different across seeds", () => {
    const args = { interests: [TAG], likedIds: [], visited: {}, readNext: [] };
    const a = buildFeed({ ...args, seed: 42 }).items.map((n) => n.id);
    const b = buildFeed({ ...args, seed: 42 }).items.map((n) => n.id);
    const c = buildFeed({ ...args, seed: 43 }).items.map((n) => n.id);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect([...a].sort()).toEqual([...c].sort()); // same set, different order
  });

  it("ranks unvisited nodes ahead of visited ones within the topic spine", () => {
    const tagged = nodesWithTag(TAG);
    const visited: Record<string, boolean> = {};
    for (const n of tagged.slice(0, 5)) visited[n.id] = true;
    const res = buildFeed({ interests: [TAG], likedIds: [], visited, seed: 3, readNext: [] });
    const topicItems = res.items.filter((_, i) => res.source[i] === "topic");
    const firstVisitedIdx = topicItems.findIndex((n) => visited[n.id]);
    const lastUnvisitedIdx = topicItems.map((n) => !visited[n.id]).lastIndexOf(true);
    expect(firstVisitedIdx).toBeGreaterThan(lastUnvisitedIdx);
  });

  it("never shows two consecutive cards from the same cluster when it can avoid it", () => {
    const res = buildFeed({
      interests: [TAG, "Decision-Making", "Macro & Cycles"],
      likedIds: [],
      visited: {},
      seed: 11,
      readNext: [],
    });
    let backToBack = 0;
    for (let i = 1; i < res.items.length; i++) {
      if (res.items[i].clusterId === res.items[i - 1].clusterId) backToBack++;
    }
    // The tail of the pool can force a repeat; the body of the feed must not.
    expect(backToBack).toBeLessThanOrEqual(2);
  });

  it("interleaves adjacent (off-topic but related) cards at the configured share", () => {
    const res = buildFeed({
      interests: [TAG],
      likedIds: [],
      visited: {},
      seed: 1,
      readNext: [],
      adjacencyShare: 0.15,
    });
    expect(res.items.length).toBeGreaterThan(7);
    // 1/0.15 rounds to 7 → the 7th non-queue card (index 6) is the first adjacent slot.
    expect(res.source[6]).toBe("adjacent");
    const adjacent = res.items.filter((_, i) => res.source[i] === "adjacent");
    expect(adjacent.length).toBeGreaterThan(0);
    for (const n of adjacent) expect(n.tags).not.toContain(TAG);
  });

  it("reports exhausted only once every topic node has been visited", () => {
    const fresh = buildFeed({ interests: [TAG], likedIds: [], visited: {}, seed: 1, readNext: [] });
    expect(fresh.exhausted).toBe(false);

    // Exhausted means every topic-pool node is visited: the tagged spine AND
    // the adjacent (related, off-tag) nodes that the feed interleaves.
    const visited: Record<string, boolean> = {};
    for (const n of nodesWithTag(TAG)) {
      visited[n.id] = true;
      for (const r of n.related) visited[r] = true;
    }
    const done = buildFeed({ interests: [TAG], likedIds: [], visited, seed: 1, readNext: [] });
    expect(done.exhausted).toBe(true);
    // Exhausted still returns the cards (marked read) rather than an empty feed.
    expect(done.items.length).toBeGreaterThan(0);
  });
});
