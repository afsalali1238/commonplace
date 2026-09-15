# Expert Project Review — 2026-09-15

Full-project review of **Commonplace** (`afsalali1238/commonplace`, branch
`arena/01a0a64c-commonplace`). Requested as “review, rate, and check if there
is anything to improve.” Every score is from reading the current tree and
running the gates this turn — not from earlier review docs, several of which
describe fixes that were never actually wired.

**Overall: 8.4 / 10** after the defects in §10. This is an unusually well-crafted
content PWA: the lattice, Leitner loop, and per-cluster body split are real
product work, not a skin. What was holding it back was launch-readiness
hygiene (fonts vs CSP, persist hydration, favicon, URL allowlist), not the
architecture.

---

## 1. Scorecard

| #   | Aspect                   | Score  | Headline                                                                                          |
| --- | ------------------------ | ------ | ------------------------------------------------------------------------------------------------- |
| 1   | Architecture & stack     | 9/10   | SSR TanStack Start + per-cluster bodies + IndexedDB persist. The 2026-09-14 P1 (bundle split) is done. |
| 2   | Code quality             | 8.5/10 | Explanatory comments, seeded PRNGs, zod import. A few large route files; persist key still `unknown:v1`. |
| 3   | Type-safety & lint       | 9/10   | `tsc --noEmit` clean, eslint 0 errors / 6 shadcn warnings.                                        |
| 4   | Testing                  | 7/10   | 9 files / 65 tests (store, feed, quiz, bodies, artwork, routes helper, axe, URL guards). No route/E2E. |
| 5   | CI/CD                    | 8.5/10 | Validate → lint → tsc → test → build → topics freshness → 260 KB gz cap. Now `npm ci`.            |
| 6   | PWA / offline            | 8.5/10 | Content-hashed SW, body precache, warmup hook. Download now actually `cache.put`s.                |
| 7   | SEO                      | 8/10   | Sitemap, JSON-LD on nodes, canonical + og:url added this turn. Origin is still a placeholder.     |
| 8   | Brand / favicon / icons  | 9/10   | Dark SVG favicon now linked; ICO `sizes` corrected. `docs/BRAND.md` is referenced but missing.    |
| 9   | Accessibility            | 8.5/10 | Skip-link, axe on Quiz + 6 components, feed keyboard. Bottom nav now pinned out of view transitions. |
| 10  | Performance              | 8.5/10 | Index ~128 KB gz (was ~408). Google Fonts removed from the critical path (they were CSP-blocked anyway). |
| 11  | Content & data integrity | 8/10   | 451 nodes, 0 validator errors, 109 quiz-length warnings. Three author/layer0 mismatches. 161 missing archives. |
| 12  | Documentation            | 6.5/10 | Excellent when current; ~10 dated reviews/handoffs still talk about 270 nodes and `unknown`.      |
| 13  | Security posture         | 8.5/10 | CSP + HSTS in `vercel.json`. `/read` now allowlists http(s) and archive ids. No SSR nonce yet.    |

---

## 2. Architecture & stack — 9/10

React 19 + Vite + TanStack Start (Vercel) + Zustand + Tailwind v4. The content
layer is the standout: `content/clusters/*.json` is the source of truth,
`scripts/build-content.ts` emits a bundled **index** (`src/data/nodes.ts`) and
per-cluster **bodies** (`public/content/bodies/*.json`) fetched on first open
(`src/lib/bodies.ts`). CI fails the build if those generated files drift, and
a 260 KB gzip cap on the largest client chunk makes an accidental re-bundle of
bodies a red gate rather than a silent regression.

The server entry still wraps h3’s swallowed `{"unhandled":true,"message":"HTTPError"}`
500s into a real HTML error page — a failure mode most Start apps never notice.

Deductions: `tanstackStart({…} as any)` and a `@ts-ignore` on `tsconfigPaths`
in `vite.config.ts`; `nitro` pinned to a beta; persist storage key is still
`unknown:v1` (must not rename — it would wipe every install).

## 3. Code quality — 8.5/10

The voice is consistent: comments explain *why* (feed PRNG stability, Leitner
math, SW `add` vs `addAll`, body-split sentence counting for audio). Quiz
options are a pure function of `(nodeId, salt)` so order is stable across
hydration but not memorizable. `importJSON` validates through zod.

Deductions: `src/routes/index.tsx` (695), `you.tsx` (643), `node.$id.tsx` (600)
are overdue for a split; ~50 unused shadcn/Radix primitives sit in
`src/components/ui/` (tree-shaken, but they inflate the dependency graph);
`useHydrated()` used to be a one-frame `useEffect` flag that did **not** wait
for IndexedDB — returning users could flash through onboarding. Fixed this turn.

## 4. Testing — 7/10

Before this turn: 8 files. Now **9 files / 65 tests**, all passing:

- `store.test.ts` (16) — streak, Leitner clamps, read-log cap, zod import
- `feed.test.ts` (9) — interests, queue, adjacency, exhaustion, determinism
- `quiz.test.ts` (5) — shuffle balance across the whole corpus
- `bodies.test.ts` (7) — split invariant, fetch-once cache, no-cache-on-error
- `artwork.test.ts` (8), `mainRoutes.test.ts` (6)
- axe-core: Quiz (2) + LayerReveal / RecallReveal / AudioBar / SearchBar / …
- `url.test.ts` (5) — new this turn

Still missing: any route render, the Feed windowing/keyboard path, AudioBar
speech, dnd-kit queue, and a Playwright pass. For a product this far along,
that is the weakest engineering aspect.

## 5. CI/CD — 8.5/10

`.github/workflows/ci.yml` is a real gate: validate-nodes (including generated
freshness) → lint → tsc → vitest → production build + SW inject → TOPICS-INDEX
diff → largest-chunk ≤ 260 KB gz.

**Defect:** the workflow still preferred `bun.lock` then `npm install
--legacy-peer-deps`, but `bun.lock` has been gitignored since 2026-09-14, so
CI never saw it and never ran a reproducible install. **Fixed this turn** to
`npm ci` and dropped `setup-bun`.

## 6. PWA / offline — 8.5/10

`public/sw.js` + `scripts/inject-manifest.ts`: content-addressed version,
per-file `add` so one 404 doesn’t abort install, navigations network-first
with shell fallback, same-origin stale-while-revalidate. `useOfflineWarmup`
pre-warms every tab document, the node/read chunks, and all 38 body files
once the worker controls the page.

**Defect:** the node-page “Download” button fetched with `cache: "reload"` and
trusted the SW to put the bytes in Cache Storage. Before the SW controlled
the page, `caches.match` stayed empty and the “Downloaded” badge was a lie.
**Fixed this turn** with an explicit `caches.open("commonplace-downloads").put`.

## 7. SEO — 8/10

Generated sitemap, `robots.txt`, per-route titles, JSON-LD `LearningResource`
on node pages. **Gaps found and fixed:** no `rel=canonical` / `og:url` (root
now derives them from the leaf match; node pages set their own). Google Fonts
`<link>`s were still in `__root.tsx` even though Fontsource is imported in
`styles.css` and CSP `font-src 'self'` would have blocked them in production —
dead third-party requests plus console CSP errors. Removed.

Still open: `SITE_URL` is `https://commonplace.app`, which BRAND D2 says is
unregistered. Sitemap, robots, canonical, and og:image all point at a dead
host until that is real.

## 8. Brand / favicon — 9/10

`logo-dark.svg` existed, with a comment claiming it was linked from
`__root.tsx` with `prefers-color-scheme: dark`. It was not. The light mark is
near-black ink on a transparent ground and disappears on dark browser chrome.
**Wired this turn**, and ICO `sizes` corrected from `48x48` to
`16x16 32x32 48x48`. `docs/BRAND.md` is cited in three places and does not
exist.

## 9. Accessibility — 8.5/10

Skip-link, `role="feed"` + live region on the home screen, radiogroup quiz
with arrow-key focus (Space/Enter to commit — correct, because answering
moves the Leitner box), documented contrast for **both** themes. axe-core is
in CI.

**Defect:** `styles.css` pins `nav[data-vt="nav"]` out of view transitions so
the tab bar doesn’t slide with the page. `BottomNav` did not set that
attribute, so every navigation animated the chrome. **Fixed this turn.**

Deferred, still: a real VoiceOver/NVDA walkthrough (TECH_DEBT §1).

## 10. Fixes shipped this turn

1. **Google Fonts removed** from `__root.tsx`. Fontsource in `styles.css` is
   the only font path; it matches CSP.
2. **Dark-mode favicon** actually linked; ICO sizes corrected.
3. **Canonical + `og:url`** on every route (root via leaf pathname, node pages
   explicitly).
4. **`useHydrated` waits for persist** (`hasHydrated` / `onFinishHydration`)
   instead of a one-frame effect — stops the onboarding/hint flash.
5. **Persist `noopStorage`** on the server instead of `undefined as never`.
6. **`/read/$id` URL allowlist** — http(s) only for `href`, archive ids
   restricted to `[A-Za-z0-9_-]`. Tests in `src/lib/url.test.ts`.
7. **Download button `cache.put`**.
8. **Bottom nav `data-vt="nav"`**.
9. **CI `npm ci`**, bun installer dropped.
10. **`importJSON` / `reset` also reset the feed session.**

Verification this turn:

```
npx tsc --noEmit                         # clean
npx eslint . --max-warnings 10           # 0 errors, 6 shadcn warnings
npm test                                 # 9 files / 65 tests passed
npx tsx scripts/validate-nodes.ts        # 451 nodes, 0 errors, 109 length-leak warnings
```

## 11. Remaining recommendations (prioritised)

1. **P0 — register the real origin** and point `SITE_URL` / sitemap / robots
   at it. Every absolute URL in the shipped HTML currently 404s for scrapers.
2. **P1 — re-archive 161 missing sources** (`TECH_DEBT §3`):
   `npx tsx scripts/archive-sources.ts all --retry-unavailable`. Paywalled
   / media staying `"unavailable"` is expected.
3. **P1 — test breadth:** one SSR smoke per route (including 404/500) and a
   Playwright pass of onboarding → feed swipe → node → quiz → review.
4. **P2 — content accuracy.** Spot-checked cluster D:
   - **D3** titled/authored Jeremy Grantham, *Reinvesting When Terrified*,
     but `layer0` describes a Howard Marks memo.
   - **D5** *The Race to the Bottom* is dated 2007; `layer0` says 2012.
   - **D9** titled/authored Lyn Alden; `layer0` describes Luke Gromen’s
     dollar-hegemony thesis.
   These should be fixed in `content/clusters/D.json` then `build:content`.
5. **P2 — quiz length leak.** 109 / 451 nodes still have a correct option
   >1.3× the longest distractor. Positions are shuffled, so this is “pick
   the longest,” not “pick B.” Tighten distractors before any competitive
   feature. (`validate-nodes.ts --strict` once the backlog is cleared.)
6. **P2 — Feed vs spec.** FEED-SPEC §3/4 asks for inline layer1/2 (“Go
   deeper”) and a double-tap-to-save. The shipped feed is a hook +
   “Continue reading” link to `/node/$id`. That’s a coherent product choice,
   but it should be reflected in the spec so the two sources of truth agree.
7. **P2 — docs archive.** `REBUILD-HANDOFF.md` and `REQUIREMENTS-TODO.md`
   still describe 270 nodes and branch `content-workflow-rebuild`.
   `docs/BRAND.md` is linked and missing. Move dated reviews into
   `docs/archive/` and keep one current scorecard.
8. **P3 — CSP nonce** once the SSR pipeline can emit one; today’s
   `script-src 'unsafe-inline'` is required for streamed SSR.
9. **P3 — `visitNode` touches the streak.** Opening a node counts as a
   learning day without a quiz. Product call, not a bug — but it inflates
   the retention signal the brief treats as sacred.
10. **P3 — split `index.tsx` / `you.tsx` / `node.$id.tsx`.** They work;
    they are also the files nobody wants to review.

## 12. What’s genuinely solid

The information architecture (Feed · Explore · Review · You, node as hero),
the layered teaching model, Leitner review with a due badge on the tab, the
content pipeline with a real validator, and the visual system (paper/ink/
accent, Fraunces/Inter/JetBrains, generated glyphs) hold together as one
product. The 2026-09-14 review’s biggest performance item — the 407 KB gz
`nodes` chunk — is resolved. This is ready to harden for launch, not to
redesign.
