/**
 * Generative brand artwork — the app's entire image system.
 *
 * The product is text-first (FEED-SPEC §7: "No images, so cards are
 * text-cheap") and must work offline, so instead of shipping raster
 * illustrations every visual is *derived*: a deterministic drawing computed
 * from an id, rendered as inline SVG in the paper/ink/accent tokens. That
 * gives us:
 *
 *   - zero asset bytes, nothing extra to precache in the service worker;
 *   - automatic dark mode (the SVG uses `currentColor` and CSS variables);
 *   - one image per idea for all 387 nodes and every future one, with no
 *     content-authoring step;
 *   - a family resemblance across the whole app, because every drawing is
 *     built from the same three primitives as the logo: the spiral, the
 *     thread, and the single accent dot.
 *
 * Two artefacts:
 *
 *   `plateSpec(clusterId)` — a topic "plate": a field of concentric arcs
 *   (the spiral unwound) whose count, spread and gap come from the id, plus
 *   a thread that runs across it and a single accent knot. Used as the
 *   cover on Explore topic cards and the head of a cluster page.
 *
 *   `glyphSpec(nodeId)` — an idea "glyph": a small constellation of dots
 *   joined by a thread (a tiny piece of the lattice), one dot in accent.
 *   Used as the mark on feed cards, node pages, skim cards and review.
 *
 * Both are pure functions of their inputs (seeded by `hashString`), so the
 * server and the client draw the same thing and there is no hydration
 * mismatch. Numbers are rounded to two decimals to keep the SVG small and
 * deterministic across JS engines.
 */
import { hashString, mulberry32 } from "./random";

const r2 = (n: number) => Math.round(n * 100) / 100;

export type Arc = { r: number; start: number; sweep: number; weight: number };
export type PlateSpec = {
  /** viewBox is always 0 0 100 100 */
  cx: number;
  cy: number;
  arcs: Arc[];
  /** the accent knot */
  knot: { x: number; y: number; r: number };
  /** thread polyline through the field, in viewBox units */
  thread: Array<[number, number]>;
};

export type GlyphSpec = {
  /** viewBox is always 0 0 24 24 */
  points: Array<[number, number]>;
  /** index into `points` that gets the accent fill */
  accent: number;
  /** edges as index pairs, forming one continuous thread */
  edges: Array<[number, number]>;
};

/** Point on an arc of radius r around (cx,cy) at angle a (radians). */
function polar(cx: number, cy: number, r: number, a: number): [number, number] {
  return [r2(cx + r * Math.cos(a)), r2(cy + r * Math.sin(a))];
}

/** SVG path `d` for an arc from `start` sweeping `sweep` radians. */
export function arcPath(cx: number, cy: number, arc: Arc): string {
  const [x1, y1] = polar(cx, cy, arc.r, arc.start);
  const [x2, y2] = polar(cx, cy, arc.r, arc.start + arc.sweep);
  const large = Math.abs(arc.sweep) > Math.PI ? 1 : 0;
  const dir = arc.sweep > 0 ? 1 : 0;
  return `M ${x1} ${y1} A ${arc.r} ${arc.r} 0 ${large} ${dir} ${x2} ${y2}`;
}

export function plateSpec(clusterId: string): PlateSpec {
  const rand = mulberry32(hashString(`plate:${clusterId}`));
  // Four compositions, chosen by id, so a grid of topics doesn't read as one
  // drawing repeated: the spiral's origin can sit in any quadrant that keeps
  // it clear of the title block (bottom-left on cards), and the ring field
  // can be tight (many close rings) or open (few wide ones).
  const corner = Math.floor(rand() * 4); // 0 TR, 1 TL-high, 2 R-mid, 3 T-centre
  const cx = r2([70, 22, 92, 50][corner] + (rand() - 0.5) * 16);
  const cy = r2([22, 6, 50, 4][corner] + (rand() - 0.5) * 12);
  const tight = rand() < 0.45;
  const count = tight ? 7 + Math.floor(rand() * 4) : 4 + Math.floor(rand() * 3); // 7–10 or 4–6
  const gap = tight ? 5 + rand() * 3 : 10 + rand() * 6;
  const baseStart = rand() * Math.PI * 2;
  const arcs: Arc[] = [];
  for (let i = 0; i < count; i++) {
    const r = r2(6 + i * gap);
    // Sweeps open up as the rings widen (a spiral unwinding), with a little
    // jitter and the occasional counter-arc so no two fields share a rhythm.
    const sweep = r2((1.1 + (i / count) * 2.2 + rand() * 0.6) * (rand() < 0.18 ? -1 : 1));
    const start = r2(baseStart + i * 0.42 + (rand() - 0.5) * 0.8);
    const weight = r2(0.8 + (1 - i / count) * 1.2);
    arcs.push({ r, start, sweep, weight });
  }
  // The thread: enters from one edge and leaves by another, its knot at a
  // bend. It stays in the upper ~60% of the plate — the lower band is where
  // a card's title sits, and type always wins over ornament.
  let thread: Array<[number, number]>;
  if (corner === 1) {
    // origin top-left: the thread falls down the right-hand side
    const x0 = r2(64 + rand() * 20);
    thread = [
      [x0, -2],
      [r2(x0 + 8 + rand() * 10), r2(22 + rand() * 10)],
      [r2(x0 - 10 - rand() * 12), r2(44 + rand() * 10)],
      [r2(x0 + 6), 62],
    ];
  } else if (corner === 2) {
    // origin right-middle: the thread climbs from the left edge to the top right
    thread = [
      [-2, r2(50 + rand() * 8)],
      [r2(24 + rand() * 10), r2(30 + rand() * 10)],
      [r2(50 + rand() * 12), r2(38 + rand() * 8)],
      [102, r2(8 + rand() * 10)],
    ];
  } else {
    // origin top: the thread crosses the middle band, rising to the right
    const y0 = r2(46 + rand() * 12);
    thread = [
      [-2, y0],
      [r2(28 + rand() * 12), r2(y0 - 12 - rand() * 10)],
      [r2(58 + rand() * 12), r2(y0 - 2 + rand() * 6)],
      [102, r2(y0 - 20 - rand() * 12)],
    ];
  }
  const knotAt = thread[1 + Math.floor(rand() * 2)];
  return { cx, cy, arcs, knot: { x: knotAt[0], y: knotAt[1], r: r2(2.2 + rand() * 1) }, thread };
}

export function glyphSpec(nodeId: string): GlyphSpec {
  const rand = mulberry32(hashString(`glyph:${nodeId}`));
  const n = 4 + Math.floor(rand() * 3); // 4–6 points
  const points: Array<[number, number]> = [];
  // Points on a loose ring with radial jitter: constellations, not grids.
  const a0 = rand() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.9;
    const r = 5.5 + rand() * 4;
    points.push([r2(12 + r * Math.cos(a)), r2(12 + r * Math.sin(a))]);
  }
  // One continuous thread visiting every point in order plus one chord, so
  // there's always a closed shape somewhere in it (a piece of lattice, not
  // a broken line).
  const edges: Array<[number, number]> = [];
  for (let i = 0; i < n - 1; i++) edges.push([i, i + 1]);
  const chordFrom = Math.floor(rand() * (n - 2));
  edges.push([n - 1, chordFrom]);
  return { points, accent: Math.floor(rand() * n), edges };
}

/** Deterministic "progress" ordering of a glyph's points, so partial
 *  completion (e.g. Leitner box 3 of 5) can light dots up in a stable order. */
export function glyphLitCount(spec: GlyphSpec, fraction: number): number {
  const f = Math.max(0, Math.min(1, fraction));
  return Math.round(f * spec.points.length);
}
