# Expert Improvements — 2026-09-05 (arena/01a06dfc-unknown)

_Follow-up to STATUS-2026-09-04. Expert-level, production-ready hardening across build, PWA, a11y, performance and DX. All gates pass._

## What shipped in this batch (9b8357e on top of 8188038)

### 1. CI that actually gates (`.github/workflows/ci.yml`)

- Triggers on `push` to `main`/`arena/**` and PRs to `main`
- Steps: `setup-bun` + `setup-node` → install (`bun.lock` → `bun install` else `npm --legacy-peer-deps`) → `validate-nodes` → `lint --max-warnings 10` → `tsc --noEmit` → `tests (vitest)` → `build (+ sitemap+topics via prebuild)` → `TOPICS-INDEX freshness check` (fails if generated file drifts)
- Caches npm, timeout 15 min, timeout-bounded — suitable for Vercel's GitHub integration and as branch protection gate

### 2. Pre-push hook portability (`.claude/hooks/pre-push-check.sh`)

- Was hard-coded `bun run lint`/`bun run build` → broke on `npm`-only envs (Vercel's container, fresh clones without `bun`)
- Now detects `bun` vs `npm`, runs appropriate command, tails 60 lines on failure, **also gates `validate-nodes`** before push (catches J10-style warnings before they reach CI)

### 3. Feed performance — windowing (`src/routes/index.tsx`)

- **Before:** `feedResult.items.map` rendered all 387 cards → ~387 DOM nodes, large layout/paint, scroll jank on mobile, `useMemo` deps missing `bookmarks/gotIt`
- **After:**
  - `PAGE_SIZE 8` + `GROW_BY 8` + sentinel `IntersectionObserver` (root `containerRef`, `rootMargin 400px`) — initial DOM 8, grows on scroll; `visibleCount` caps at `items.length`
  - `interestsKey = interests.join(",")` extracted to satisfy exhaustive-deps, `feedResult` deps now complete (`bookmarks`, `gotIt`, `readNext`)
  - Share restored (was defined but never rendered) — 5th `RailButton` (`Share2`)
  - Progress badge in header: `4 / 387` counter (sm+: visible)
  - Documented as `FEED_PAGE_SIZE` at top for easy tuning

### 4. Feed accessibility (same file)

- `role="feed"` + `aria-label` including total + visible count + `aria-busy` while windowing
- Each card `role="article"` + `data-feed-card` + `aria-posinset/setsize` + `aria-labelledby` + `tabIndex -1` + `focus-visible:ring`
- `sr-only` live region `Card X of Y: Title` (`aria-live=polite`) synced via scroll observer (requestAnimationFrame, nearest-to-center tracking) + `sr-only` keyboard hint (`Home/End/PageUp/Down`)
- `toolbar` around rail with `aria-label="Actions for {title}"`, rail buttons now `aria-label="Save {title}"` etc with `shortLabel` for visuals
- Container `tabIndex 0` + `onKeyDown`: `ArrowUp/Down`, `j/k`, `PageUp/Down` (±3), `Home/End`, respects `input/textarea/contentEditable` guard
- Queue button `aria-expanded/controls`, `motion-reduce:snap-none` on cards, `Share` + `Queue` debounced

### 5. Skim windowing & a11y (`src/routes/skim.tsx`)

- Mirrors feed: `PAGE_SIZE 10`/`GROW_BY 10`, sentinel, scroll-centre live region, `role="feed"`, `data-skim-card`, `j/k/Home/End` + `Arrow` nav, filter panel `aria-expanded/controls`

### 6. Search lazy indexing (`src/components/SearchBar.tsx`)

- **Before:** `MiniSearch` built at import time — `addAll(NODES)` blocked main thread, 50KB text parse before first paint, no debounce
- **After:** singleton `sharedIndex` + `getSearchIndex()` defers build via `requestIdleCallback || setTimeout(0)`, builds once, boosted `title 2 / author 1.5`
- Component: `index` state (`sharedIndex`), `indexing` promise, `ensureIndex` on focus, `aria-busy`, placeholder `Indexing ideas…`, debounced query (`80ms`), `role="status"` live region for count, handles not-yet-indexed panel state

### 7. SEO & delivery (`scripts/generate-sitemap.ts`, `public/robots.txt`, `package.json`)

- `generate-sitemap.ts`: dynamic import of `NODES`/`CLUSTERS`, emits `public/sitemap.xml` with all static routes (`/`, `/explore`, `/skim`, `/review`, `/you`, `/onboarding`, `/explore?cluster=X`) + every `NODE_BY_ID` (`/node/{id}`) + every archived source (`/read/{slug}`) → 835 URLs, `lastmod` today, `SITE_URL` from `SITE_URL`/`VERCEL_URL` env
- `public/robots.txt`: `Allow: /` + `Sitemap: https://unknown.love/sitemap.xml`
- `package.json`: `prebuild: npx tsx scripts/generate-sitemap.ts && npx tsx scripts/topics-index.ts` → ensures `sitemap.xml` + `TOPICS-INDEX.*` are always fresh before `vite build` (Vercel and local `npm run build` both trigger `prebuild` automatically); `validate`/`audit` scripts added for ergonomics
- `inject-manifest.ts` already content-hashes `PRECACHE_URLS` — now precaches the `nodes-*` chunk correctly (26 assets + 406 sources)

### 8. DX & hygiene

- `eslint.config.js` now ignores `public/content/sources` + `public/sw.js`
- `.prettierignore` now ignores `public/sitemap.xml` + `public/robots.txt` + generated topics
- `src/routes/index.tsx` lint: extracted `interestsKey`, removed stale `eslint-disable` → 6 warnings only (shadcn `only-export-components`)
- `docs/STATUS-2026-09-04.md` prettier fixes
- Build verified: `387 nodes OK`, `lint 0 err`, `tsc 0`, `tests 15/15`, `build` → `index 319KB/101KB gz` + `nodes 1,054KB/343KB gz` + `skim 6.7KB` + `SearchBar 20KB` + SW `unknown-22cb…`

## Gates (run on push branch — all green)

```
npx tsx scripts/validate-nodes.ts → 387 OK — no errors (0 warnings)
npx eslint .                     → 0 errors, 6 warnings (shadcn only)
npx tsc --noEmit                 → 0
npm test                         → 2 files, 15 passed
npm run build                    → vite build + inject (26 assets + 406 sources)
  client index 319KB/101KB gz, nodes 1,054KB/343KB gz
  server nodes 1,128KB/348KB gz
  sitemap 835 URLs
```

## Still deferred (not in this batch, by design)

- **Full per-cluster JSON split** (`TECH_DEBT §2`, `NODES-SPLIT-DECISION.md`) — current `manualChunks(nodes)` is mitigation phase-1 (cacheable isolated chunk). Phase-2 requires: `public/data/<cluster>.json` + `src/data/nodes.lazy.ts` with dynamic `import()` per cluster, `explore.tsx`/`skim.tsx`/`feed.ts` consumers changed to `async`, SW dynamic precache for cluster JSONs, `validate-nodes` updated to read JSON shards. Trigger is **MET** (387 > 350, 445KB gz) — schedule next.
- **Orphan backfill** — `audit-content.ts orphans` shows 101 nodes with 0 incoming links; `hooks` audit shows ~90 long first-sentences. Feed spec §12 proposes clamp or dedicated `hook` field — not changed here to avoid large content churn without review.
- **A11y formal audit** — axe-core + screen-reader walkthrough + contrast pass (TECH_DEBT §1) — feed/skim gained keyboard + live regions here, but not a full automated audit yet.
- **Archive smoke** — `archive-sources.ts all --dry-run` + `archive-failures.log` review recommended before declaring D done; validate already shows 0 missing files.

## How to use

```bash
git checkout arena/01a06dfc-unknown
git pull
npm install --legacy-peer-deps
npm run validate   # gate
npm test && npm run lint && npx tsc --noEmit
npm run build      # runs prebuild (sitemap+topics) + vite + inject
# Vercel Preview: https://{preview-url}/  → feed j/k, queue drag, search debounced, skim window, view-source: sitemap.xml, robots.txt
```

## Files changed (vs 8188038)

- `+ .github/workflows/ci.yml`
- `~ .claude/hooks/pre-push-check.sh` (portable lint/build + validate)
- `~ eslint.config.js` (ignore sw)
- `~ .prettierignore` (sitemap/robots)
- `~ src/routes/index.tsx` (windowing + a11y + share)
- `~ src/routes/skim.tsx` (windowing + a11y)
- `~ src/components/SearchBar.tsx` (lazy + debounce)
- `+ scripts/generate-sitemap.ts`, `+ public/sitemap.xml`, `+ public/robots.txt`
- `~ package.json` (prebuild)
- `~ docs/TOPICS-INDEX.md` (regen 2026-09-05), `~ docs/STATUS-2026-09-04.md` (prettier)

_All changes on `arena/01a06dfc-unknown` (ahead of `main` by 4). Ready for PR → main → production deploy._
