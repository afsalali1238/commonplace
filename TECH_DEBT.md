# Technical Debt

This document tracks actionable technical debt that was intentionally deferred. It provides context on the trigger conditions and the rationale for why the work was postponed, so future maintainers (or agents) know exactly when and how to resolve it.

## 1. Accessibility Audit

**Current State:** Automated accessibility testing with `axe-core` is integrated into
the CI test suite:

- `src/components/Quiz.a11y.test.tsx`: validates unanswered and answered (revealed) quiz states.
- `src/components/components.a11y.test.tsx`: validates `LayerReveal` (collapsed and revealed), `RecallReveal` (hidden and revealed), `FirstTimeHint`, `InstallAppButton`, `AudioBar`, and `SearchBar`.
- Semantic ARIA attributes wired across interactive controls: `role="progressbar"` with value bounds on `AudioBar`, `aria-label="Main Navigation"` on `BottomNav`, `aria-haspopup="listbox"` on `SearchBar`, `aria-expanded` and `aria-controls` on disclosure panels (`LayerReveal`, `RecallReveal`), and `aria-pressed` on toggle buttons (`node.$id.tsx`, `you.tsx`).
- Color contrast verified in `src/styles.css` for both light and dark modes (ink/paper 14.9:1, ink-soft/paper 6.2:1, accent/paper 5.5:1, line/paper 3.3:1 — all exceeding WCAG 2.1 AA 4.5:1 text and 3:1 non-text criteria).

**Deferred Work:** A full manual screen-reader walkthrough (VoiceOver/NVDA) on real mobile/desktop devices before final public launch.

**Trigger Condition / "Done" Definition:**
Complete the manual screen-reader walkthrough prior to the public product launch. Automated axe-core gates run on every commit.

## 2. Split Data Bundle (`nodes.ts`) — RESOLVED (2026-09-15)

The per-cluster index/body split described in `docs/NODES-SPLIT-DECISION.md` is fully
implemented: `src/data/nodes.ts` carries only index fields (451 nodes, 128 KB gz), and
layer1/layer2/quiz/furtherReading live in `public/content/bodies/<cluster>.json`, fetched
lazily on first node open and precached by the service worker (`docs/CONTENT-LAYER.md`).
The CI bundle-size cap (260 KB largest chunk) enforces it. No action remaining.

## 3. Missing / Untrustworthy Archive Snapshots (223 of 622 unavailable)

**Current State (measured 2026-09-16):** of 622 `furtherReading` entries, 398 are
`full`, 1 is `excerpt`, and **223 are `"unavailable"`**. The original tranche was
the 161 snapshots lost in the repo re-import (rename + squash): rather than ship
broken links, `scripts/demote-missing-archives.ts` (committed 2026-09-15) marked
those entries `"unavailable"` in `content/`. Since then the count grew — 5
block-page captures were demoted on 2026-09-16 (below), 3 new primary-source
citations were added directly as `unavailable` (cluster D), and content expansion
between the two expert reviews added the rest. This repo is a single squashed
commit, so the exact per-tranche breakdown is **not reconstructable**; re-measure
with the validator/audit rather than re-deriving it from prose. The app still
shows each source's live URL; only the offline snapshot is absent.

**Block-page captures demoted 2026-09-16** (a captcha or access-check page is not
an offline copy; these link out and sit in the recovery queue): `AB5-0` (JSTOR
access check), `M3-0` (ScienceDirect block), `K3-0` (JSTOR captcha), `AD2-1`
(PNAS nav only), `AG1-1` (archive.org UI counters).

**Wrong-page captures (need network to re-capture, must not be re-attributed):**
`J2-0` (node is Marks's _Second-Order Thinking_; capture is Oaktree's memos
index), `L1-0` (node is Pascal's _Expected Value_; capture is Annie Duke's
_Quit_), `M2-0` (node is Chesterton's _Chesterton's Fence_; capture is a Project
Gutenberg browse page for a different work). Also worth a look while
re-capturing: `AG2-1`.

**Trigger Condition / "Done" Definition:**
Re-archive on a machine with general web access (the build sandbox only allows
registry/API hosts):

```bash
npx tsx scripts/archive-sources.ts all --retry-unavailable   # refetches the unavailable set; media/paywalls stay "unavailable"
npx tsx scripts/build-content.ts                             # regenerate index + bodies + manifest
npx tsx scripts/generate-sitemap.ts                          # /read URLs change with the archive set; CI checks this
npx tsx scripts/validate-nodes.ts                            # expect 0 errors, 0 missing files
```

Review `archive-failures.log` afterwards — paywalled/media landing back as
"unavailable" is expected; anything else should be investigated.
