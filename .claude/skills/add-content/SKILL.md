---
name: add-content
description: The single conversational entrypoint for adding content nodes to the "Unknown" app (content/clusters/<clusterId>.json). Use whenever the user pastes an article, transcript, notes, a URL, or a batch of several and wants them turned into node(s). Replaces docs/ADD-NODE-PROMPT.md and the inject-batchN.ts scripts. Proposes node(s) before writing, assigns ids deterministically, generates the quiz inline, archives sources, and runs the validation gate automatically. Works identically for 1 node or 50 — never spawn a per-batch script.
---

# Add Content — one flow for 1 node or many

You are adding one or more knowledge nodes to `content/clusters/<clusterId>.json` — the
source of truth, one JSON file per cluster (see `docs/CONTENT-LAYER.md`). This is the
ONLY sanctioned way to add content. Never write a new inject-batchN.ts. Never create a
quiz-patch JSON. Never hand-edit ids. **Never edit `src/data/nodes.ts` or
`public/content/bodies/*` — both are generated** by `bun run build:content` and CI
fails if they're stale or hand-edited.

## Backing scripts (the mechanical steps — call these, don't reinvent)

- `bun run scripts/next-id.ts <PREFIX> [count]` — next free id(s) for a prefix.
- `bun run scripts/archive-sources.ts <clusterId>` — snapshot furtherReading URLs.
- `bun run build:content` — regenerate `src/data/nodes.ts` (index) + `public/content/bodies/`.
- `bun run scripts/validate-nodes.ts` — schema gate (must pass before "done").
- `bun run scripts/audit-content.ts ...` — inspect tags/clusters/fields when unsure.

## Non-negotiables (carried over from ADD-NODE-PROMPT.md — do not relax)

1. Never fabricate a source. If you can't identify the real primary source, ask.
2. Original synthesis, not paraphrase. layer0/1/2 are your own words.
3. Match the existing tone of the target cluster. House style: confident, plain,
   no hedging filler; single quotes for inner emphasis (never a literal `"` inside a
   double-quoted string); em dashes for asides; layer2 always ends in a question mark.
4. The quiz has ONE defensibly correct answer. 3 or 4 options (4 preferred),
   correctIndex in range, plus a one-line explanation.
5. Tags MUST be members of the exported TAGS list. If the content needs a tag that
   doesn't exist, stop and ask before adding to TAGS.
6. If the right cluster is unclear, or the content would need a NEW cluster, STOP and
   ask. Never guess a new cluster.
7. `layer0` is the feed cold-open — it must hook without any context. Lead with the idea, not
   meta ("This essay argues…", "In this paper…"). Keep the first sentence tight (<~240 chars).
   Run `bun run scripts/audit-content.ts hooks` to check.

## The flow

### Step 1 — Ingest

Take the pasted source(s). For each item, identify the real primary source(s). If a URL
was given, you may fetch it; if only notes, treat the user as the source of the synthesis
but still cite the real underlying work in furtherReading.

### Step 2 — Propose (and WAIT)

For every proposed node, present a one-line proposal BEFORE writing full content:
`<id> — <title> — cluster <X> (<cluster title>) — thesis: <one line>`
Get the id from `next-id.ts <PREFIX>` (PREFIX is usually the cluster letter; use the
doubled-letter sub-series only if that's the established pattern for the topic).
Do not write layer0/1/2 until the user confirms the proposal. For a batch, list all
proposals at once and confirm the set.

### Step 3 — Write

After confirmation, for each node write the full object matching the Node type:
`id, clusterId, title, author, year, medium, category, thesis, layer0, layer1, layer2,
quiz {question, options[3-4], correctIndex, explanation}, related[], furtherReading[], tags[]`.

- `related`: link within the new content AND back to existing nodes with a real thematic
  tie (use `audit-content.ts` / read the cluster JSON to find good cross-links — this is
  the point of the app). Every related id must resolve to a real node.
- `furtherReading`: real label/source/url for each primary source.
- Append to the `nodes` array in `content/clusters/<clusterId>.json` (2-space JSON, keys
  in the order above — `build:content` normalizes it anyway). A **new cluster** means a
  new `content/clusters/<ID>.json` with `{ "cluster": {id,title,subtitle,icon}, "nodes": [] }`
  AND its id appended to `content/clusters.json` (that list is the display order). A new
  tag goes in `content/tags.json` — but the tag vocabulary is the onboarding interest
  picker, so adding one is a product decision, not a convenience.

### Step 4 — Archive, then regenerate

Run `bun run scripts/archive-sources.ts <clusterId>` to snapshot the new furtherReading
URLs into `public/content/sources/`. Sources that can't be fetched are triaged to
`unavailable` and logged to `archive-failures.log` — that's expected, not an error.

Then `bun run build:content` to regenerate the bundled index and the body files. Commit
`content/`, `src/data/nodes.ts`, `public/content/bodies/` and `public/content/sources/`
together.

### Step 5 — Validate gate (automatic, before saying "done")

Run, in order, and do not report success unless all pass:

1. `bun run scripts/validate-nodes.ts` (also fails if generated files are stale)
2. `bun run scripts/topics-index.ts`
3. `bun run lint`
4. `bun run test`
5. `bun run build`
   Then report: the new id(s), the new total node count, and any archive-failures entries.

## Batch behavior

For many items, loop Steps 1-4 across all of them, confirm proposals as a set in Step 2,
then run the Step 5 gate ONCE at the end. There is no separate "batch mode" and no
per-batch script — same flow, more nodes.
