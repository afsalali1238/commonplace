# Handoff — after PR #7 (fresh pass, updated 2026-09-16)

Post-merge re-read of the tree on `main` @ `9e8e05d` (the PR #7 merge commit), then the first
network-free content pass on top of it. Every number below was measured this session;
commands/greps are quoted so the next session can trust them without re-deriving.

---

## 0. State at a glance

| Thing                  | Value                                                            | How verified                          |
| ---------------------- | ---------------------------------------------------------------- | ------------------------------------- |
| Base / merge target    | `main` @ `9e8e05d` (PR #7)                                        | `git log`                             |
| Nodes                  | **451** across 38 clusters (`A`–`Z` + `AA`–`AL`)                  | `validate-nodes.ts`                   |
| Validator              | **0 errors**, **109 warnings** (all "quiz answer-length leak")    | `npx tsx scripts/validate-nodes.ts`   |
| Tests                  | **9 files / 65 tests** passing                                    | `npm test`                            |
| Lint                   | **0 errors / 6 warnings** (shadcn react-refresh; CI cap 10)       | `eslint . --max-warnings 10`          |
| Build                  | clean; SW precache = 92 assets + 39 bodies + **399** sources      | `npm run build`                       |
| Largest client chunk   | `nodes-*.js` ≈ **128 KB gz** / 380 KB raw (cap 260 KB)            | build output                          |
| furtherReading entries | **622** = 398 `full` + 1 `excerpt` + **223 `unavailable`**        | script over `content/clusters/*.json` |
| Source files on disk   | **399** = 399 referenced + **0 orphans**, 0 missing               | set-diff disk vs referenced paths     |

**Gate this pass** (`npm run check`, exit 0): `Validated 451 nodes.` / `OK — no errors.` /
`6 problems (0 errors, 6 warnings)` / `9 passed (9)` files, `65 passed (65)` tests /
build clean / `Injected 92 assets, 39 node body files and 399 archived source files`.

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

---

## 2. Open work, prioritised

### P0 — real origin

`SITE_URL` is still the placeholder `https://commonplace.app` (unregistered). Everything
absolute ships pointing at a dead origin: 899 sitemap URLs, `robots.txt`, canonical,
`og:url`, `og:image`.

- `src/lib/site.ts:11` — the constant
- `public/robots.txt:3` — static, not generated
- `scripts/generate-sitemap.ts` — reads env `SITE_URL` first, so Vercel can override the
  sitemap **but not the other two**

Blocked on a product decision (register the domain vs use the `*.vercel.app` origin).

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

### P2 — docs are stale (numbers, not just dead files)

`REBUILD-HANDOFF.md` and `REQUIREMENTS-TODO.md` are obsolete (branch `content-workflow-rebuild`,
`bun install`, 270 nodes). But **live** docs carry stale counts too:

- `docs/FEED-SPEC.md:93,131`, `docs/QA-TEST-WORKFLOW.md:133` (270 nodes / 233 KB gz)
- `docs/NODES-SPLIT-DECISION.md:9-12,38` (the split it proposes is shipped)
- `TECH_DEBT.md` §3 still says "161 sources" (now 223), §2 is marked resolved
- `docs/BRAND.md` is cited by `BrandMark.tsx:1`, `site.ts:2` and both expert reviews — it does
  not exist

### P3 — carried over

CSP nonce (`script-src 'unsafe-inline'` required for streamed SSR today); `visitNode` inflates
the streak without a quiz; route files overdue for a split (`index.tsx` 695, `you.tsx` 643,
`node.$id.tsx` 612); ~50 unused shadcn/Radix primitives; manual screen-reader walkthrough
(`TECH_DEBT.md` §1); FEED-SPEC §3/4 disagrees with the shipped feed (inline deeper layers,
double-tap save) — update the spec to match the product.

---

## 3. Notes for maintainers

- `npm run build` always dirties `public/sitemap.xml`: `prebuild` re-stamps all 899 `lastmod`
  dates with the build date. CI checks TOPICS-INDEX freshness but **not** sitemap freshness.
  Revert that churn (`git checkout -- public/sitemap.xml`) unless the diff is intended.
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

Then: **P0** (origin) or **P1** (re-archive + the three wrong-page captures, needs web access).
The remaining network-free content task is the quiz leak backlog (§2 P2).
