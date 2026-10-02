/**
 * The Marginalia mark (docs/BRAND.md §3) — the one source of its geometry
 * and baked colours. Everything that draws the mark reads from here:
 *
 * - `<BrandMark />` (in-app, theme-reactive via currentColor + accent token)
 * - `scripts/generate-icons.ts` (favicon.ico + every app-icon PNG)
 * - `scripts/generate-og-image.ts` (og.png share card)
 * - `scripts/brand-assets.ts` (reference SVGs in public/brand/)
 *
 * `public/logo.svg` / `logo-dark.svg` are static files a browser fetches
 * directly, so they can't import this; `brandMark.test.ts` fails if their
 * geometry or colours drift from it. Before this module existed, the mark
 * changed from a spiral to this asterisk in some places only, and every
 * raster icon kept showing the old spiral for months.
 */

export interface MarkArm {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** The one arm drawn in the accent colour; the rest are ink. */
  accent: boolean;
}

/** Arms on a 0 0 100 100 viewBox, drawn as round-capped strokes. */
export const MARK_ARMS: readonly MarkArm[] = [
  { x1: 50, y1: 24.6, x2: 50, y2: 75.4, accent: false },
  { x1: 27.9, y1: 37.3, x2: 72.1, y2: 62.7, accent: false },
  { x1: 27.9, y1: 62.7, x2: 72.1, y2: 37.3, accent: false },
  { x1: 50, y1: 50, x2: 72.1, y2: 37.3, accent: true },
];

export const MARK_STROKE_WIDTH = 14.8;

/**
 * Baked colours for contexts outside the app's theming (favicons, app
 * icons, share cards). Must match the `--color-*` tokens in styles.css.
 */
export const MARK_COLORS = {
  light: { paper: "#faf8f3", ink: "#1a1a17", accent: "#b45309" },
  dark: { paper: "#1c1a17", ink: "#f2ede4", accent: "#d97706" },
} as const;

/**
 * Cache-buster for every icon URL (`?v=N` in __root.tsx and
 * manifest.webmanifest — the test checks they agree). Browsers cache
 * favicons for weeks and installed apps only refresh their icon when the
 * manifest's icon URLs change, so bump this whenever the mark or its
 * colours change. v2 = the spiral → Marginalia switch reaching the rasters.
 */
export const ICON_VERSION = "2";
