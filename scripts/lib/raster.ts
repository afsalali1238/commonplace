/**
 * Tiny deterministic rasteriser for the brand mark: antialiased round-capped
 * strokes on a (optionally rounded) tile, encoded as PNG or ICO with node
 * built-ins only. Deterministic so prebuild can regenerate assets without
 * dirtying the working tree.
 */
import * as zlib from "node:zlib";
import { MARK_ARMS, MARK_STROKE_WIDTH } from "../../src/lib/brandMark";

export type RGB = [number, number, number];
export type Seg = [number, number, number, number];
export interface Stroke {
  seg: Seg;
  /** Half the stroke width, in pixels. */
  r: number;
  color: RGB;
}

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/**
 * The mark's strokes, with its 0..100 viewBox mapped onto a square of
 * `viewBoxPx` pixels centred in a `size`×`size` canvas.
 */
export function markStrokes(
  size: number,
  viewBoxPx: number,
  colors: { ink: string; accent: string },
): Stroke[] {
  const k = viewBoxPx / 100;
  const o = (size - viewBoxPx) / 2;
  const ink = hexToRgb(colors.ink);
  const accent = hexToRgb(colors.accent);
  return MARK_ARMS.map((a) => ({
    seg: [o + a.x1 * k, o + a.y1 * k, o + a.x2 * k, o + a.y2 * k],
    r: (MARK_STROKE_WIDTH / 2) * k,
    color: a.accent ? accent : ink,
  }));
}

function distToSeg(px: number, py: number, [x1, y1, x2, y2]: Seg): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** Signed distance to a rounded square tile covering the whole canvas. */
function tileDist(px: number, py: number, size: number, radius: number): number {
  const half = size / 2;
  const qx = Math.abs(px - half) - (half - radius);
  const qy = Math.abs(py - half) - (half - radius);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - radius;
}

/**
 * Renders strokes over a paper tile into straight-alpha RGBA. With
 * `cornerRadius` 0 the tile is the full, opaque square.
 */
export function renderTile(
  size: number,
  background: RGB,
  cornerRadius: number,
  strokes: Stroke[],
): Uint8Array {
  const rgb = new Float64Array(size * size * 3);
  const alpha = new Float64Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const cov =
        cornerRadius > 0
          ? Math.max(0, Math.min(1, 0.5 - tileDist(x + 0.5, y + 0.5, size, cornerRadius)))
          : 1;
      alpha[i] = cov;
      rgb[i * 3] = background[0];
      rgb[i * 3 + 1] = background[1];
      rgb[i * 3 + 2] = background[2];
    }
  }
  for (const { seg, r, color } of strokes) {
    const minX = Math.max(0, Math.floor(Math.min(seg[0], seg[2]) - r - 1));
    const maxX = Math.min(size - 1, Math.ceil(Math.max(seg[0], seg[2]) + r + 1));
    const minY = Math.max(0, Math.floor(Math.min(seg[1], seg[3]) - r - 1));
    const maxY = Math.min(size - 1, Math.ceil(Math.max(seg[1], seg[3]) + r + 1));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const cov = Math.max(0, Math.min(1, r + 0.5 - distToSeg(x + 0.5, y + 0.5, seg)));
        if (cov <= 0) continue;
        const i = y * size + x;
        const a = cov + alpha[i] * (1 - cov);
        for (let c = 0; c < 3; c++) {
          rgb[i * 3 + c] = (color[c] * cov + rgb[i * 3 + c] * alpha[i] * (1 - cov)) / a;
        }
        alpha[i] = a;
      }
    }
  }
  const out = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    out[i * 4] = Math.round(rgb[i * 3]);
    out[i * 4 + 1] = Math.round(rgb[i * 3 + 1]);
    out[i * 4 + 2] = Math.round(rgb[i * 3 + 2]);
    out[i * 4 + 3] = Math.round(alpha[i] * 255);
  }
  return out;
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** RGBA → PNG. Opaque images are written as RGB (smaller, no alpha channel). */
export function encodePng(size: number, rgba: Uint8Array): Buffer {
  let opaque = true;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] !== 255) opaque = false;
  const ch = opaque ? 3 : 4;
  const raw = Buffer.alloc(size * (1 + size * ch));
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * ch);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      for (let c = 0; c < ch; c++) raw[row + 1 + x * ch + c] = rgba[(y * size + x) * 4 + c];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = opaque ? 2 : 6; // truecolor / truecolor + alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Packs PNG images into one multi-size .ico (PNG-in-ICO, all modern browsers/OSes). */
export function encodeIco(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, png }) => {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size; // width (0 = 256)
    e[1] = size >= 256 ? 0 : size; // height
    e[2] = 0; // palette size
    e[3] = 0; // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}
