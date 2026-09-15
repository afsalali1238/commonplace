# Unknown — Workflow & UI/UX Proposal (v2: minimal, named for reading, not video)

Revises the first draft on three points: the glimpse mode needs a name that belongs to reading, not to video; the tone throughout should read as considered and literary, not gamified; and the nav should be cut to the fewest tabs that still cover the whole product. Still builds on what's already in the repo — `docs/PRODUCT-BRIEF.md`, `docs/FEED-SPEC.md`, and the unbuilt `design_handoff_reels_and_nav/` handoff — nothing here contradicts those, it sharpens the naming and trims the surface area.

---

## 1. Naming: drop "Reels"

"Reels" borrows a video app's vocabulary for a text product, and it undersells what the mode actually is — a fast pass through the lattice, one idea's thesis at a time, the reading equivalent of flipping through a stack of index cards or scanning a table of contents. Video terms also work against the audience: someone who thinks in Munger's latticework and reads primary documents for fun isn't looking for something that sounds like short-form video.

**Recommendation: `Skim`.** It's a real, precise verb for what's happening (you skim a text before you commit to reading it), it's one syllable, and it sets the correct expectation — thin, fast, no commitment — the same way "Review" and "Explore" set expectations elsewhere in the app. Route: `/skim`. Tab label: **Skim**.

If you want something a touch more literary: **`Glimpses`** (noun, matches "a glimpse of an idea") or **`Digest`** (evokes a considered summary, slightly more formal). `Skim` is the recommendation — shortest, clearest, most self-explanatory to a first-time user, no explanation needed.

Everything the Reels handoff already designed (full-bleed thesis card, swipe to advance, tap to open the full node) carries over unchanged — only the name and the tab copy change.

---

## 2. Minimal nav: four tabs, not five

> **Superseded (2026-09-04):** the bar shipped as **Feed · Explore · Review · You** (PRODUCT-BRIEF §5,
> FEED-SPEC §7 option A). This section's variant dropped Review from the bar, which removed the
> retention loop's only daily trigger; Skim is instead reached from Explore. Everything else in
> this document (naming, tone, "Continue reading" cue, Queue vs Save) stands.

The product brief's own principle (§5) is that six flat tabs caused decision paralysis, and it correctly cut to three. Adding Feed and then a fifth tab for the glimpse mode undoes that discipline. Cutting back:

**Feed · Skim · Review · You**

- **Explore is folded, not deleted.** Its two views (curated topic collections, and the full lattice list with progress rings) move one tap down, inside **You**, under a single "Library" section — this is where a considered reader goes when they want the _whole_ map, not the algorithmic feed. It doesn't need to compete for bottom-bar space with the two things you actually do daily (read, review).
- **Skim absorbs Explore's "browse broadly" job.** Skimming through the lattice at speed already _is_ browsing everything — a separate top-level tab for the same intent is redundant surface area, not a distinct job.
- Four words, read once, understood permanently: **Feed** (what's for me today), **Skim** (flip through the lattice fast), **Review** (what I owe my memory), **You** (my library, my progress, myself).

```
Onboarding (choose your subjects)
        │
        ▼
   ┌─────────┐   tap card / "Read more"    ┌───────────────┐
   │  FEED    │ ──────────────────────────▶│  NODE (full)   │
   │  today's │ ◀────────────────────────  │  Layer 0→1→2   │
   │  reading │        back                 │  → Recall check│
   └────┬─────┘                             │  → Related     │
        │                                    └──────┬─────────┘
        │                                            │ tap related idea
        ▼                                            │
   ┌─────────┐    tap the thesis                     │
   │  SKIM    │───────────────────────────────────────▶
   │  the whole lattice, at speed
   └────┬─────┘
        │
        ▼
   ┌─────────┐
   │ REVIEW   │   what's due for spaced repetition today
   └────┬─────┘
        │
        ▼
   ┌─────────┐
   │  YOU     │   Queue · Library (saved + full lattice) · Progress
   └─────────┘
```

---

## 3. The fix you asked for first: make "read more" explicit

A Feed card currently only implies it opens into something larger — the tap is a hidden affordance, an interaction with no visible signifier. A considered reader shouldn't have to discover this by accident; state it plainly, the way a table of contents states what a chapter contains.

```
[the hook — one paragraph, the idea in plain terms]

Continue reading — the mechanism, how to apply it, and what it connects to  →
```

Written as a sentence, not an icon or a vague ellipsis — it tells the reader exactly what's ahead (mechanism, application, connections) before they commit the tap. This is closer to how a serious publication labels a "continued on page 4" jump than to a social app's "…more." Keep it as plain text, `font-sans`, `text-ink-soft`, no button chrome — it should read as an editorial cue, not a UI control begging to be clicked.

---

## 4. What each screen is for, in one line each — nothing extra

- **Feed** — the reading chosen for you today, from what you told it you care about.
- **Skim** — the entire lattice, one thesis at a time, for when you want breadth instead of depth.
- **Node** — the full idea: plain explanation, mechanism, application, a recall check, and what it connects to.
- **Review** — what's due to be tested today, so it actually stays with you.
- **You** — your queue, your saved library, the full lattice list, your progress.

Two save actions only, never blurred together, named for what they mean rather than borrowed music-app jargon: **Queue** (I intend to read this next) and **Save** (I want this in my library, indefinitely). One tap from either sits inside **You**.

---

## 5. Tone: write for someone who already reads primary sources

The copy throughout should assume the reader already respects ideas — no manufactured urgency, no gamified language ("streak," if kept, should read as a quiet counter, not a flame emoji or a badge popup). A few concrete swaps:

| Avoid                              | Use instead                                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| "Swipe for your next hit of ideas" | "Skim the lattice"                                                                              |
| "Reels"                            | "Skim"                                                                                          |
| icon-only buttons with no label    | one word under every icon, at least on first use                                                |
| "🔥 3 day streak!"                 | "3 days" in quiet numerals, no emoji                                                            |
| "You'll love this!"                | the credential line — author, year, category — let the source's authority speak, not enthusiasm |

---

## 6. What to build first

1. Rename the Reels handoff to **Skim** before building it — same design, new name, one 5th tab collapses back into the existing bar by absorbing Explore's job.
2. Add the literal "Continue reading — …" line under every Feed card's hook.
3. Fold Explore's two views (curated collections, full lattice) into a **Library** section inside **You**.
4. Rename any "queue vs. saved" copy so the two are never ambiguous — Queue = next, Save = library.

Everything else in `PRODUCT-BRIEF.md` and `FEED-SPEC.md` stands as written — this is a naming and surface-area trim, not a rebuild.
