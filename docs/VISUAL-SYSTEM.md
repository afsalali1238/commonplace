# Visual system — imagery, motion, brand assets

_Added 2026-09-04. Records the decisions behind the app's image and motion
layer so the next change is a deliberate edit of both code and this note._

## 1. The decision: generated, not illustrated

The app is text-first (`FEED-SPEC.md` §7: "No images, so cards are
text-cheap") and must work fully offline. Rather than commission or
AI-generate a set of raster illustrations — which would need precaching,
wouldn't adapt to dark mode, and would drift from the type system the
first time a token changed — **every image in the app is derived at render
time from an id**, as inline SVG drawn in the `paper / ink / accent`
tokens.

Three consequences worth stating plainly:

- **Zero image bytes.** Nothing new in the service-worker precache; the
  whole system added ~5 KB gz to the client bundle.
- **Dark mode is free.** The artwork uses `currentColor` and
  `var(--color-accent)`, so the palette inversion re-themes it with no
  component changes (verified in headless Chromium, both schemes).
- **Every idea has an image, forever.** 387 nodes today, any number
  tomorrow, with no authoring step. Adding a node in `nodes.ts` is enough.

The alternative (AI-illustrated topic covers, ~31 PNGs) was considered and
rejected for this pass; if it is ever wanted, it should be layered _on top
of_ the generative system on Explore topic cards only, not replace it.

## 2. The grammar

Everything is built from the three primitives in the logo: **the spiral**,
**the thread**, and **one accent dot**. That family resemblance is the
point — the artwork should read as one voice, not decoration.

| Artefact                   | Source                    | What it is                                                                                                                                                       | Where it appears                                                           |
| -------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Topic plate**            | `plateSpec(clusterId)`    | A field of concentric arcs (the spiral, unwound) with a thread crossing it and one knot in accent. Four compositions × tight/open ring fields, chosen by the id. | Explore topic cards (cover), cluster page head (large, drawing itself on). |
| **Idea glyph**             | `glyphSpec(nodeId)`       | 4–6 dots joined by one continuous thread plus a closing chord — a small piece of lattice. One dot in accent; `progress` lights more of them (Leitner box ÷ 5).   | Feed card, node page header (large), Skim card, topic list rows, Review.   |
| **OG card**                | `scripts/brand-assets.ts` | 1200×630 share image: headline in Fraunces, plate F in a right-hand panel. Static; per-idea dynamic cards via `@vercel/og` are a possible follow-up.             | `og:image` / `twitter:image` on every page (`__root.tsx`).                 |
| **App icons**              | `scripts/brand-assets.ts` | The mark on paper. `any` icons at 12% padding; maskable at 20% (W3C safe zone). Verified under iOS squircle and Android circular masks.                          | `public/icon-*.png`, `apple-touch-icon.png`, `manifest.webmanifest`.       |
| **Per-cluster plate SVGs** | `scripts/brand-assets.ts` | The 38 plates as standalone files, for use outside the app (posts, decks).                                                                                       | `public/brand/plate-<id>.svg` — not referenced by the app, not precached.  |

Rules the generator enforces (and `artwork.test.ts` pins):

- Deterministic: same id → byte-identical SVG on server and client (no
  hydration mismatch). Seeded by `hashString` → `mulberry32`, coordinates
  rounded to 2 dp.
- **Type wins over ornament.** A plate's thread and knot never enter the
  lower 35% of the plate, where a card's title sits; a paper gradient also
  fades the plate out under the title as a second guard.
- Glyph points stay ≥2 units inside the 24×24 viewBox (room for the dot
  radius); every plate is distinct across the 38 clusters.

## 3. Motion

One grammar, declared once in `styles.css` under "Motion grammar", using
the existing `--duration-*` / `--ease-*` tokens. Components opt in with a
utility class and **never declare their own keyframes**.

| Utility                    | Meaning                                               | Used by                                                                                       |
| -------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `rise`                     | A block entering: fade + 6 px up, 420 ms.             | Node header/thesis/idea (staggered by `[animation-delay:…]`), Review card, headers.           |
| `settle` + `--i`           | List item seating itself; 45 ms stagger, capped at 8. | Explore cards, topic rows, You sections, onboarding chips/steps, Lattice rows.                |
| `pulse-beat`               | One beat on a toggled control.                        | Save / Got it / Queue rail buttons, Skim save, correct quiz option, Review badge on increase. |
| `pop`                      | Badge appearing (overshoot in).                       | Review due badge.                                                                             |
| `plate-draw`, `glyph-draw` | SVG strokes drawing on (`pathLength=1` + dashoffset). | Cluster head plate; glyph on node page, first feed/skim card, Review.                         |
| `ring-draw`                | Progress arc transitions as its value changes.        | Explore card progress ring.                                                                   |
| `shimmer`                  | Hydration placeholder.                                | `Skeleton.tsx` (Feed, Review, You, Lattice, read).                                            |

**Route transitions** use the View Transitions API via the router's
`defaultViewTransition` (`router.tsx`). `lib/mainRoutes.ts#routeDepth`
classifies paths (tab = 0, secondary = 1, idea = 2) and each navigation is
typed `deeper` / `shallower` / `lateral`; CSS slides the new page up, down,
or cross-fades accordingly. The bottom nav has its own
`view-transition-name` and is excluded, so it stays put while content
changes. Browsers without the API simply navigate.

**Reduced motion** is a single kill switch: the existing
`prefers-reduced-motion` block in `@layer base` collapses every animation
and transition to 0.01 ms, and a second block disables view-transition
pseudo-elements. Verified: with `reducedMotion: "reduce"` every Explore card
is at opacity 1 immediately after load and `document.getAnimations()`
reports zero running animations.

**Skeletons replace blank frames.** Feed, Review and parts of You/Lattice
render nothing useful until the persisted store hydrates; they used to
return an empty `div` (a white flash between the SSR shell and content).
`Skeleton.tsx` draws the shape of what's coming with `aria-busy`.

## 4. Regenerating the static assets

```sh
bun run scripts/brand-assets.ts        # SVGs → public/brand/
```

PNGs are rasterised from those SVGs with headless Chromium so the web fonts
render (the OG card sets Fraunces + JetBrains Mono). The commands used are
Playwright scripts equivalent to:

```js
// og.png: load public/brand/og.svg in a 1200×630 page with the Google
// Fonts stylesheet, await document.fonts.ready, screenshot.
// icons: load icon.svg / icon-maskable.svg at 512, 192, 180 px; screenshot.
```

Re-run both whenever `logo.svg`, the tokens, or `lib/artwork.ts` change.
`og.png` is 54 KB; the four icon PNGs total 17 KB.

## 5. Not done / follow-ups

- Per-idea OG cards (title + author + glyph) at the edge with `@vercel/og`.
- A `TopicPlate` variant for the Feed's "Beyond your topics" cards, to make
  the cross-pollination visible.
- `docs/APP-REVIEW.md` still describes the pre-visual-system app.
