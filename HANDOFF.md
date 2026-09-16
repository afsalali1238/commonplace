# Handoff — after PR #7 (fresh pass, 2026-09-16)

Post-merge re-read of the tree on `main` @ `9e8e05d` (the PR #7 merge commit). Every number
and every "done" claim below was re-checked against this checkout this pass — grep/command
results are quoted inline so the next session can trust them without re-deriving.

Previous session's handoff is superseded by this file. No code was changed to produce it.

---

## 0. State at a glance

| Thing                       | Value                                                              | How verified                              |
| --------------------------- | ------------------------------------------------------------------ | ----------------------------------------- |
| Branch / commit             | `main` @ `9e8e05d`, tree clean                                     | `git log`, `git status`                    |
| Nodes                       | **451** across 38 clusters (`A`–`Z` + `AA`–`AL`)                    | `validate-nodes.ts`, cluster file count    |
| Validator                   | **0 errors**, **109 warnings** (all "quiz answer-length leak")      | `npx tsx scripts/validate-nodes.ts`        |
| Tests                       | **9 files / 65 tests**, all passing                                | `vitest run`                               |
| Lint                        | **0 errors / 6 warnings** (shadcn react-refresh; CI cap is 10)      | `eslint . --max-warnings 10`               |
| Build                       | clean; SW precache = 92 assets + 39 bodies + 406 sources            | `npm run build`                            |
| Largest client chunk        | `nodes-*.js` ≈ **128 KB gz** / 380 KB raw (cap 260 KB)              | build output, CI bundle step               |
| furtherReading entries      | **619** = 403 `full` + 1 `excerpt` + **215 `unavailable`**          | script over `content/clusters/*.json`      |
| Source files on disk        | **406** = 404 referenced + **2 orphans**                            | set-diff disk vs referenced paths          |
| Body files                  | 39                                                                 | `public/content/bodies/`                   |

**Gate output this pass** (`npm ci` → `npm run check`, exit 0):

```
Validated 451 nodes.
OK — no errors.
✖ 6 problems (0 errors, 6 warnings)
Test Files  9 passed (9)
     Tests  65 passed (65)
✓ built in 2.12s
Injected 92 assets, 39 node body files and 406 archived source files into sw.js precache manifest (version commonplace-8155dc8614)
```

---

## 1. Done — don't redo these

All ten launch-hygiene fixes from PR #7 are on `main` and verified present:

| Fix                               | Evidence in tree                                              |
| --------------------------------- | ------------------------------------------------------------- |
| Fontsource-only fonts (no Google) | `src/styles.css:9-12`; zero `fonts.googleapis` hits in `src/`  |
| Dark-mode favicon linked          | `src/routes/__root.tsx:124` → `/logo-dark.svg`                 |
| Canonical + `og:url` every route  | `src/routes/__root.tsx:99,111` (from leaf pathname)            |
| `useHydrated` waits for persist   | `src/lib/hydrated.ts:13-20` (`hasHydrated` / `onFinishHydration`) |
| `/read` URL allowlist             | `src/lib/url.ts` (`safeHttpUrl`, `safeArchiveId`) + `url.test.ts` |
| Download does a real `cache.put`  | `src/routes/node.$id.tsx:200-201` (`caches.open` → `put`)      |
| Bottom nav pinned out of view transitions | `data-vt="nav"` on `BottomNav`                        |
| CI installs with `npm ci`         | `.github/workflows/ci.yml` (bun installer gone)                |
| Per-cluster body split            | `src/data/nodes.ts` index-only + `public/content/bodies/*.json` (39) |
| Feed session resets on import/reset | `store.test.ts` covers it                                   |

Architecture, the Leitner loop, the lattice, and the visual system are **not** the problem.
Do not redesign.

---

## 2. Open work, prioritised

### P0 — real origin

`SITE_URL` is still the placeholder `https://commonplace.app` — a host that is not
registered. Everything absolute ships pointing at a dead origin: 899 sitemap URLs,
`robots.txt`, canonical, `og:url`, `og:image`.

Touch points (all three hardcode it):

- `src/lib/site.ts:11` — `export const SITE_URL = "https://commonplace.app"` (the fallback)
- `public/robots.txt:3` — `Sitemap: https://commonplace.app/sitemap.xml` (static, not generated)
- `scripts/generate-sitemap.ts` — already reads `process.env.SITE_URL` first, so setting the
  env var on Vercel fixes the sitemap, but **not** `site.ts` or `robots.txt`.

Blocked on a product decision (register the domain, or pick the `*.vercel.app` origin), not on code.

### P1 — re-archive the missing sources (still blocked: no web access)

Verified this pass that **these sandboxes cannot do it**: `curl` to scholarpedia, forbes,
youtube and **en.wikipedia.org** all fail (`000`). Same constraint the last session hit.

Corrected numbers — the "161 missing" figure is stale:

- Today: **215** furtherReading entries carry `"status": "unavailable"` (of 619 total).
- The 161 was the count at demotion time; `demote-missing-archives.ts` has since been run over more.
- Host breakdown of the 215 — this is what recovery can actually win:

| Host                    | Count | Realistic outcome                          |
| ----------------------- | ----- | ------------------------------------------ |
| `en.wikipedia.org`      | 67    | **Recoverable** (and API-friendly)         |
| `fs.blog`               | 34    | **Recoverable**                            |
| `youtube.com`           | 31    | Stays unavailable (media) — expected       |
| `ted.com` / `ed.ted.com`| 6     | Stays unavailable (media)                  |
| `plato.stanford.edu`    | 3     | **Recoverable**                            |
| `wsj.com`, `nature.com`, `cnbc.com` | 5 | Stays unavailable (paywall) — expected  |

So the ceiling is roughly **180 of 215**, not "161 minus paywalls". Everything else is
paywall/media long tail.

Run (on a machine with web access):

```bash
npx tsx scripts/archive-sources.ts all --retry-unavailable
npx tsx scripts/build-content.ts       # or: npm run build:content
npx tsx scripts/validate-nodes.ts      # expect 0 errors, 0 referenced-but-missing
```

The archiver is idempotent and resume-safe (`MAX_RETRIES = 3`, skips anything already
`full`/`excerpt` whose file exists, logs every miss to `archive-failures.log`, which is
gitignored). Running it cluster-by-cluster is safe if a full pass is too slow.

### P2 — cluster D content accuracy (3 defects, confirmed verbatim)

Read straight from `content/clusters/D.json` this pass:

- **D3** — title/author say Jeremy Grantham, *Reinvesting When Terrified*; `layer0` opens
  "In late 2008, Howard Marks wrote a memo…". Title body and author body disagree.
- **D5** — *The Race to the Bottom* (Howard Marks) has `year: 2007`; `layer0` says "In 2012,
  Howard Marks warned…".
- **D9** — title/author say Lyn Alden, *The Fraying of the US Global Currency Reserve
  System*; `layer0` says "Macro strategist Luke Gromen argues…".

Fix in `content/clusters/D.json`, then `npx tsx scripts/build-content.ts`. Hand edits to
`src/data/nodes.ts` or `public/content/bodies/*` will be reverted by the next build.

### P2 — quiz answer-length leak (109 nodes)

109 of 451 quizzes have a correct option >1.3× the longest distractor — positions are
shuffled, so this is "pick the longest", not "pick B". Worst ratio seen: **1.6×**.

Distribution by cluster (top): `AL 7`, `J 6`, `D 6`, `U 5`, `O 5`, `I 5`, `AJ 5`, `AI 5`,
`AF 5`, then a long tail. The fix is tightening distractors in `content/clusters/*.json`
(lengthen distractors or shorten the key), not changing the validator. Flip
`validate-nodes.ts --strict` once the backlog is cleared so it can't regress.

### P2 — tests: the weakest engineering aspect

Coverage is real but shallow end-to-end: `store` (16), `feed` (9), `bodies` (7), `artwork` (8),
`mainRoutes` (6), `url` (5), `quiz` (5), plus 2 axe files. **There is no route render test
and no E2E.** `mainRoutes.test.ts` tests a helper, not a route.

Two concrete gaps worth closing first:

1. SSR smoke per route (including 404 and the wrapped 500 path in the server entry).
2. Playwright pass: onboarding → feed swipe → node → quiz → review, plus reload-persistence.

Playwright is **not** in `devDependencies` — this is new setup, not just new tests.

### P2 — docs are stale (numbers, not just dead files)

`REBUILD-HANDOFF.md` and `REQUIREMENTS-TODO.md` are outright obsolete: they describe branch
`content-workflow-rebuild`, `bun install`, `bun run`, and 270 nodes. Delete or move to
`docs/archive/`.

But **live** docs carry the stale 270 too, which is worse — those need a numbers refresh, not
archiving:

- `docs/FEED-SPEC.md:93,131` ("270 nodes")
- `docs/NODES-SPLIT-DECISION.md:9-12,38` (the whole 270/296 analysis predates the split; the
  split is now *done*, so this doc reads as a proposal for shipped work)
- `docs/QA-TEST-WORKFLOW.md:133` (270 nodes / 233 KB gz — actual index is ~128 KB gz)
- `TECH_DEBT.md` §3 title still says "161 sources" (actual: 215)
- `docs/STATUS-2026-09-04.md` is dated and may be left as history

Also: **`docs/BRAND.md` does not exist** but is cited by `src/components/BrandMark.tsx:1`,
`src/lib/site.ts:2`, and both recent expert reviews.

### P3 — carried over, unchanged

- CSP nonce (today `script-src 'unsafe-inline'` is required for streamed SSR).
- `visitNode` marks the streak without a quiz — product call, inflates the retention signal.
- Route files overdue for a split: `index.tsx` (695), `you.tsx` (643), `node.$id.tsx` (612).
- ~50 unused shadcn/Radix primitives inflating the dependency graph (tree-shaken).
- Manual VoiceOver/NVDA walkthrough before public launch (`TECH_DEBT.md` §1).
- FEED-SPEC §3/4 vs shipped feed (inline deeper layers, double-tap save) — spec and product
  disagree; update the spec to match the shipped choice.

---

## 3. New findings from this pass (not in the previous handoff)

**1. Two orphan archive files, and they are not junk.**
`public/content/sources/AA1-entropy-0.md` and `AA2-relativity-0.md` are unreferenced (nodes
AA1/AA2 point at `AA1-0.md` / `AA2-0.md`, both present) yet still get precached — 406 files
precached vs 404 referenced.

They are the **better-metadata** versions, not duplicates:

| File                  | Words | `author:`                                         |
| --------------------- | ----- | ------------------------------------------------- |
| `AA1-entropy-0.md`    | 391   | `Rudolf Clausius (article by Tomasz Downarowicz)` |
| `AA1-0.md` (in use)   | 5,074 | `article`                                         |
| `AA2-relativity-0.md` | 354   | `Albert Einstein`                                 |
| `AA2-0.md` (in use)   | 9,005 | `paper`                                           |

The 07-18 re-fetch won full text but lost the curated attribution. Delete the orphans only
**after** copying their frontmatter worth into the referenced files.

**2. The same attribution degradation is wider than those two: 22 files** ship a byline that
renders as `Originally published by article, article` (22 have a generic `author:`, 44 a
generic `source:`) — visible in `/read`:

`AA1-0 AA2-0 AD1-1 AD2-1 AE1-1 AE2-1 AF1-1 AF2-1 AG1-1 AG2-1 AK2-1 J2-0 J4-0 K1-0 K2-0 K3-0 K4-0 L1-0 M1-0 M2-0 M3-0 N1-0`
(cluster `K` is worst: 4/4).

**3. `npm run build` leaves the tree dirty.** The `prebuild` regenerates `public/sitemap.xml`
with `lastmod` = build date, rewriting all 899 URLs. So a correct gate run always produces a
899-line diff in a committed file, and CI does **not** check sitemap freshness (only
TOPICS-INDEX). Either gitignore the sitemap and generate it at deploy, or stop stamping every
URL with the build date. Until then, don't commit that churn as if it were a change.

---

## 4. Don'ts

- **Don't redesign.** The IA (Feed · Explore · Review · You) is settled.
- **Don't rename the persist key `unknown:v1`** (`src/lib/store.ts:245`) — it wipes every install.
- **Don't hand-edit** `src/data/nodes.ts` or `public/content/bodies/*` — generated; edit
  `content/clusters/*.json` and run `build-content.ts`.
- Don't "fix" the archive path: disk write dir is `public/content/sources/`, stored path is
  `content/sources/<id>-<i>.md` (URL form). The archiver asserts this.
- Don't commit `archive-failures.log` (gitignored, local diagnostic).

---

## 5. First commands for the next session

```bash
git checkout main && git pull
npm ci                     # package-lock.json is canonical; bun.lock is gitignored
npm run check              # validate + lint + test + build — expect the §0 numbers
```

Then pick up at **P0** (origin) or **P1** (re-archive, needs web access). Cluster D (§2) and
the quiz leak are the two content tasks that need no network and no design decisions.
