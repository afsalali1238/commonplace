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

## 3. Missing Archive Snapshots (161 sources demoted to "unavailable")

**Current State:** The repo re-import (rename + squash) lost 161 of the archived source
files under `public/content/sources/`. Rather than ship broken links,
`scripts/demote-missing-archives.ts` (committed 2026-09-15) marked those
`furtherReading[].archive` entries `"unavailable"` in `content/`. The app still shows the
source's live URL; only the offline snapshot is absent.

**Trigger Condition / "Done" Definition:**
Re-archive on a machine with general web access (the build sandbox only allows
registry/API hosts):

```bash
npx tsx scripts/archive-sources.ts all --retry-unavailable   # refetches the 161; media/paywalls stay "unavailable"
npx tsx scripts/build:content                                # regenerate bodies + manifest
npx tsx scripts/validate-nodes.ts                            # expect 0 errors, 0 missing files
```

Review `archive-failures.log` afterwards — paywalled/media landing back as
"unavailable" is expected; anything else should be investigated.
