import { describe, expect, it } from "vitest";
import { CLUSTERS, NODES } from "@/data/nodes";
import { arcPath, glyphSpec, plateSpec } from "./artwork";

describe("plateSpec", () => {
  it("is deterministic (same id → identical drawing, so SSR and client agree)", () => {
    expect(plateSpec("A")).toEqual(plateSpec("A"));
    expect(JSON.stringify(plateSpec("Q"))).toBe(JSON.stringify(plateSpec("Q")));
  });

  it("gives every cluster a distinct plate", () => {
    const seen = new Set(CLUSTERS.map((c) => JSON.stringify(plateSpec(c.id))));
    expect(seen.size).toBe(CLUSTERS.length);
  });

  it("keeps the thread out of the title band (lower 35% of the plate)", () => {
    // Explore cards put the title at the bottom of the plate; the thread
    // must never run through it. The fade-out gradient is a belt, this is
    // the braces.
    for (const c of CLUSTERS) {
      const { thread, knot } = plateSpec(c.id);
      for (const [, y] of thread) expect(y).toBeLessThanOrEqual(66);
      expect(knot.y).toBeLessThanOrEqual(66);
    }
  });

  it("produces finite, rounded geometry and valid arc paths", () => {
    for (const c of CLUSTERS) {
      const spec = plateSpec(c.id);
      expect(spec.arcs.length).toBeGreaterThanOrEqual(4);
      expect(spec.arcs.length).toBeLessThanOrEqual(10);
      for (const arc of spec.arcs) {
        expect(Number.isFinite(arc.r)).toBe(true);
        expect(arc.r).toBeGreaterThan(0);
        expect(Math.abs(arc.sweep)).toBeLessThan(2 * Math.PI);
        expect(arcPath(spec.cx, spec.cy, arc)).toMatch(
          /^M [-\d.]+ [-\d.]+ A [\d.]+ [\d.]+ 0 [01] [01] [-\d.]+ [-\d.]+$/,
        );
      }
    }
  });
});

describe("glyphSpec", () => {
  it("is deterministic", () => {
    expect(glyphSpec("A1")).toEqual(glyphSpec("A1"));
  });

  it("gives (almost) every node a distinct glyph", () => {
    // 4–6 points with continuous coordinates: collisions are astronomically
    // unlikely, but assert a near-total bound rather than exact equality so a
    // future tweak to rounding can't make this flaky.
    const seen = new Set(NODES.map((n) => JSON.stringify(glyphSpec(n.id))));
    expect(seen.size).toBeGreaterThanOrEqual(NODES.length - 1);
  });

  it("stays inside its 24×24 viewBox with a margin for the dot radius", () => {
    for (const n of NODES) {
      const { points, accent, edges } = glyphSpec(n.id);
      expect(points.length).toBeGreaterThanOrEqual(4);
      expect(points.length).toBeLessThanOrEqual(6);
      for (const [x, y] of points) {
        expect(x).toBeGreaterThanOrEqual(2);
        expect(x).toBeLessThanOrEqual(22);
        expect(y).toBeGreaterThanOrEqual(2);
        expect(y).toBeLessThanOrEqual(22);
      }
      expect(accent).toBeGreaterThanOrEqual(0);
      expect(accent).toBeLessThan(points.length);
      for (const [a, b] of edges) {
        expect(a).not.toBe(b);
        expect(points[a]).toBeDefined();
        expect(points[b]).toBeDefined();
      }
    }
  });

  it("is one continuous thread plus a closing chord", () => {
    const { points, edges } = glyphSpec("J5");
    expect(edges.length).toBe(points.length);
    for (let i = 0; i < points.length - 1; i++) expect(edges[i]).toEqual([i, i + 1]);
  });
});
