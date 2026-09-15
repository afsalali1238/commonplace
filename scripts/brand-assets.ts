/**
 * Generates the brand's static image assets from the same tokens and
 * generative artwork the app renders at runtime, so a share card and an app
 * icon are provably the same design system as the screens — not a one-off
 * made in a drawing tool that drifts the next time a colour changes.
 *
 *   bun run scripts/brand-assets.ts            # writes SVGs to public/brand/
 *
 * Outputs (SVG; the PNG versions committed alongside were rasterised from
 * these with headless Chromium — see docs/VISUAL-SYSTEM.md for the exact
 * command, and re-run it whenever this file changes):
 *
 *   public/brand/og.svg               1200×630 social share card (og:image)
 *   public/brand/plate-<cluster>.svg  one topic plate per cluster, useful
 *                                     for anything outside the app (decks,
 *                                     posts) that needs a topic image
 */
import fs from "node:fs";
import path from "node:path";
import { CLUSTERS } from "../src/data/nodes";
import { arcPath, plateSpec } from "../src/lib/artwork";

const PAPER = "#faf8f3";
const INK = "#1a1a17";
const INK_SOFT = "#6b6b63";
const ACCENT = "#b45309";

const outDir = path.join(process.cwd(), "public", "brand");
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
fs.mkdirSync(outDir, { recursive: true });

function plateSvgBody(clusterId: string, size: number, opacityScale = 1): string {
  const spec = plateSpec(clusterId);
  const k = size / 100;
  const arcs = spec.arcs
    .map((arc, i) => {
      const d = arcPath(spec.cx * k, spec.cy * k, { ...arc, r: arc.r * k });
      const op = Math.min(0.6, Math.max(0.14, 0.42 - i * 0.025) * opacityScale);
      return `<path d="${d}" stroke="${INK}" stroke-opacity="${op.toFixed(3)}" stroke-width="${(arc.weight * k).toFixed(2)}"/>`;
    })
    .join("\n    ");
  const thread = spec.thread
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x * k} ${y * k}`)
    .join(" ");
  return `<g fill="none" stroke-linecap="round">
    ${arcs}
    <path d="${thread}" stroke="${INK}" stroke-opacity="0.5" stroke-width="${(0.7 * k).toFixed(2)}"/>
  </g>
  <circle cx="${spec.knot.x * k}" cy="${spec.knot.y * k}" r="${(spec.knot.r * k).toFixed(2)}" fill="${ACCENT}"/>`;
}

// --- per-cluster plates ------------------------------------------------------
for (const c of CLUSTERS) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="600" height="600" role="img" aria-label="${esc(c.title)}">
  <rect width="100" height="100" fill="${PAPER}"/>
  ${plateSvgBody(c.id, 100)}
</svg>
`;
  fs.writeFileSync(path.join(outDir, `plate-${c.id}.svg`), svg);
}

// --- OG card -----------------------------------------------------------------
// The logo path, copied verbatim from public/logo.svg so the card and the
// favicon can't diverge.
const LOGO_PATH = fs
  .readFileSync(path.join(process.cwd(), "public", "logo.svg"), "utf8")
  .match(/d="([^"]+)"/)?.[1];
if (!LOGO_PATH) throw new Error("public/logo.svg: no path found");

// The plate on the card is the first cluster's (A, Startup Fundamentals) —
// deterministic, and one of the better-balanced compositions.
const W = 1200;
const H = 630;
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Unknown — a latticework of powerful ideas">
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  <!-- topic plate, in its own panel on the right so the type area stays clean -->
  <defs>
    <clipPath id="panel"><rect x="760" y="40" width="${W - 800}" height="${H - 80}"/></clipPath>
  </defs>
  <g clip-path="url(#panel)">
    <rect x="760" y="40" width="${W - 800}" height="${H - 80}" fill="${INK}" fill-opacity="0.03"/>
    <g transform="translate(700 -20)">
      ${plateSvgBody("F", 640, 1.1)}
    </g>
  </g>
  <line x1="760" y1="40" x2="760" y2="${H - 40}" stroke="${INK}" stroke-opacity="0.18"/>
  <!-- hairline frame -->
  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" fill="none" stroke="${INK}" stroke-opacity="0.18" stroke-width="1"/>
  <!-- logo mark -->
  <g transform="translate(88 84) scale(0.72)">
    <path d="${LOGO_PATH}" fill="none" stroke="#8a8478" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="53.29" cy="49.13" r="4.2" fill="${ACCENT}"/>
  </g>
  <text x="180" y="132" font-family="Fraunces, Georgia, serif" font-size="34" fill="${INK}" letter-spacing="-0.5">Unknown</text>
  <!-- headline -->
  <text font-family="Fraunces, Georgia, serif" font-size="74" fill="${INK}" letter-spacing="-1.5">
    <tspan x="88" y="330">A latticework of</tspan>
    <tspan x="88" y="412">powerful ideas.</tspan>
  </text>
  <!-- micro label -->
  <text x="90" y="500" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="17" fill="${INK_SOFT}" letter-spacing="3.4">LEARN IN LAYERS · RETAIN WITH SPACED REPETITION</text>
  <line x1="88" y1="528" x2="640" y2="528" stroke="${INK}" stroke-opacity="0.25"/>
</svg>
`;
fs.writeFileSync(path.join(outDir, "og.svg"), og);

console.log(`wrote ${CLUSTERS.length} plates + og.svg to public/brand/`);

// --- App icons -----------------------------------------------------------------
// The mark on paper. `any` icons keep generous padding so the spiral never
// touches the edge on rounded-square platforms; the maskable one fills the
// safe zone (inner 80%) per the W3C spec so Android's adaptive masks don't
// clip it. PNGs are rasterised from these SVGs (see docs/VISUAL-SYSTEM.md).
function iconSvg(size: number, pad: number, dark = false): string {
  const bg = dark ? "#1c1a17" : PAPER;
  const stroke = dark ? "#a39a8a" : "#8a8478";
  const accent = dark ? "#d97706" : ACCENT;
  const inner = size * (1 - 2 * pad);
  const k = inner / 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Unknown">
  <rect width="${size}" height="${size}" fill="${bg}"/>
  <g transform="translate(${size * pad} ${size * pad}) scale(${k})">
    <path d="${LOGO_PATH}" fill="none" stroke="${stroke}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="53.29" cy="49.13" r="4.2" fill="${accent}"/>
  </g>
</svg>
`;
}
fs.writeFileSync(path.join(outDir, "icon.svg"), iconSvg(512, 0.12));
fs.writeFileSync(path.join(outDir, "icon-maskable.svg"), iconSvg(512, 0.2));
fs.writeFileSync(path.join(outDir, "icon-dark.svg"), iconSvg(512, 0.12, true));
console.log("wrote icon.svg, icon-maskable.svg, icon-dark.svg");
