/**
 * generate-og-image.ts — rasterizes the Marginalia brand mark plus a
 * stroke-glyph wordmark into public/og.png (1200x630) for og:image /
 * twitter:image. Pure node built-ins (zlib), no image deps; deterministic,
 * so re-running it always yields the same asset.
 *
 * Run: npx tsx scripts/generate-og-image.ts
 */
import * as zlib from "node:zlib";
import * as fs from "node:fs";
import * as path from "node:path";

const W = 1200;
const H = 630;

const PAPER = [0xfa, 0xf8, 0xf3];
const INK = [0x1a, 0x1a, 0x17];
const ACCENT = [0xb4, 0x53, 0x09];

type Seg = [number, number, number, number];
type RGB = [number, number, number];

// Marginalia mark geometry, same 0..100 viewBox as public/logo.svg.
const MARK: { seg: Seg; color: RGB }[] = [
  { seg: [50, 24.6, 50, 75.4], color: INK },
  { seg: [27.9, 37.3, 72.1, 62.7], color: INK },
  { seg: [27.9, 62.7, 72.1, 37.3], color: INK },
  { seg: [50, 50, 72.1, 37.3], color: ACCENT },
];
const MARK_RADIUS = 7.4;

// Angular 4x6 stroke glyphs (micro-label aesthetic). Segments in grid units.
const GLYPHS: Record<string, Seg[]> = {
  A: [
    [0, 6, 2, 0],
    [2, 0, 4, 6],
    [0.9, 4, 3.1, 4],
  ],
  C: [
    [4, 0, 0, 0],
    [0, 0, 0, 6],
    [0, 6, 4, 6],
  ],
  D: [
    [0, 0, 0, 6],
    [0, 0, 3, 0],
    [3, 0, 4, 1],
    [4, 1, 4, 5],
    [4, 5, 3, 6],
    [3, 6, 0, 6],
  ],
  E: [
    [4, 0, 0, 0],
    [0, 0, 0, 6],
    [0, 6, 4, 6],
    [0, 3, 3, 3],
  ],
  F: [
    [4, 0, 0, 0],
    [0, 0, 0, 6],
    [0, 3, 3, 3],
  ],
  I: [
    [1, 0, 3, 0],
    [2, 0, 2, 6],
    [1, 6, 3, 6],
  ],
  K: [
    [0, 0, 0, 6],
    [4, 0, 0, 3],
    [0, 3, 4, 6],
  ],
  L: [
    [0, 0, 0, 6],
    [0, 6, 4, 6],
  ],
  M: [
    [0, 6, 0, 0],
    [0, 0, 2, 3],
    [2, 3, 4, 0],
    [4, 0, 4, 6],
  ],
  N: [
    [0, 6, 0, 0],
    [0, 0, 4, 6],
    [4, 6, 4, 0],
  ],
  O: [
    [0, 0, 4, 0],
    [4, 0, 4, 6],
    [4, 6, 0, 6],
    [0, 6, 0, 0],
  ],
  P: [
    [0, 6, 0, 0],
    [0, 0, 4, 0],
    [4, 0, 4, 3],
    [4, 3, 0, 3],
  ],
  R: [
    [0, 6, 0, 0],
    [0, 0, 4, 0],
    [4, 0, 4, 3],
    [4, 3, 0, 3],
    [1, 3, 4, 6],
  ],
  S: [
    [4, 0, 0, 0],
    [0, 0, 0, 3],
    [0, 3, 4, 3],
    [4, 3, 4, 6],
    [4, 6, 0, 6],
  ],
  T: [
    [0, 0, 4, 0],
    [2, 0, 2, 6],
  ],
  U: [
    [0, 0, 0, 6],
    [0, 6, 4, 6],
    [4, 6, 4, 0],
  ],
  W: [
    [0, 0, 0, 6],
    [0, 6, 2, 3],
    [2, 3, 4, 6],
    [4, 6, 4, 0],
  ],
  " ": [],
};

function distToSeg(px: number, py: number, s: Seg): number {
  const [x1, y1, x2, y2] = s;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Every drawable stroke in pixel space with its radius and color.
const strokes: { seg: Seg; r: number; color: RGB }[] = [];

// Mark: viewBox 0..100 -> pixel square of MARK_SIZE centered at (W/2, 235).
const MARK_SIZE = 300;
const mTop = 235 - MARK_SIZE / 2;
for (const { seg, color } of MARK) {
  strokes.push({
    seg: [
      (seg[0] / 100) * MARK_SIZE + (W - MARK_SIZE) / 2,
      (seg[1] / 100) * MARK_SIZE + mTop,
      (seg[2] / 100) * MARK_SIZE + (W - MARK_SIZE) / 2,
      (seg[3] / 100) * MARK_SIZE + mTop,
    ],
    r: (MARK_RADIUS / 100) * MARK_SIZE,
    color,
  });
}

function addText(
  text: string,
  centerX: number,
  topY: number,
  unit: number,
  tracking: number,
  color: RGB,
) {
  const adv = 4 * unit + tracking;
  const total = adv * text.length - tracking;
  let x = centerX - total / 2;
  for (const ch of text) {
    for (const s of GLYPHS[ch] ?? []) {
      strokes.push({
        seg: [x + s[0] * unit, topY + s[1] * unit, x + s[2] * unit, topY + s[3] * unit],
        r: unit * 0.42,
        color,
      });
    }
    x += adv;
  }
}

addText("COMMONPLACE", W / 2, 425, 12, 12, INK);
addText("A LATTICEWORK OF POWERFUL IDEAS", W / 2, 525, 4.6, 7, ACCENT);

// Rasterize with 1px antialiased coverage.
const px = new Float64Array(W * H * 3);
for (let i = 0; i < W * H; i++) {
  px[i * 3] = PAPER[0];
  px[i * 3 + 1] = PAPER[1];
  px[i * 3 + 2] = PAPER[2];
}
for (const { seg, r, color } of strokes) {
  const minX = Math.max(0, Math.floor(Math.min(seg[0], seg[2]) - r - 1));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(seg[0], seg[2]) + r + 1));
  const minY = Math.max(0, Math.floor(Math.min(seg[1], seg[3]) - r - 1));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(seg[1], seg[3]) + r + 1));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d = distToSeg(x + 0.5, y + 0.5, seg);
      const cov = Math.max(0, Math.min(1, r + 0.5 - d));
      if (cov <= 0) continue;
      const i = (y * W + x) * 3;
      px[i] = px[i] * (1 - cov) + color[0] * cov;
      px[i + 1] = px[i + 1] * (1 - cov) + color[1] * cov;
      px[i + 2] = px[i + 2] * (1 - cov) + color[2] * cov;
    }
  }
}

// --- PNG encoding (truecolor, filter 0) ---
function crc32(buf: Buffer): number {
  let c: number;
  const table =
    crc32.table ??
    (crc32.table = (() => {
      const t = new Int32Array(256);
      for (let n = 0; n < 256; n++) {
        c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
      }
      return t;
    })());
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
(crc32 as unknown as { table?: Int32Array }).table = undefined;

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 3)] = 0;
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    const o = y * (1 + W * 3) + 1 + x * 3;
    raw[o] = Math.round(px[i]);
    raw[o + 1] = Math.round(px[i + 1]);
    raw[o + 2] = Math.round(px[i + 2]);
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // truecolor
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const out = path.join(process.cwd(), "public", "og.png");
fs.writeFileSync(out, png);
console.log(`Wrote ${out} (${png.length} bytes, ${W}x${H})`);
