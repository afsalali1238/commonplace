# Brand — name, mark, tokens, assets, origin

_Written 2026-09-16. This file was cited by `src/components/BrandMark.tsx:1`,
`src/lib/site.ts:2` and both expert reviews before it existed; everything below
is transcribed from shipped code and committed assets, not from memory, so the
citations resolve to something real. Where a fact and an artifact disagree, the
disagreement is recorded in §6 rather than papered over._

## 1. Name (D1, decided 2026-09-12)

- **Display name:** `Commonplace` — `src/lib/site.ts` `APP_NAME`, mirrored in
  `public/manifest.webmanifest` (`name` / `short_name`), the root `<title>` and
  `og:title` (`src/routes/__root.tsx`), and the `og.png` wordmark.
- **Tagline:** `A latticework of powerful ideas` — `APP_TAGLINE`, manifest
  `description`, `og:description`.
- **Micro-label:** `LEARN IN LAYERS · RETAIN WITH SPACED REPETITION` — set in
  JetBrains Mono, letterspaced, on `og.png` and `public/brand/og.svg`.
- **Rename history:** the app shipped as "Unknown". The rename landed in the
  live surfaces only. `scripts/brand-assets.ts` still hardcodes `Unknown` in the
  OG card `<text>` and in the `aria-label`s it emits, while the committed
  `public/brand/*.svg` say `Commonplace` — i.e. those SVGs were produced by a
  version of the script that is not in the repo. See §6.

## 2. Origin (D2)

`commonplace.app` is **not a registered domain**. It is a placeholder origin so
that absolute-URL code paths have a consistent, obviously-not-production value;
every URL built from it currently 404s.

The origin used to be hardcoded in three places that could silently disagree
(`src/lib/site.ts`, `public/robots.txt`, and the env read inside
`scripts/generate-sitemap.ts`). As of 2026-09-16 there is one resolution,
`resolveSiteUrl()` in `src/lib/site.ts`, and one Vercel variable repoints
everything:

| #   | Source                          | Notes                                                                     |
| --- | ------------------------------- | ------------------------------------------------------------------------- |
| 1   | Vite build-time `define`        | `vite.config.ts` bakes `__SITE_URL__` into the client **and** SSR bundles |
| 2   | `SITE_URL`                      | explicit override, works on any host                                      |
| 3   | `VERCEL_PROJECT_PRODUCTION_URL` | Vercel production domain; **preferred over #4** — see below               |
| 4   | `VERCEL_URL`                    | per-deployment host; set on preview builds too                            |
| 5   | `https://commonplace.app`       | `PLACEHOLDER_ORIGIN` terminal fallback                                    |

Production beats per-deployment because `VERCEL_URL` names the preview host:
preferring it would make every preview deploy publish ~894 near-duplicate
canonical/`og:url`/sitemap URLs and leave crawlers to guess which is canonical.

**What consumes it:** `canonical` + `og:url` + `og:image` (`__root.tsx`),
`public/sitemap.xml` (`scripts/generate-sitemap.ts`), `public/robots.txt`
(`scripts/generate-robots.ts`). Both generated files run in `prebuild`, and CI
regenerates them and fails on drift, so a committed copy can never disagree
with what a build produces.

**Launch checklist:** register/decide the domain → set `SITE_URL` on the Vercel
project (or rely on #3) → redeploy → commit the regenerated
`sitemap.xml` / `robots.txt` (the CI gate reminds you if you forget). No code
change is required.

## 3. The mark — "Marginalia"

A sidenote asterisk: three arms in ink, **one arm in accent**, drawn as
round-capped strokes on a `0 0 100 100` viewBox at stroke-width `14.8`.
Geometry (`public/logo.svg`, identical in `BrandMark.tsx`):

| Arm      | From         | To           | Stroke |
| -------- | ------------ | ------------ | ------ |
| vertical | `50, 24.6`   | `50, 75.4`   | ink    |
| diagonal | `27.9, 37.3` | `72.1, 62.7` | ink    |
| diagonal | `27.9, 62.7` | `72.1, 37.3` | ink    |
| accent   | `50, 50`     | `72.1, 37.3` | accent |

Two deliberate renderings of the same geometry:

- **Dynamic, in-app:** `<BrandMark />` (`src/components/BrandMark.tsx`) renders
  it inline with `currentColor` + the `accent` token, so it re-themes with
  light/dark for free.
- **Static, outside the theme:** `public/logo.svg` (ink `#1a1a17`, accent
  `#b45309`) and `public/logo-dark.svg` (ink `#f2ede4`, accent `#d97706`) bake
  the tokens, because favicons and app icons sit on browser chrome that is not
  the app's palette. The light mark is near-black on transparent and vanishes
  on dark chrome, which is why the dark twin exists and is linked from
  `__root.tsx` with `media="(prefers-color-scheme: dark)"`.

The generative artwork (topic plates, idea glyphs) is a separate system built
from the spiral-and-thread grammar; it is documented in
`docs/VISUAL-SYSTEM.md`, which owns imagery and motion. This file owns the
mark, the name, the tokens, the shipped assets and the origin.

## 4. Tokens

Defined once in `src/styles.css` `@theme`; every component reads these, never
raw Tailwind colors, so re-theming is a property edit.

| Token      | Light     | Dark      | Role                                       |
| ---------- | --------- | --------- | ------------------------------------------ |
| `paper`    | `#faf8f3` | `#1c1a17` | background                                 |
| `ink`      | `#1a1a17` | `#f2ede4` | primary text / strokes                     |
| `ink-soft` | `#6b6b63` | `#a39a8a` | secondary text                             |
| `line`     | `#94886f` | `#716b5c` | borders; darkened to clear WCAG 1.4.11 3:1 |
| `accent`   | `#b45309` | `#d97706` | the one accent arm, links, focus ring      |
| `focus`    | `#b45309` | `#d97706` | focus ring (same hue by design)            |

Contrast (both themes, from `styles.css`): ink/paper 14.9:1, ink-soft/paper
6.2:1, accent/paper 5.5:1 — all above the 4.5:1 text minimum; line/paper 3.3:1,
above the 3:1 non-text minimum. Dark mode is the same warm editorial palette
inverted, deliberately not a stock blue-black tech theme.

- **Type:** Fraunces Variable (serif — headings), Inter (sans — body),
  JetBrains Mono (mono — micro-labels, meta). All self-hosted via Fontsource in
  `styles.css`; `vercel.json` CSP is `font-src 'self'`, so a Google Fonts
  `<link>` would be blocked in production. Do not re-add one.
- **Radii:** 4 / 6 / 8 / 12 px (`sm/md/lg/xl`).
- **Motion:** `--duration-fast|base|slow` = 120 / 220 / 420 ms;
  `--ease-out` for entrances, `--ease-spring` for anything with weight.
  Components opt into the named utilities and never declare their own
  keyframes (grammar in `VISUAL-SYSTEM.md` §3). `prefers-reduced-motion` is a
  single global kill switch.
- **Shadows:** `--shadow-card` / `--shadow-raised`, named for role not size,
  kept separate from the shadcn `shadow-sm/md/lg` scale used by `components/ui`.

## 5. Shipped asset inventory

| Asset                          | What it is                                         | Produced by                                                       | Referenced by                |
| ------------------------------ | -------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------- |
| `public/logo.svg`              | light Marginalia mark, baked ink                   | hand-authored                                                     | `__root.tsx` favicon (light) |
| `public/logo-dark.svg`         | dark twin of the above                             | hand-authored                                                     | `__root.tsx` favicon (dark)  |
| `public/favicon.ico`           | legacy raster favicon, `sizes="16x16 32x32 48x48"` | rasterised                                                        | `__root.tsx`                 |
| `public/apple-touch-icon.png`  | iOS home-screen icon                               | rasterised from `brand/icon.svg`                                  | `__root.tsx`                 |
| `public/icon-192.png`          | PWA icon, `any`                                    | rasterised from `brand/icon.svg`                                  | manifest                     |
| `public/icon-512.png`          | PWA icon, `any`                                    | rasterised from `brand/icon.svg`                                  | manifest                     |
| `public/icon-maskable-512.png` | PWA icon, `maskable` (20% safe-zone padding)       | rasterised from `brand/icon-maskable.svg`                         | manifest                     |
| `public/og.png`                | 1200×630 share card, current mark + wordmark       | `scripts/generate-og-image.ts`, deterministic, runs in `prebuild` | `og:image` / `twitter:image` |
| `public/manifest.webmanifest`  | PWA manifest                                       | hand-authored                                                     | `__root.tsx`                 |

Manifest brand fields: `background_color #FAF8F3`, `theme_color #fcfbf9` (the
`#fcfbf9` deliberately matches the `<meta name="theme-color">` in `__root.tsx`
so PWA chrome tinting is identical whichever one a browser reads), `display`
`standalone`, `orientation` `portrait`. `screenshots` is still deferred
(BRAND P9.1).

`public/brand/*.svg` (og.svg, icon.svg, icon-dark.svg, icon-maskable.svg, and
the 38 `plate-<id>.svg`) are produced by `scripts/brand-assets.ts` and are
**not** referenced by the app and not service-worker precached — they are
reference/external-use files (decks, posts). Their current state is §6.

PNGs are rasterised from the SVGs with headless Chromium so the webfonts
render; re-run that step whenever `logo.svg`, the tokens, or `lib/artwork.ts`
change (commands in `VISUAL-SYSTEM.md` §4).

## 6. Known drift (measured, not suspected)

1. **The installed icons are the old mark.** `icon-192.png`, `icon-512.png`,
   `icon-maskable-512.png` and `apple-touch-icon.png` all depict the pre-2026
   single-stroke **spiral**, while the favicon pair and `og.png` show the
   current **Marginalia** asterisk. So an installed app's home-screen icon
   disagrees with its own favicon and share card. Verified by opening the
   committed PNGs (2026-09-16).
2. **`scripts/brand-assets.ts` cannot regenerate them.** It reads the mark as
   one spiral `<path d="…">` out of `public/logo.svg` (`LOGO_PATH`), and throws
   `public/logo.svg: no path found` at line 68 now that the mark is four
   `<line>` elements. Reproduce with `npx tsx scripts/brand-assets.ts`. The
   38 plates still regenerate byte-identically (they depend on `lib/artwork`,
   not the logo); the OG card and icons die before they are written.
3. **The committed brand SVGs are orphaned artifacts.** `public/brand/og.svg` /
   `icon*.svg` carry the spiral geometry and a hand-patched `Commonplace`
   label, while the script that would emit them says `Unknown`. Nothing imports
   them, so the drift is invisible to users today — but they are the only
   "source" a future maintainer would rasterise from, which would bake the
   spiral back into a new icon set.
4. **`favicon.ico` lineage is unverified** this pass; if it is spiral-era (the
   rest of the raster family is), it belongs in the same regeneration as #1.

**Fix path (deliberately not done here):** teach `brand-assets.ts` the
four-line geometry (or import the mark constants from a shared module), fix the
`Unknown` strings, re-run it, then re-rasterise the PNGs with headless Chromium
and re-commit the whole icon family in one pass so it cannot half-land. That
changes shipped brand pixels, so it should be its own reviewable change with
visual verification, not a side effect of a docs or origin pass.

## 7. Rules for changing the brand

- Edit a token in `styles.css` **and** the matching `PAPER/INK/INK_SOFT/ACCENT`
  constants in `scripts/brand-assets.ts` / `generate-og-image.ts` together; the
  scripts do not import the CSS.
- Never hardcode an origin. Add it to `resolveSiteUrl` consumers via
  `SITE_URL` / `absoluteUrl`; both generated files and the bundles read the one
  constant (§2).
- Favicon/app-icon families are deliberately static (baked ink) — do not try to
  make them theme-reactive; `BrandMark` is the dynamic twin.
- Re-run the generators and the PNG rasterisation whenever the mark, the
  tokens, or `lib/artwork.ts` change, and re-verify §6 is still accurate
  afterwards.
- New brand surfaces (per-idea OG cards at the edge, manifest `screenshots`)
  are the open follow-ups listed in `VISUAL-SYSTEM.md` §5 and `BRAND P9.1`.
