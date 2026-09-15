# Technical Debt

This document tracks actionable technical debt that was intentionally deferred. It provides context on the trigger conditions and the rationale for why the work was postponed, so future maintainers (or agents) know exactly when and how to resolve it.

## 1. Accessibility Audit

**Current State:** A manual accessibility spot-check was performed (e.g., adding `aria-expanded` and `aria-controls` to the explore.tsx cluster toggles, and ensuring `aria-label`s on icon buttons).

**Deferred Work:** A rigorous, automated accessibility pass (measuring contrast ratios, validating keyboard navigation focus trapping, and performing a full screen-reader walkthrough) has not yet been executed.

**Trigger Condition / "Done" Definition:**
Run a proper accessibility audit before a full public launch. Use automated tools (like axe-core) to guarantee compliance.

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
