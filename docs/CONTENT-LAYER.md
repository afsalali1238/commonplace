# Content layer — where the nodes live and how they reach the app

_Last updated 2026-09-04 (the `nodes.ts` split, TECH_DEBT §2)._

## The one-paragraph version

Content is authored in **`content/clusters/<clusterId>.json`** — one file per cluster, full
node objects. `bun run build:content` turns that into two things the app actually uses: a
bundled **index** (`src/data/nodes.ts`, every node minus its heavy fields) and per-cluster
**body** files (`public/content/bodies/<clusterId>.json`, the heavy fields) that the app
fetches the first time a node in that cluster is opened. Both generated files are committed;
CI fails if they're stale or hand-edited.

```
content/                          ← SOURCE OF TRUTH (edit these)
  clusters.json                     ordered list of cluster ids (= display order)
  tags.json                         the interest vocabulary (onboarding picker)
  clusters/A.json … AL.json         { cluster: {id,title,subtitle,icon}, nodes: [FullNode…] }

        │  bun run build:content  (scripts/build-content.ts)
        ▼
src/data/nodes.ts                 ← GENERATED. Bundled INDEX + types + lookup maps
public/content/bodies/<id>.json   ← GENERATED. BODIES per cluster, compact JSON
public/content/bodies/manifest.json  { clusterId: sha256[:12] of that body file }
```

## What's in the index vs the body

| Index (`NodeIndex`, bundled, 110 KB gz)                                                                | Body (`NodeBody`, fetched, ≤ 21 KB gz per cluster)               |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `id, clusterId, title, author, year, medium, category, thesis, layer0, related, tags, epistemicStatus` | `layer1, layer2, quiz, furtherReading`                           |
| Used by Feed, Explore, Skim, Search, Review's queue, You, and the node page's above-the-fold           | Used by the node page's deeper layers, the quiz, further reading |

`Node = NodeIndex & NodeBody` is what you have once a body is loaded.

The line was drawn by measuring: those four body fields were 69% of the payload and are only
needed once a reader has committed to an idea. `quiz` is in the body deliberately — keeping it
bundled would have cost +79 KB gz on every visit to save a ~6 KB fetch on the first quiz in a
cluster.

## How the app loads a body

`src/lib/bodies.ts`:

- `useNodeBody(nodeIndex)` → `{ status: "loading" | "ready" | "error", body, error }`. Renders
  synchronously-ready on a second visit to any node in the same cluster.
- `loadClusterBodies(clusterId)` — the underlying fetch, de-duplicated while in flight, cached in
  a module-level `Map` for the session. Failures are **not** cached, so coming back online
  retries. A non-2xx is an error (never cache an HTML 404 as a body).
- `prefetchBodies(clusterId)` — fire-and-forget warm.

Consumers: `Quiz` takes a `NodeIndex` and loads its own body (skeleton while loading, one-line
notice if offline before the precache landed); `/node/$id` renders the index part on the
server and streams the body in on the client behind the collapsed "Why it works" reveal.

Offline: all 38 body files are in the service worker precache list (`scripts/inject-manifest.ts`)
and `useOfflineWarmup` pulls them into memory after the SW is ready. The bodies' content hashes
are folded into the SW cache version, so editing one quiz busts the cache on the next deploy.

## Editing content

Always through the **add-content** skill (`.claude/skills/add-content/SKILL.md`). Mechanically:

1. Edit `content/clusters/<clusterId>.json` (append to `nodes`; a new cluster is a new file +
   an entry in `content/clusters.json`; a new tag goes in `content/tags.json`).
2. `bun run scripts/archive-sources.ts <clusterId>` — snapshots `furtherReading` URLs and sets
   `archive` on the JSON.
3. `bun run build:content` — regenerates the two outputs. Deterministic: same input → identical
   bytes, so a no-op rebuild is a clean `git status`.
4. `bun run check` (validate → lint → test → build). `validate-nodes.ts` reads `content/`
   directly and also runs `build-content.ts --check`, so a stale `nodes.ts` is a validation
   error, not a silent drift.

Commit `content/`, `src/data/nodes.ts`, `public/content/bodies/` and `public/content/sources/`
together.

Things that will bite:

- **Don't edit `src/data/nodes.ts` or `public/content/bodies/*`.** They're overwritten by the
  next build and CI rejects a mismatch.
- Node key order inside a cluster file is normalized by `scripts/lib/content.ts`
  (`NODE_KEY_ORDER`); unknown keys are kept and moved last so they show up in review rather
  than vanishing.
- `NODES` order in the index is cluster order (from `clusters.json`) then file order within the
  cluster. The old TS array had nodes appended out of cluster order over time; the feed and
  skim sort/shuffle deterministically so the change was invisible, but if something ever
  depends on `NODES[i]` it's this order.
- Test helpers that need the whole corpus with bodies (quiz bias, validator invariants) use
  `src/lib/testContent.ts`, which reads `content/` with `node:fs`. Never import it from app
  code.

## Numbers (2026-09-04)

- 387 nodes / 38 clusters. Source JSON 1.3 MB pretty-printed.
- Index `src/data/nodes.ts`: 357 KB raw / 110 KB gz (was 1.18 MB / 351 KB for the full file).
- Bodies: 727 KB raw / 243 KB gz total; per cluster 1.3–21 KB gz, median 6 KB.
- Client JS: 284 KB gz total (was 447); largest chunk 206 KB gz (was 442). CI hard limit: 260 KB
  on the largest chunk.
