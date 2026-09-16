# Unknown — QA Test Workflow

A structured, repeatable testing pass for the app, written the way a learning-app
(Duolingo/Anki-class) QA lead would run it. It's organised so you find funnel-breaking
bugs first and cosmetic ones last. Every case references a real route, component, or
state key so nothing is hand-wavy.

App shape: TanStack Router + Vite + Zustand (persisted to IndexedDB via idb-keyval) PWA.
Spaced repetition is Leitner with boxes `[0,1,3,7,16,35]` days.

---

## 0. Test environment setup

Run on your machine (the sandbox can't render it):

```
bun install          # once, native bindings
bun run dev          # http://localhost:5173
```

Test in this order of environments, because bugs hide in the transitions:

1. **Fresh install** — clear IndexedDB (DevTools ▸ Application ▸ IndexedDB ▸ delete `keyval-store`) and hard reload. This is the true first-run state.
2. **Warm state** — after you've visited nodes, passed quizzes, built a streak.
3. **Offline** — DevTools ▸ Network ▸ Offline, reload. PWA must still work.
4. **Mobile viewport** — DevTools device toolbar, iPhone SE (small) + iPad. `use-mobile` and `BottomNav` behaviour change here.

Seed a warm state fast: pass 6+ quizzes across different clusters, bookmark 3 nodes,
add 2 glossary terms, write in the scratchpad. You'll reuse this for review/streak/export tests.

---

## 1. Recommended test order (the funnel)

1. Onboarding → 2. Map (index) → 3. Node detail → 4. Quiz → 5. Review → 6. You/profile →
2. Explore → 8. Search → 9. Cross-cutting (persistence, offline, PWA, a11y, perf).

Rationale: a broken onboarding or Map blocks everything downstream, so failing fast there
saves you testing pages a user can never reach. Quiz feeds Review feeds streak/progress —
test them as a chain, not in isolation.

---

## 2. Per-page suites

### 2.1 Onboarding (`/onboarding`)

- First run auto-routes here (onboardingComplete=false). Verify it does.
- Interest selection: pick tags → `interests` + `onboardingComplete=true`, routes to Map.
- **Skip** path: `skipOnboarding()` — completes with no interests; app still usable.
- **Redo**: from You ▸ redo, returns here; existing progress (gotIt/review) is NOT wiped.
- Edge: select zero interests then continue — does it block, default, or proceed cleanly?

### 2.2 Map / home (`/`)

- Three destinations present: browse, "continue" (last node), due-today count.
- **Continue** resurfaces `lastNodeId`; on fresh state it should hide or show a sensible empty state, not a dead link.
- Due-today badge equals the count of `review` entries with `due <= now`. Cross-check against Review page.
- `ProgressRing` reflects gotIt/visited proportion — sanity-check the number.

### 2.3 Node detail (`/node/$id`)

- **LayerReveal**: layer0 shown, layer1/layer2 revealed progressively. layer2 ends in a question mark (house style).
- Visiting sets `visited[id]=true` and updates `lastNodeId` (check Map ▸ Continue after).
- **Bookmark** toggles `bookmarks[id]`; persists across reload.
- **RelatedCard**: every related id links to a real node (validator guarantees this — but click 3 to confirm routing).
- **furtherReading**: entries render; `archive.status=full` → offline link to `/content/sources/<id>-<i>.md` opens; `unavailable` → no dead link, just citation.
- **AudioBar / TTS**: play reads the content; `ttsRate` from You applies. Pause/resume works. (Feature-detect: some browsers lack speechSynthesis.)
- Edge: a node with empty `related` (validator warns on these) — layout must not break.

### 2.4 Quiz (`Quiz.tsx`, on node detail)

This is the spaced-repetition engine's input — test the math explicitly.

- Answer **correct** first time: `review[id].box` 0→1, `due ≈ now + 1 day`, lastResult="correct".
- Answer **correct** repeatedly: box climbs 1→2→3→4→5 with due gaps 3,7,16,35 days; **caps at 5** (never 6).
- Answer **incorrect** at any box: box resets to **0**, due ≈ now (immediately due again).
- `RecallReveal`: explanation shows after answering; correct answer is unambiguous.
- 3-option vs 4-option quizzes both render correctly (44 nodes have 3 options — spot-check one, e.g. A1).
- Edge: re-answering an already-answered node — does it re-schedule or lock? Confirm intended behaviour.

### 2.5 Review (`/review`)

- Shows only nodes with `review[id].due <= now`, i.e. the Leitner queue.
- Empty/"all caught up" state when nothing is due — must be encouraging, not blank.
- Completing a due review re-runs the quiz path and pushes `due` into the future (item leaves the queue).
- Count here matches Map's due-today badge at all times.
- Edge: item due far in the past (simulate by editing IndexedDB `due` to `0`) still appears.

### 2.6 You / profile (`/you`)

- **Streak**: `streakDays` + `touchStreak`. markGotIt / passing a quiz on a new calendar day extends it; same-day actions don't double-count. Missing a day breaks it (test by setting system clock forward or editing streakDays).
- **Progress**: gotIt count, visited count, per-cluster coverage read correctly.
- **Glossary**: add term → appears; remove → gone; persists across reload.
- **Scratchpad**: type → `scratchpad` persists across reload.
- **Export JSON**: downloads full state; open it and confirm all keys present.
- **Import JSON**: round-trip the exported file → state restored exactly. Then test **bad input**: paste `{}` and truncated/garbage JSON — `importJSON` must return false and NOT corrupt current state (zod schema guards; `seenHints` defaults on old backups).
- **TTS rate** slider changes `ttsRate`; verify it affects AudioBar.
- **Reset**: wipes to `initial`; confirm a confirmation guard exists (destructive).
- **Hints**: `resetHints()` re-enables FirstTimeHint prompts; `dismissHint` persists dismissal.

### 2.7 Explore (`/explore`)

- All clusters (A–Z) listed with titles/subtitles; `LatticeIndex` renders.
- Each cluster expands to its nodes; counts match `audit-content.ts summary`.
- Accordions have `aria-expanded`/`aria-controls` (already spot-fixed per TECH_DEBT) — verify keyboard toggle.

---

## 3. Cross-cutting feature suites

### 3.1 Persistence (IndexedDB)

- Every state mutation survives a hard reload (the store persists async to `keyval-store`).
- Race check: mutate then reload immediately — is the last change flushed? (async idbStorage — watch for lost last write.)

### 3.2 Offline / PWA (`useOfflineWarmup`, service worker)

- After one online load, go offline and reload — app shell + visited nodes + archived sources still load.
- Archived `furtherReading` (`public/content/sources/*.md`) opens offline; `unavailable` ones degrade gracefully.
- Install prompt (`useInstallPrompt` / `InstallAppButton`) appears on a supported browser; installed PWA launches standalone.

### 3.3 Accessibility (TECH_DEBT §1 — still open)

- Keyboard-only: full onboarding → node → quiz → review with no mouse.
- Focus trapping in any dialog/sheet; visible focus rings.
- Colour contrast on `paper`/`ink`/`accent` tokens meets WCAG AA (run axe-core).
- Screen-reader pass on quiz (is correctness announced?) and LayerReveal.

### 3.4 Performance

- First load ships the index only (~128 KB gz, 451 nodes); per-cluster bodies
  arrive lazily on first node open (docs/CONTENT-LAYER.md). Measure LCP. The
  350-node / 400KB-gz split trigger in docs/NODES-SPLIT-DECISION.md was exceeded
  and the split shipped 2026-09-04 — that doc is now a historical record. The
  live guard is the CI bundle-size cap (260 KB gz largest chunk).
- No jank revealing layers or navigating clusters on a mid-range phone.

### 3.5 Error handling (`error-capture.ts` / `error-page.ts`)

- Force a thrown error (bad route `/node/DOESNOTEXIST`) → graceful error page, not white screen.
- Recover from the error page back into the app.

### 3.6 Data integrity (ties into the rebuild)

- Run `node scripts/validate-nodes.ts` (or `bun run`) as part of every QA pass — zero errors is a release gate. Today it flags the 2 orphan tags until they're added to TAGS.

---

## 4. Edge & empty states (the Duolingo-grade details)

Test each explicitly — these are where polish is won or lost:

- Brand-new user, nothing visited (Map continue, Review queue, You progress all empty).
- "All caught up" Review (nothing due).
- Offline first-ever load (no cache yet) — honest message, no infinite spinner.
- Node with `archive.status=unavailable` on every source.
- Import a backup from an older schema (missing `seenHints`) — must default, not fail.
- Very long streak (edit streakDays to 365) — UI doesn't overflow.
- 3-option quiz layout vs 4-option.

---

## 5. Bug logging format

Log each finding as:
`[Page/Feature] Severity(S1 blocker / S2 major / S3 minor / S4 cosmetic) — Steps — Expected — Actual — Env(fresh/warm/offline/mobile)`
Fix order: S1 → S2, then batch S3/S4.

## 6. Fast regression smoke (run before every deploy, ~5 min)

Onboard → open a node → pass a quiz (box goes to 1) → see it leave Review → reload (state persists) → go offline (still loads) → `validate-nodes.ts` clean.
