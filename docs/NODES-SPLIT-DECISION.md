# Decision: nodes.ts split (TECH_DEBT §2)

**Date:** 2026-07-16
**Decision: DEFER the runtime split. Set a concrete, measured trigger. Reduce the risk now
by making the add-content flow the only writer and adding a validation gate.**

## Corrected facts

- Actual node count is **270**, not 296. The "296" figure counts the 26 `CLUSTERS`
  objects alongside the 270 `NODES` objects (both match `^  {` at the same indent).
  `TECH_DEBT.md` (270) was right; update the rebuild plan's 296 references.
- File size ~768KB raw / ~233KB gzipped. At 270 nodes the perf cost of shipping the whole
  graph on first load is still negligible.

## Why defer

The split (per-cluster files + assemble step + Service Worker pre-cache rework) was motivated
by two things: (a) first-load payload, and (b) the pain/risk of many scripts bulk-mutating one
giant file. Payload is still fine at 233KB gzipped. The bulk-mutation risk is the real driver
of the historical git-index corruption — and this rebuild removes that risk directly by
retiring the five-plus one-off writers and routing every change through one flow + a validator
gate. Splitting now would be a large data-layer change delivered at the same time as the tooling
rebuild, increasing blast radius for little payload benefit.

## Concrete trigger (do not re-litigate before one of these is true)

Split when **either**:

- node count reaches **350**, OR
- `src/data/nodes.ts` exceeds **400KB gzipped** in the built bundle.

## Action taken now (instead of splitting)

- `nodes.ts` is written by exactly one flow (add-content) + the archiver; all ad-hoc writers
  retired.
- `validate-nodes.ts` runs before every add and in the build gate, so a bad edit can't land
  silently (the likeliest past cause of index corruption).
- Update `TECH_DEBT.md`: count 270, new trigger numbers above.

## Status update

Both triggers were exceeded: **451 nodes / 38 clusters**, isolated client `nodes-*.js` chunk
~404 KB gzipped (2026-09-05). The deferral expired; the split shipped (below).

## Resolution — 2026-09-04: SPLIT SHIPPED

The split landed the same day, as planned in TECH_DEBT §2. What was decided, and why:

- **Source of truth moved to `content/clusters/<clusterId>.json`** (one file per cluster,
  full node objects), with `content/clusters.json` for order and `content/tags.json` for
  the vocabulary. `src/data/nodes.ts` is now a _generated_ file. This is the part that
  fixes the original risk (many writers bulk-mutating one 1.2 MB TS file): the archiver
  now does `JSON.parse → set archive → JSON.stringify` on a ~30 KB file, and the
  ts-morph dependency and the three one-off AST writers (`fix-nodes.ts`,
  `add-epistemic-status.ts`, `build-nodes-ts.ts`) are gone. Content PRs are now
  reviewable diffs.
- **Index / body cut:** the index keeps `id, clusterId, title, author, year, medium,
category, thesis, layer0, related, tags, epistemicStatus` (everything Feed, Explore,
  Skim, Search, Review's queue, You, and the node page's above-the-fold need). The body
  is `layer1, layer2, quiz, furtherReading`. Measured: index 110 KB gz, bodies 243 KB gz
  total, per-cluster body 1.3–21 KB gz (median 6 KB).
- **`quiz` went to the body**, not the index. Keeping it would have cost +79 KB gz on
  every visit to save one ~6 KB fetch the first time a quiz in a cluster is opened. The
  `Quiz` component now takes a `NodeIndex` and loads its own body, with a skeleton and an
  offline notice, so Feed, Node and Review didn't change shape.
- **Bodies are per cluster, not per node.** ~67% of `related` links stay in-cluster, so
  one fetch covers the next several taps, and 38 files is a precache list the service
  worker can hold (they're in the precache manifest; `inject-manifest.ts` folds the
  bodies' content hashes into the SW version so an edited quiz busts the cache).
- **No server-side body read on `/node/$id`.** The server renders the index part
  (title, thesis, layer0 — the whole above-the-fold) and the client streams the body in.
  That keeps the HTML small and identical between server and client, at the cost of the
  deeper layers appearing ~50 ms after hydration behind their reveal buttons (which are
  collapsed by default anyway). Revisit with `createIsomorphicFn` if per-idea og cards or
  pre-rendering make body-in-HTML worth it.
- **Search now indexes title/author/thesis/layer0 only** (layer1/layer2 aren't bundled).
  Accepted; the deeper layers mostly re-use the same terms. Revisit if search misses show
  up in feedback.
- **CI's bundle-size report became a hard limit** (largest client chunk ≤ 260 KB gz;
  it's 206 KB after the split, was 442 KB).

Result: client JS 447 → 284 KB gz (−36%); largest chunk 442 → 206 KB gz.

Re-measured on the 451-node content set (2026-09-14, after rebase): index chunk
**124 KB gz**, still the largest client chunk, still far under the 260 KB CI limit.
