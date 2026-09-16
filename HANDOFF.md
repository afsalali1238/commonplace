# Handoff — after PR #8 + the origin & docs pass (updated 2026-09-16)

Post-merge re-read of the tree on `main` @ `ea330ec` (the PR #8 merge commit), then two passes
on top of it: the P0 origin plumbing (one env var now drives every absolute URL) and the docs
refresh (missing `docs/BRAND.md` written, obsolete files deleted, stale counts corrected).
Every number below was measured this session; commands/greps are quoted so the next session
can trust them without re-deriving.

---

## 0. State at a glance

| Thing                  | Value                                                            | How verified                          |
| ---------------------- | ---------------------------------------------------------------- | ------------------------------------- |
| Base / merge target    | `main` @ `ea330ec` (PR #8)                                        | `git log`                             |
| Nodes                  | **451** across 38 clusters (`A`–`Z` + `AA`–`AL`)                  | `validate-nodes.ts`                   |
| Validator              | **0 errors**, **109 warnings** (all "quiz answer-length leak")    | `npx tsx scripts/validate-nodes.ts`   |
| Tests                  | **9 files / 69 tests** passing                                    | `npm test`                            |
| Lint                   | **0 errors / 6 warnings** (shadcn react-refresh; CI cap 10)       | `eslint . --max-warnings 10`          |
| Build                  | clean; SW precache = 92 assets + 39 bodies + **399** sources      | `npm run build`                       |
| Largest client chunk   | `nodes-*.js` ≈ **128 KB gz** / 412 KB raw (cap 260 KB)            | build output                          |
| Sitemap URLs           | **894** (was 899 committed — see §1e)                             | `grep -c "<url>" public/sitemap.xml`  |
| furtherReading entries | **622** = 398 `full` + 1 `excerpt` + **223 `unavailable`**        | script over `content/clusters/*.json` |
| Source files on disk   | **399** = 399 referenced + **0 orphans**, 0 missing               | set-diff disk vs referenced paths     |

**Gate this pass** (`npm run check`, exit 0): `Validated 451 nodes.` / `OK — no errors.` /
`6 problems (0 errors, 6 warnings)` / `9 passed (9)` files, `69 passed (69)` tests /
build clean / `Injected 92 assets, 39 node body files and 399 archived source files`.
The working tree is now **unchanged by a build** (§1e) — verified byte-identical across
two consecutive `npm run prebuild` runs.

---

## 1. Done — don't redo these

### 1a. Launch hygiene from PR #7 (all ten verified present in tree)

| Fix                                  | Evidence                                                      |
| ------------------------------------ | ------------------------------------------------------------- |
| Fontsource-only fonts (no Google)    | `src/styles.css:9-12`; zero `fonts.googleapis` hits in `src/` |
| Dark-mode favicon linked             | `src/routes/__root.tsx:124` → `/logo-dark.svg`                |
| Canonical + `og:url` every route     | `src/routes/__root.tsx:99,111` (from leaf pathname)           |
| `useHydrated` waits for persist      | `src/lib/hydrated.ts:13-20`                                   |
| `/read` URL allowlist                | `src/lib/url.ts` (`safeHttpUrl`, `safeArchiveId`) + tests     |
| Download does a real `cache.put`     | `src/routes/node.$id.tsx:200-201`                             |
| Bottom nav out of view transitions   | `data-vt="nav"` on `BottomNav`                                |
| CI installs with `npm ci`            | `.github/workflows/ci.yml` (bun installer gone)               |
| Per-cluster body split               | index-only `nodes.ts` + 39 body files                         |
| Feed session resets on import/reset  | covered by `store.test.ts`                                    |

### 1b. Cluster D accuracy (fixed this pass, primary sources verified)

All three defects are resolved in `content/clusters/D.json`; the generated bundle and bodies
were rebuilt. Which side was wrong differed per node, and each was checked against the
original publication:

- **D3 — *Reinvesting When Terrified*.** Title/author/year were **right**: Jeremy Grantham,
  GMO Viewpoints, **March 10 2009**. The body and quiz were Howard Marks's 2008
  distressed-debt buying. Rewritten to Grantham's actual argument (crisis paralysis;
  a reinvestment "battle plan" built in advance; "a few large steps, not many small ones").
- **D5 — *The Race to the Bottom*.** `year: 2007` was **right**: Oaktree memo, **Feb 14 2007**.
  Layer 0's "In 2012" was the error — now "In February 2007 — months before the credit crisis
  broke". Layer 1/2 (covenant-lite, asymmetric risk) were already accurate to the memo.
- **D9 — *The Fraying of the US Global Currency Reserve System*.** Title/author/year were
  **right**: Lyn Alden, published **Dec 2 2020**. The body and quiz described Luke Gromen.
  Rewritten to Alden's actual thesis (petrodollar plumbing, the Triffin dilemma, China
  redeploying dollar surpluses into hard assets); quiz replaced.

Each of the three now also cites its own primary source in `furtherReading` (GMO letter,
Oaktree PDF, lynalden.com essay), all `unavailable` pending the re-archive.

### 1c. Archive attribution (fixed this pass, 44 snapshots)

The re-fetch on 2026-07-17/18 wrote the node's `type` word into the archive frontmatter, so
`/read` rendered bylines like "Originally published by article, article". Two classes, both
fixed — **every remaining byline is now "by {author}, {publication}"**:

- **22 files** had `author` *and* `source` both meaningless (the worst ones). Attribution was
  recovered from evidence inside each snapshot (author lines, title pages, bylines, e.g.
  Sarah Ferguson for the Hebb biography, Judith S. Kleinfeld for the Kleinfeld paper,
  Tomasz Downarowicz for the Scholarpedia entropy article, Andrew Chen for the a16z excerpt).
- **22 further files** had a correct author but a type-word `source`; source set from the
  hosting publication (Wikipedia, Project Gutenberg, Stanford Encyclopedia of Philosophy,
  Internet Archive, PubMed Central, MIT course reading, GW Regulatory Studies Center).

Both layers were synced: the `.md` frontmatter + byline and the node-side
`furtherReading[].source` (rebuilt via `build:content`).

### 1d. Dead weight removed

- **2 orphans deleted** (`AA1-entropy-0.md`, `AA2-relativity-0.md`): their curated metadata had
  already been merged into the referenced `AA1-0.md` / `AA2-0.md`, which is why they existed.
- **5 fake "offline copies" demoted to `unavailable` and deleted** — captures whose bodies
  contain no article text at all, just block/nav chrome: `AB5-0` (JSTOR access check, 998 B),
  `M3-0` (ScienceDirect block, 519 B), `K3-0` (JSTOR captcha), `AD2-1` (PNAS nav only, 1.4 KB),
  `AG1-1` (archive.org UI counters, 1.4 KB). Serving a captcha as an offline copy is a lie;
  these now link out and sit in the `--retry-unavailable` recovery queue.

### 1e. Origin plumbing + docs (this pass)

**P0 origin, done.** The origin lived in three places that could disagree
(`src/lib/site.ts`, `public/robots.txt`, and the env read inside
`generate-sitemap.ts`). There is now one resolution, `resolveSiteUrl()` in
`src/lib/site.ts`, baked into the client **and** SSR bundles by a Vite `define`
in `vite.config.ts`. Precedence: define → `SITE_URL` →
`VERCEL_PROJECT_PRODUCTION_URL` → `VERCEL_URL` → placeholder. Vercel production
is preferred over `VERCEL_URL` because the latter is the per-deployment
(preview) host — canonicals must never name a preview. Launching on a real
domain is now: set one Vercel variable, redeploy, commit the two regenerated
files. Full rules in `docs/BRAND.md` §2.

- **`robots.txt` is generated** (`scripts/generate-robots.ts`, in `prebuild`)
  instead of hand-maintained with an absolute `Sitemap:` line nothing checked.
  Byte-identical at the current placeholder origin.
- **`<lastmod>` dropped from the sitemap.** It stamped the build date on every
  URL, so every build dirtied the tree (the churn §3 used to tell maintainers
  to revert) and produced the "unreliable lastmod" signal crawlers discount.
  Output is deterministic now.
- **CI freshness gate** for `sitemap.xml` + `robots.txt`, mirroring the
  TOPICS-INDEX check. Not hypothetical: the committed sitemap was already
  stale — **899 URLs where the build produces 894** (the five §1d demotions
  never came out of it). Regenerated here.
- **4 unit tests** pin the precedence (`src/lib/url.test.ts`).
- **Verified, not assumed:** `SITE_URL=https://verify-origin.test npm run build`
  puts that origin in `dist/client`, `dist/server`, `sitemap.xml` and
  `robots.txt`; the placeholder survives only as the unreachable terminal
  fallback in the bundles.

**Docs, done.** `docs/BRAND.md` written (cited by `BrandMark.tsx:1`, `site.ts:2`
and both reviews, and missing) — name, mark geometry, tokens, shipped-asset
inventory, origin rules, and a measured drift list in its §6.
`REBUILD-HANDOFF.md` and `REQUIREMENTS-TODO.md` deleted (270-node /
`content-workflow-rebuild` era; only historical prose referenced them). Stale
counts refreshed in `docs/FEED-SPEC.md` (§5, §10),
`docs/QA-TEST-WORKFLOW.md` (§3.4) and `TECH_DEBT.md` §3 (161 → 223 unavailable,
plus the five demoted block pages and the three wrong-page captures);
`docs/NODES-SPLIT-DECISION.md` carries a historical-record banner so it stops
reading as a live proposal.

---

## 2. Open work, prioritised

### P0 — real origin (CODE DONE; the domain itself is still a product call)

The code half shipped this pass (§1e): every absolute URL — canonical, `og:url`,
`og:image`, `sitemap.xml`, `robots.txt` — resolves through `resolveSiteUrl()`,
and CI fails if the committed generated files drift from what a build produces.
What remains is the product decision the code was blocked on: register
`commonplace.app`, or adopt the Vercel production origin. Either is now one
Vercel variable + a redeploy + committing the two regenerated files, with no
code change. Rules and launch checklist: `docs/BRAND.md` §2.

### P1 — re-archive (needs a machine with web access; still blocked here)

Verified again this pass: `curl` to wikipedia/scholarpedia/forbes/youtube all return `000`.

Now **223** entries are `unavailable` (of 622). Top recoverable hosts: `en.wikipedia.org` 67,
`fs.blog` 34, `plato.stanford.edu` 3. Stays unavailable by nature: YouTube/TED 37, paywalls
(WSJ, Nature, CNBC) ~5. Plus the 5 demoted block-page captures and 3 newly-cited primary
sources (GMO, Oaktree PDF, lynalden.com) — all in the same recovery queue.

```bash
npx tsx scripts/archive-sources.ts all --retry-unavailable
npx tsx scripts/build-content.ts
npx tsx scripts/validate-nodes.ts      # expect 0 errors, 0 referenced-but-missing
```

Idempotent and resume-safe (`MAX_RETRIES = 3`, skips anything already `full`/`excerpt` whose
file exists, logs misses to gitignored `archive-failures.log`).

### P1 — wrong-page captures (found this pass, need network to re-capture)

These three archives are marked `full` and have real text, but they are **not the cited work**.
They cannot be fixed offline — re-capture them, don't re-attribute them:

- `J2-0` — node J2 is "Second-Order Thinking" (Howard Marks memo); the capture is Oaktree's
  *memos index* page (a list of dated memo titles).
- `L1-0` — node L1 is "Expected Value" (Blaise Pascal, 1654); the capture is Annie Duke's
  *Quit* book page. Unrelated to the node.
- `M2-0` — node M2 is "Chesterton's Fence" (G.K. Chesterton, *The Thing*, 1929); the capture is
  a Project Gutenberg browse page describing *The Man Who Knew Too Much*.

Also worth a look while re-capturing: `AG2-1` (node is Gibson's "Affordances"; capture is an
NN/g design article) and `AD2-1`/`AG1-1`, already demoted above.

### P2 — quiz answer-length leak (109 nodes)

109 of 451 quizzes have a correct option >1.3× the longest distractor, shuffled positions, so
it reads as "pick the longest". Worst ratio 1.6×. By cluster: `AL 7`, `J 6`, `D 6`, `U 5`,
`O 5`, `I 5`, `AJ 5`, `AI 5`, `AF 5`, long tail after that. Fix the distractors in
`content/clusters/*.json`, then flip `validate-nodes.ts --strict` so it can't regress.

### P2 — tests: the weakest engineering aspect

`store` (16), `feed` (9), `bodies` (7), `artwork` (8), `mainRoutes` (6), `url` (5), `quiz` (5),
plus 2 axe files. **No route render test, no E2E.** Playwright is not in `devDependencies`.

1. SSR smoke per route, including 404 and the wrapped-500 path.
2. Playwright: onboarding → feed swipe → node → quiz → review, plus reload persistence.

### P2 — docs were stale (numbers, not just dead files) — DONE this pass

All of the following landed in §1e: the two obsolete root docs deleted, the
270-node / 233 KB-gz counts corrected in `FEED-SPEC` / `QA-TEST-WORKFLOW`,
`TECH_DEBT` §3 brought to 223, `NODES-SPLIT-DECISION` bannered as historical,
and the missing `docs/BRAND.md` written.

**One new finding from the refresh, deliberately not fixed here** (it changes
shipped pixels, so it wants its own reviewable pass): the installed-icon family
(`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`)
still shows the pre-rename **spiral** mark while the favicon pair and `og.png`
show the current **Marginalia** asterisk — and `scripts/brand-assets.ts` now
throws (`public/logo.svg: no path found`, line 68) because the mark changed from
one spiral `<path>` to four `<line>`s, so those PNGs cannot currently be
regenerated. Evidence and fix path in `docs/BRAND.md` §6.

### P3 — carried over

CSP nonce (`script-src 'unsafe-inline'` required for streamed SSR today); `visitNode` inflates
the streak without a quiz; route files overdue for a split (`index.tsx` 695, `you.tsx` 643,
`node.$id.tsx` 612); ~50 unused shadcn/Radix primitives; manual screen-reader walkthrough
(`TECH_DEBT.md` §1); FEED-SPEC §3/4 disagrees with the shipped feed (inline deeper layers,
double-tap save) — update the spec to match the product.

---

## 3. Notes for maintainers

- `npm run build` **no longer dirties** `public/sitemap.xml`: `<lastmod>` is gone (§1e), the
  generators are deterministic, and CI checks sitemap + robots freshness the same way it
  checks TOPICS-INDEX. If a build now dirties either file, that is a real content change
  (nodes or archives moved) — commit it, don't revert it.
- `furtherReading[].source` is a **publication** name; the node's `type` word
  (article/paper/book) is a separate field. Don't write a type word into `source` — that is
  exactly the defect fixed in §1c.
- The two orphans were deleted only after their metadata was merged — if you re-add archive
  files, check `archive-sources.ts` idempotency first (it skips anything whose file exists).

---

## 4. Don'ts

- **Don't redesign.** The IA (Feed · Explore · Review · You) is settled.
- **Don't rename the persist key `unknown:v1`** (`src/lib/store.ts:245`) — it wipes every install.
- **Don't hand-edit** `src/data/nodes.ts` or `public/content/bodies/*` — generated. Edit
  `content/clusters/*.json` and run `build-content.ts`.
- Archive paths are deliberately split: disk = `public/content/sources/`,
  stored path = `content/sources/<id>-<i>.md`. The archiver asserts this.
- Don't commit `archive-failures.log` (gitignored, local diagnostic).

---

## 5. First commands for the next session

```bash
git checkout main && git pull
npm ci                     # package-lock.json is canonical; bun.lock is gitignored
npm run check              # expect the §0 numbers
```

Then: **P1** (re-archive + the three wrong-page captures, needs web access) or the brand-icon
regeneration pass (`docs/BRAND.md` §6 — the installed icons are still the old spiral). The
remaining network-free content task is the quiz leak backlog (§2 P2).
