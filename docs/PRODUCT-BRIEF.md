# Product Brief & Information Architecture — v1 (the source of truth)

_One unified library. One codebase (built on capital-map / Epistemoph). One flow. This is the document you redesign FROM — nothing ships that contradicts it without changing it here first._

---

## 1. The idea, in one line

**A cross-linked, layered, audio-narrated map of the world's most powerful ideas — built not to _read_, but to _retain_.**

Every idea (a mental model _or_ a billion-dollar primary document) is a **node**: taught in layers, wired to related nodes, and drilled with spaced repetition until it sticks.

## 2. The reason it exists (the "why")

Two products almost do this and both fail in the same place:

- **Blinkist** gives you 6,500 _isolated_ summaries. You finish one and it evaporates, because it connects to nothing and you're never tested.
- **Farnam Street** has the right philosophy — Munger's _latticework_, ideas as one connected mesh across disciplines — but it's a blog, not a product you can live inside.

This app is the missing thing: **the latticework as an actual product**, where the cross-links between ideas are a first-class feature (not a footer), and where retention mechanics — layered teaching, active recall, spaced repetition — are the core loop, not an add-on.

**The one sentence to defend against scope creep:** _If a feature doesn't help an idea connect to another idea, or help it stick in memory, it doesn't belong in v1._

## 3. What "one unified library" means

Mental models and Billion Dollar PDFs are **not two apps** — they're two **clusters** on the same map. A mental model (`Inversion`) and a primary document (`Do Things That Don't Scale`) are the _same data shape_: a node with layered content, a quiz, related links, and sources. This is what makes the latticework powerful — `Compounding` (mental model) can link to a `Berkshire letter` (document) across universes. That cross-universe link is the whole point.

## 4. The atomic unit: the Node

Already defined in `capital-map/src/types.ts` — keep it, this is the backbone:

| Field                      | Role                                           |
| -------------------------- | ---------------------------------------------- |
| `layer0`                   | Plain English — the advance organizer / schema |
| `layer1`                   | The mechanism — _why_ it works                 |
| `layer2`                   | Hands-on — apply it to your own situation      |
| `quiz`                     | Active recall — the retention check            |
| Related links              | The latticework — cross-cluster connections    |
| `furtherReading` / sources | Provenance, curated not copied                 |

**One addition from big-ideas-app to fold in:** the _blurred takeaway_ at the end (active-recall check) and _synced sentence-level audio_. Those are the two ideas from the Next.js prototype worth porting; everything else stays in Epistemoph.

---

## 5. The core problem to fix: flatten-then-nest the navigation

**Originally:** six co-equal top-nav items — `Map · Review · Reading List · Glossary · Scratchpad · Progress`. Six equal choices = decision paralysis and the "scattered everywhere" feeling. None of them tells you _what to do next_.

**The fix:** there are really only **three jobs** a user comes here to do — read, browse, retain. Everything else is support, and support does not deserve top-level real estate.

```
                    ┌─────────────────────────────────────┐
                    │            THE APP                    │
                    └─────────────────────────────────────┘
                                    │
     ┌──────────────────┬──────────┴───────────┬──────────────────┐
     ▼                  ▼                       ▼                  ▼
 ┌────────┐        ┌─────────┐            ┌──────────┐       ┌─────────┐
 │  MAP   │        │  NODE   │            │  REVIEW  │       │   YOU   │
 │ (home) │───────▶│ (learn) │───────────▶│ (retain) │       │(support)│
 └────────┘        └─────────┘            └──────────┘       └─────────┘
  browse +          layer 0→1→2            spaced-rep         progress,
  continue +        →quiz→related          drilling of        streak,
  what's due        →audio→next            due nodes          reading list,
                                                              glossary,
                                                              scratchpad
```

### Primary navigation = 4 destinations (+ node view)

_Revised 2026-09-04. The original v1 bar was **Map · Review · You**. The Feed (see `FEED-SPEC.md`) replaced Map as the home surface, and its structured-browse job moved to Explore, so the bar is now four — per FEED-SPEC §7 option A. What did **not** change: Review is a primary destination with a due badge, and everything else lives one tap down. (An intermediate build shipped `Feed · Skim · Explore · You` with Review demoted into You — that contradicted this section and has been reverted; Skim is a browsing mode reached from Explore, not a tab.)_

Mobile-first bottom nav (port `BottomNav` from big-ideas-app), because this is a pocket PWA:

1. **Feed** — home. Today's reading, chosen from the topics you picked, one idea per screen with a door to go deeper. This is the launchpad; it always answers "what do I read next?"
2. **Explore** — structured browse: topic collections, the full lattice index with progress, search, and **Skim** (the whole lattice one thesis at a time).
3. **Review** — the retention loop. Just the nodes due for spaced repetition, **with the count badge on the tab**. One job. The badge is the daily trigger; without it the retain loop has no front door.
4. **You** — everything that was cluttering the nav: Progress/streak/stats, Leitner box distribution, Saved, Glossary, Scratchpad, Backup. These are _reference/self_ surfaces, not daily destinations — they belong one tap down, not in the primary bar.

**Node** is not a nav tab — it's the screen you land on _from_ the Feed, Explore, or Review. It's where 90% of the time is spent.

## 6. The two core loops (this is the whole product)

**LEARN loop:** Map → open Node → Layer 0 → Layer 1 → Layer 2 → quiz → _blurred takeaway (recall check)_ → Related ideas → auto-suggest next node ("If you liked X, here's how it connects to Y"). Audio can drive this hands-free.

**RETAIN loop:** Review tab → due node's quiz surfaces (as a _scenario/hook_, not the title, to defeat the illusion of competence) → answer → Leitner box updates → next due node. Ten minutes a day, this is the habit that makes the app worth keeping.

Everything else (glossary, scratchpad, stats, reading list) exists to _serve_ these two loops, never to compete with them for attention.

## 7. Design principles (the rules the UI obeys)

1. **Always answer "what next?"** — the Map's top row is _Continue_ + _Due today_. Never drop the user onto a wall of equal choices.
2. **The node is the hero.** One clean reading column, layers revealed progressively (don't dump L0/L1/L2 at once — gate them so the user commits before the mechanism unlocks).
3. **Retention beats reach.** A visible streak + due badge matters more than a bigger catalog. Depth over breadth.
4. **Cross-links are loud, not buried.** Related ideas are a designed section mid/late in the node, styled as the payoff — not grey footer links.
5. **One visual system.** Kill the two-codebase split: one type scale, one color system (Epistemoph's `paper/ink/accent` tokens), one component library. Consistency _is_ the redesign. _Extended 2026-09-04:_ imagery and motion are part of that one system — artwork is generated from the spiral/thread/dot of the mark, in the tokens, per topic and per idea (`docs/VISUAL-SYSTEM.md`); no illustrations that live outside it.
6. **Offline is invisible.** Starred nodes cache silently; no download-manager UI in v1.

## 8. What to merge, what to drop

- **Foundation:** capital-map / Epistemoph (keep the map, clusters, review, glossary, stats, reading list, scratchpad, the Node type, localStorage progress).
- **Port in from big-ideas-app:** `BottomNav` (mobile shell), synced sentence-level audio + Media Session lock-screen controls, the blurred-takeaway recall check, the service-worker offline model.
- **Retire:** big-ideas-app as a separate app, and the duplicated MDX content model. One node schema, one repo.

## 9. Naming

You currently have three names (Big Ideas, Epistemoph, novibe). Pick one before you design a single screen — the name sets the tone of the whole visual system. `Epistemoph` is the most distinctive; `Big Ideas` is the clearest. Decide, then everything inherits from it.

---

### The redesign, in one breath

Merge three prototypes into one Epistemoph shell → collapse six flat tabs into **Feed · Explore · Review · You** with the **Node** as the hero screen → make today's reading and the _due_ count the first things you see → treat cross-links and spaced repetition as the product, and everything else as support.
