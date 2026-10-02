/**
 * Generates the brand's static image assets from the same tokens and
 * generative artwork the app renders at runtime, so a share card and an app
 * icon are provably the same design system as the screens — not a one-off
 * made in a drawing tool that drifts the next time a colour changes.
 *
 *   bun run scripts/brand-assets.ts            # writes SVGs to public/brand/
 *
 * Outputs are reference SVGs for use outside the app (decks, posts); the
 * app itself never loads them. The shipped rasters come from other scripts
 * that read the same mark geometry (src/lib/brandMark.ts): og.png from
 * generate-og-image.ts, favicon.ico + app icons from generate-icons.ts.
 *
 *   public/brand/og.svg               1200×630 social share card
 *   public/brand/icon*.svg            the app icon on paper (light/dark/maskable)
 *   public/brand/plate-<cluster>.svg  one topic plate per cluster, useful
 *                                     for anything outside the app (decks,
 *                                     posts) that needs a topic image
 */
import fs from "node:fs";
import path from "node:path";
import { CLUSTERS } from "../src/data/nodes";
import { arcPath, plateSpec } from "../src/lib/artwork";
import { MARK_ARMS, MARK_COLORS, MARK_STROKE_WIDTH } from "../src/lib/brandMark";
import { APP_NAME } from "../src/lib/site";

const PAPER = MARK_COLORS.light.paper;
const INK = MARK_COLORS.light.ink;
const INK_SOFT = "#6b6b63";
const ACCENT = MARK_COLORS.light.accent;

/** The Marginalia mark as SVG elements on its 0..100 viewBox. */
function markSvg(colors: { ink: string; accent: string }): string {
  return MARK_ARMS.map(
    (a) =>
      `<line x1="${a.x1}" y1="${a.y1}" x2="${a.x2}" y2="${a.y2}" stroke="${a.accent ? colors.accent : colors.ink}" stroke-width="${MARK_STROKE_WIDTH}" stroke-linecap="round"/>`,
  ).join("\n    ");
}

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
// The plate on the card is the first cluster's (A, Startup Fundamentals) —
// deterministic, and one of the better-balanced compositions.
const W = 1200;
const H = 630;
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(APP_NAME)} — a latticework of powerful ideas">
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
    ${markSvg({ ink: INK, accent: ACCENT })}
  </g>
  <text x="180" y="132" font-family="Fraunces, Georgia, serif" font-size="34" fill="${INK}" letter-spacing="-0.5">${esc(APP_NAME)}</text>
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
// The mark on paper, at the same proportions generate-icons.ts rasterises:
// the 0..100 viewBox mapped onto 90% of the tile for `any` icons, 80% for
// the maskable one so every stroke stays inside Android's safe circle.
function iconSvg(size: number, markScale: number, dark = false): string {
  const c = dark ? MARK_COLORS.dark : MARK_COLORS.light;
  const k = (size * markScale) / 100;
  const o = (size * (1 - markScale)) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(APP_NAME)}">
  <rect width="${size}" height="${size}" fill="${c.paper}"/>
  <g transform="translate(${o} ${o}) scale(${k})">
    ${markSvg(c)}
  </g>
</svg>
`;
}
fs.writeFileSync(path.join(outDir, "icon.svg"), iconSvg(512, 0.9));
fs.writeFileSync(path.join(outDir, "icon-maskable.svg"), iconSvg(512, 0.8));
fs.writeFileSync(path.join(outDir, "icon-dark.svg"), iconSvg(512, 0.9, true));
console.log("wrote icon.svg, icon-maskable.svg, icon-dark.svg");
