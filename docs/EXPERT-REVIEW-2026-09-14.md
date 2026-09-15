# Expert Project Review — 2026-09-14

Full-project review of **Commonplace** (`afsalali1238/unknown`, branch
`arena/01a0a022-unknown` @ `5dc2a74`), requested as "review the full project and
rate all aspects; check favicon and all". Every rating below is backed by a
command actually run during this review (evidence in §12); nothing was taken on
trust from earlier docs.

**Overall: 8.3 / 10** — an unusually well-crafted content-PWA. The gaps are in
test breadth, first-load payload, and launch-readiness hardening, not in the
core architecture. Two genuine defects were found and **fixed this turn**
(§10): a date-dependent CI gate that was failing `main`, and a favicon/social
metadata gap.

---

## 1. Scorecard

| # | Aspect | Score | Headline |
|---|--------|-------|----------|
| 1 | Architecture & stack | 9/10 | SSR TanStack Start + Vercel, per-cluster chunks, thoughtful error middleware |
| 2 | Code quality | 9/10 | Deterministic PRNGs, zod-validated import/export, explanatory comments everywhere |
| 3 | Type-safety & lint | 9/10 | `tsc --noEmit` clean, `eslint .` clean, prettier enforced |
| 4 | Testing | 5.5/10 | 17 unit tests over store+feed only; zero component/route/E2E coverage |
| 5 | CI/CD | 8/10* | Seven real gates; *was failing main on a date-stamp bug — fixed this turn |
| 6 | PWA / offline | 9/10 | Content-hashed SW versioning, 557 sources precached, warm-up hook |
| 7 | SEO | 8/10 | 1,054-URL sitemap, per-route meta; og:image added this turn; no canonical/JSON-LD |
| 8 | Brand / favicon / icons | 9/10 | Full chain verified binary-level; dark-mode favicon + OG card added this turn |
| 9 | Accessibility | 8/10 | Skip-link, radiogroup quiz, aria-live, documented contrast in both themes; no automated axe pass |
| 10 | Performance | 6.5/10 | 407.6 KB gz `nodes` chunk eagerly preloaded on `/`; render-blocking Google Fonts |
| 11 | Content & data integrity | 9/10 | 451 nodes, 0 validator errors, 557 archives on disk; known quiz-length tell |
| 12 | Documentation | 9/10 | Tech debt with trigger conditions, brand book, data-flow docs |
| 13 | Security posture | 8/10 | No secrets, URL-scheme allowlist on `/read`, validated imports; no CSP headers |

---

## 2. Architecture & stack — 9/10

React 19 + TanStack Start (SSR) + Tailwind v4 + Zustand, deployed to Vercel via
`api/index.js` adapter. Route-level code-splitting plus a `manualChunks` split
per knowledge cluster (`vite.config.ts`); retired routes kept as commented
redirect stubs (`src/routes/map.tsx`). The server entry wraps SSR in two error
layers, including `normalizeCatastrophicSsrResponse` which detects h3's
swallowed `{"unhandled":true,"message":"HTTPError"}` 500s — a failure mode most
projects never notice. State persists to IndexedDB with a versioned `migrate`
and a `noopStorage` for SSR/vitest (the comment explains the old
`undefined as never` crash). Deductions: `as any` around the start plugin and a
`@ts-ignore` on `tsconfigPaths`; `nitro` pinned to a beta in devDependencies.

## 3. Code quality — 9/10

Consistent voice: comments explain *why* (feed PRNG stability, Leitner box
math, streak day-touching, SW `add` vs `addAll`). Quiz options are shuffled with
a per-node seeded mulberry32 so order is stable across hydration but not
memorizable. `importJSON` validates through zod before touching state. Feed
handles cold-start (no interests) with serendipity spacing instead of
dead-ending. No dead code found in the surveyed surface.

## 4. Testing — 5.5/10

`vitest run`: **2 files, 17 tests, all passing** — `store.test.ts` (13) and
`feed.test.ts` (4). That covers the two pure-logic cores (SRS scheduling, feed
ranking), which is the right place to start, but there is **no component,
route, or E2E test**: Quiz, AudioBar (Web Speech), dnd-kit queue reordering, and
every SSR page render untested. No axe-core accessibility test either (matches
TECH_DEBT §1). For a project this polished, this is the weakest aspect.

## 5. CI/CD — 8/10 (after fix)

`.github/workflows/ci.yml` runs: validate-nodes → lint (`--max-warnings 10`) →
typecheck → tests → build (+SW inject) → TOPICS-INDEX freshness. That is a
real, layered gate. **Defect found:** the freshness step regenerates
`docs/TOPICS-INDEX.md`, whose header embedded "Last generated: <today>", then
`git diff --exit-code` against the committed file — so the gate fails on every
day after the commit date. Verified twice: locally (regeneration produced a
1-line date diff against HEAD) and on GitHub (run **34812646581**, latest on
`main`, status *failure*, sole failed step "Check TOPICS-INDEX freshness" while
all quality gates passed). **Fixed this turn** (§10): date removed from the
generated header; regeneration is now idempotent (identical md5 across runs),
so once committed the gate compares content only.

## 6. PWA / offline — 9/10

`public/sw.js` + `scripts/inject-manifest.ts`: precache list is injected at
build with a **content-addressed version hash** (no manual bumping), install
uses per-file `add` with swallowed catch (addAll would abort on one 404 of
~700), navigations network-first with shell fallback, same-origin assets
stale-while-revalidate, cross-origin fonts cache-first. `useOfflineWarmup`
pre-warms every route document + chunk once the SW controls the page — the
comment trail explaining why `/` must be re-fetched post-install is excellent.
Manifest: standalone, shortcuts, `launch_handler`, maskable icon with measured
**21–24% safe-zone margins** (spec requires ≥10%). `apple-touch-icon.png` is
180×180 and **fully opaque (0% transparent pixels)** — correct for iOS. All
icon/manifest/SW URLs return 200 with correct MIME from the built preview.
Remaining: Google Fonts are runtime-cached only (first offline paint before
any visit lacks webfonts), manifest `screenshots` still deferred (BRAND P9.1).

## 7. SEO — 8/10

`robots.txt` + generated `sitemap.xml` with **1,054 URLs** (static + 451 nodes
+ archive readers). SSR emits per-route `<title>` and description (node pages
use the thesis — verified for A1: "Do Things That Don't Scale — Commonplace").
**Gap found in served HTML:** `twitter:card=summary_large_image` with **no
image at all** (0 `og:image` matches on `/`). **Fixed this turn** with a
deterministically generated 1200×630 `public/og.png` (§10) + og/twitter image
tags. Still open: no `og:url`/canonical per route, no JSON-LD, and the origin
is the `commonplace.app` placeholder — BRAND D2 says the domain is unregistered;
register before launch or shares/robots point at a dead host.

## 8. Brand / favicon / icons — 9/10 (after fixes)

Binary-level audit of every shipped icon:

| Asset | Finding |
|---|---|
| `favicon.ico` | Valid ICO, 3 entries (16/32/48 @32bpp, BMP payloads) |
| `logo.svg` | Marginalia mark, transparent ground, near-black ink — invisible on dark browser chrome |
| `apple-touch-icon.png` | 180×180 RGBA but 0% transparent px — correct |
| `icon-192/512.png` | Exact declared dims, opaque paper ground |
| `icon-maskable-512.png` | 512×512, glyph margins 21–24% — clears the 80% safe zone |

Fixes applied this turn (§10): light/dark SVG favicon pair via
`prefers-color-scheme` media links (dark twin uses the dark-theme ink token
`#f2ede4`); ICO `sizes` corrected from `48x48` to `16x16 32x32 48x48`; OG card
added. Verified in the served SSR head: both media-scoped SVG links, corrected
ICO sizes, and `/og.png` → 200 `image/png`. Residual nits: `.ico` uses BMP
entries (fine, just older-style than PNG-in-ICO); in-app `BrandMark` and the
favicon family are deliberately static (documented in BRAND.md) — consistent.

## 9. Accessibility — 8/10

Skip-to-content link, `aria-label`ed icon controls, `role="radiogroup"` quiz
with `aria-live="polite"` feedback, `aria-current` nav, safe-area inset on the
bottom bar, keyboard-sortable dnd-kit sensors. `styles.css` documents measured
contrast for **both** themes (ink/paper 14.9:1 … line/paper 3.3:1) rather than
inheriting light-mode numbers — rare and commendable. Deduction: no automated
axe pass / screen-reader walkthrough (deferred in TECH_DEBT §1), focus-trap
behaviour unaudited.

## 10. Fixes shipped this turn

1. **CI freshness gate (main was red).** `scripts/topics-index.ts` no longer
   stamps "Last generated: <date>"; `docs/TOPICS-INDEX.md` regenerated.
   Verified idempotent (same md5 on consecutive runs) — the gate now fails only
   on real content drift.
2. **Dark-mode favicon.** New `public/logo-dark.svg` (dark-theme ink + amber
   arm); `__root.tsx` links light/dark SVGs by `prefers-color-scheme`.
3. **ICO sizes attribute.** `sizes="16x16 32x32 48x48"` matching the container.
4. **Social card.** New `scripts/generate-og-image.ts` (pure node:zlib,
   deterministic) renders the mark + stroke-glyph wordmark to
   `public/og.png` (1200×630, verified visually); `og:image`,
   `og:image:width/height`, `og:site_name`, `twitter:image` added to the root
   head and verified in served HTML.

Post-fix verification: `validate-nodes` 451 nodes OK · `eslint .` 0 problems ·
`tsc --noEmit` clean · `vitest` 17/17 · `npm run build` OK (SW injected 30
assets + 557 sources) · built preview serves new head tags and assets with
correct MIME.

## 11. Remaining recommendations (prioritised)

1. **P0 — register `commonplace.app`** (BRAND D2): sitemap, robots, and now
   og:image all point at the placeholder origin.
2. **P1 — per-cluster lazy loading** of the graph (TECH_DEBT §2): the `nodes`
   chunk is **1,243.75 KB raw / 407.61 KB gz** and is `modulepreload`ed on `/`
   — the single biggest first-load cost; trigger condition met since 2026-09-04.
3. **P1 — test breadth**: component tests for Quiz/AudioBar and at least one
   SSR smoke test per route (the 404/500 components too); add axe-core to CI
   to close TECH_DEBT §1.
4. **P2 — security headers** in `vercel.json` (`headers` block): CSP, HSTS,
   X-Content-Type-Options; currently only rewrites are configured.
5. **P2 — canonical/og:url per route** and JSON-LD (`Article`/`Quiz`) on node
   pages.
6. **P2 — self-host the three webfonts** (or `font-display: optional` +
   precache) so first offline paint matches the brand.
7. **P3 — quiz length tell** (TECH_DEBT §3, ~93% correct-is-longest) before any
   competitive feature.
8. **P3 — docs consolidation**: ~15 dated review/audit docs; consider an
   `docs/archive/` pass so current truth is unambiguous.

## 13. Addendum — batch 2 (same day, follow-up commit)

Implemented the safe subset of §11 locally:

- **CI actions**: `actions/checkout@v4 → v7`, `actions/setup-node@v4 → v7`
  (v7 is the current major for both, Node-24-targeted — clears the
  deprecated-Node-20 annotation on run 34852941686).
- **Security headers** in `vercel.json`: HSTS, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options: DENY`. No CSP
  deliberately: SSR streams inline scripts and there is no nonce plumbing —
  a strict CSP would brick the app; deferred with the trigger "add nonce
  support to the SSR pipeline first".
- **Canonical + og:url** on every route (root `head({ matches })` leaf
  pathname; query strings intentionally non-canonical), verified in served
  SSR HTML for `/` and `/node/A1`.
- **JSON-LD** `LearningResource` block on node pages (name/abstract/author/
  medium/tags), verified parsing from the served HTML.
- **`SITE_URL`** centralised in `src/lib/site.ts` (root head + sitemap share
  it; env overrides still win in scripts).
- **Tests**: +6 store tests (readLog dedupe/cap-200, Leitner clamps 0/5/-2,
  reorderReadNext) → 23/23 passing.

Not verifiable in this session (session closed for remote ops after PR #8
merged): the actions bump's effect on CI annotations and Vercel header
delivery — both config-only, will be exercised by the next CI run in a new
session.

## 14. Addendum — batch 3 (same day)

- **Self-hosted webfonts (Fontsource, OFL)**: `styles.css` now imports
  `@fontsource-variable/fraunces/opsz.css` + Inter 400/500/600 + JetBrains
  Mono 400/500; the render-blocking Google Fonts `<link>` and preconnects are
  gone from `__root.tsx`; `--font-serif` renamed to `"Fraunces Variable"`.
  Verified in served HTML/CSS: 0 external font refs, local hashed woff2
  served as `font/woff2`. 32 subset woff2 (556 KB) are SW-precached —
  consistent with the app's offline-first policy; browsers fetch only the
  subsets they render at runtime.
- **axe-core accessibility gate** (`Quiz.a11y.test.tsx`, jsdom +
  fake-indexeddb): unanswered and answered Quiz states assert zero
  serious/critical violations — first automated step on TECH_DEBT §1.
  Suite now 25/25.
- **Lockfile canonicality flip**: `package-lock.json` is now the committed,
  CI-canonical lockfile; `bun.lock` demoted to gitignored local artifact; CI
  runs `npm ci` (with `cache: npm` now possible) and the unused `setup-bun`
  step was dropped. Rationale: bun's TLS verification fails in this sandbox
  (UNKNOWN_CERTIFICATE_VERIFICATION_ERROR on registry tarballs, unfixed by
  `cafile`), so `bun.lock` could not be refreshed for the new deps — and with
  remote ops blocked there is no retry loop for a hand-edited lock. npm ci is
  fully verifiable locally. Residual note: bun's `minimumReleaseAge`
  supply-chain guard still applies to local bun dev but not to npm ci.

Still open (needs a new session for CI verification): per-cluster lazy
loading of the graph (P1), CSP once SSR nonce plumbing exists, domain
registration, docs archive pass.

## 12. Evidence log (commands run this turn)

- `npx tsx scripts/validate-nodes.ts` → "Validated 451 nodes. OK — no errors."
- `npx eslint . --max-warnings 10` → 0 problems (after prettier fix on new script)
- `npx tsc --noEmit` → clean · `npm test` → 2 files / 17 tests passed
- `npm run build` → built; `nodes` chunk 407.61 kB gzip; SW inject 30 assets + 557 sources
- `vite preview` + curl matrix: `/`, all icons, manifest, sw, robots, sitemap,
  `/explore`, `/skim`, `/review`, `/you`, `/onboarding`, `/node/A1`,
  `/read/A1-0` → 200 w/ correct MIME; `/nonexistent` → 404
- PNG/ICO header parsing (python): exact dims, alpha audit (0% transparent),
  maskable bbox margins 21–24%
- `gh api …/runs/34812646581/jobs` → only failed step = "Check TOPICS-INDEX freshness"
- SSR head extraction (`grep -a` on served HTML; note: router SSR stream
  payload contains intentional `\x00` separators — framework serialization,
  not a defect)
