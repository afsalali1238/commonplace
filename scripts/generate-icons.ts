/**
 * generate-icons.ts — rasterises the Marginalia mark (src/lib/brandMark.ts)
 * into every raster icon the app ships, so the favicon, the home-screen
 * icon and the installed-app icon can never disagree with the mark again
 * (they did: all of them kept the pre-2026 spiral after the mark changed —
 * docs/BRAND.md §6). Pure node built-ins; deterministic, runs in prebuild.
 *
 *   public/favicon.ico            16 + 32 + 48 px, rounded tile
 *   public/apple-touch-icon.png   180 px, opaque (iOS adds its own mask)
 *   public/icon-192.png           PWA "any"
 *   public/icon-512.png           PWA "any"
 *   public/icon-maskable-512.png  PWA "maskable" — mark inside the 80% safe zone
 *
 * Run: npx tsx scripts/generate-icons.ts
 *
 * Changed the mark or the tokens? Bump ICON_VERSION in src/lib/brandMark.ts
 * and the matching ?v=N in public/manifest.webmanifest, so browsers and
 * installed apps refetch instead of showing their cached copy.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { MARK_COLORS } from "../src/lib/brandMark";
import { encodeIco, encodePng, hexToRgb, markStrokes, renderTile } from "./lib/raster";

const PUBLIC = path.join(process.cwd(), "public");
const { paper, ink, accent } = MARK_COLORS.light;
const PAPER = hexToRgb(paper);

/**
 * `markScale` maps the mark's 0..100 viewBox onto that fraction of the
 * icon. The mark spans ~66% of its viewBox, so 0.9 leaves it ~60% of the
 * tile (comfortable inside iOS/Android rounded masks) and 0.8 keeps every
 * stroke inside the maskable safe circle (radius 40%) with room to spare.
 * Favicons are tiny, so the mark is drawn larger there to stay legible.
 */
function icon(size: number, markScale: number, cornerRadius = 0): Uint8Array {
  return renderTile(
    size,
    PAPER,
    cornerRadius,
    markStrokes(size, size * markScale, { ink, accent }),
  );
}

const written: string[] = [];
function write(name: string, data: Buffer) {
  fs.writeFileSync(path.join(PUBLIC, name), data);
  written.push(`${name} (${data.length} B)`);
}

write(
  "favicon.ico",
  encodeIco(
    [16, 32, 48].map((size) => ({
      size,
      png: encodePng(size, icon(size, 1.3, size * 0.2)),
    })),
  ),
);
write("apple-touch-icon.png", encodePng(180, icon(180, 0.9)));
write("icon-192.png", encodePng(192, icon(192, 0.9)));
write("icon-512.png", encodePng(512, icon(512, 0.9)));
write("icon-maskable-512.png", encodePng(512, icon(512, 0.8)));

console.log(`Wrote ${written.join(", ")}`);
