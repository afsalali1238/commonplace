# Feed — "TikTok of reading" (product + UX spec)

Status: proposed. Scope: a new **Feed** mode alongside Map/Explore/Review/You.
Algorithm: serendipity + interest blend. Build: spec first, then MVP.

---

## 1. The one principle

**Every swipe delivers one genuinely interesting idea, readable in 15 seconds, with a door to go deeper.**
Not doomscroll filler — each card is a real idea from a real source. The dopamine comes from
_surprise + substance_, not outrage. If a card isn't interesting enough to stop the thumb, it
doesn't belong in the feed.

## 2. Why this app is already built for it

The content model maps 1:1 onto a feed with almost no content work:

- `layer0` → the **hook** (the full-screen card body).
- `title` + `author` + `year` + `medium` + `category` → the **credential line** (why trust this).
- `thesis` → optional one-line **TL;DR** overlay.
- `layer1` / `layer2` → **go deeper**, revealed in place (reuse `LayerReveal`).
- `quiz` → optional **"test yourself"** after a deep read (reuse `Quiz`, feeds Leitner review).
- `bookmarks` / `gotIt` / `visited` / `review` → all existing store actions, reused as feed gestures.
  The only genuinely new things are the **feed surface** and the **sequencing algorithm**.

## 3. Card anatomy (full-screen, one card = one node)

Vertical, edge-to-edge, `bg-paper`. Top to bottom:

1. **Micro-label row** (`font-mono`, `text-ink-soft`, uppercase, tracked): `CLUSTER TITLE · MEDIUM`
   e.g. `STARTUP FUNDAMENTALS · ESSAY`. Reuse `MicroLabel`.
2. **Title** (`font-serif`, large, `text-ink`).
3. **Hook** = `layer0`, set at a comfortable reading size with generous line-height. This is the star.
4. **Credential line** (`font-mono`, small, `text-ink-soft`): `author · year · category`.
5. **Right-rail quick actions** (TikTok-style vertical stack, thumb-reachable):
   - **Save** (bookmark toggle → `toggleBookmark`); filled when saved.
   - **Got it** (`markGotIt` → also extends streak); shows ✓.
   - **Go deeper** (expands layer1/2 in place).
   - **Test yourself** (opens quiz sheet).
   - **Share** (copy link / native share of the node).
6. **Progress hint** (bottom, faint): mastery dot / `ProgressRing` (box) / ✓ — same language as `NodeCard`.
7. **Swipe affordance** on first-ever card only (`FirstTimeHint`): "Swipe up for the next idea."

## 4. Interaction model

- **Mobile (primary):** vertical swipe up = next, down = previous. One card fills the viewport
  (CSS scroll-snap, `snap-y snap-mandatory`, `h-[100dvh]`). Momentum but snaps to one card.
- **Desktop:** wheel/trackpad scroll snaps card-to-card; ↑/↓ or `j`/`k` keys navigate; `Space` = go deeper.
- **Tap the hook / "Go deeper":** expands `layer1` then `layer2` **inline within the card** (via
  `LayerReveal`), so the user never leaves the feed. The card grows to scroll internally. A second
  door — "Open full node" — routes to `/node/$id` for related links + furtherReading + audio.
- **Double-tap the card:** Save (bookmark) with a quick heart/star pulse — the signature TikTok gesture.
- **"Test yourself":** opens the `Quiz` in a bottom sheet; answering schedules Leitner review exactly
  as the node page does (`submitQuiz`). Feed keeps its place.
- **Respect `prefers-reduced-motion`:** cross-fade instead of slide; no parallax.

## 5. Feed algorithm — serendipity + interest blend

Goal: mostly relevant, never narrow, never repetitive, infinite.

**Candidate weighting per pick (normalized):**

- **60% Interest match** — nodes whose `tags` intersect the user's `interests`.
- **25% Serendipity** — a random node from a cluster the user hasn't seen this session (cross-pollination).
- **15% "Because you saved/mastered X"** — nodes in the `related[]` of recently saved/gotIt nodes.

**Rules:**

- **No repeats** until the pool is exhausted: track a session `feedSeen` set; exclude visited-this-session.
- **Freshness bias:** unseen (`!visited[id]`) nodes rank above already-visited ones, but visited nodes
  re-enter once the unseen pool thins, so the feed is truly infinite.
- **Cluster spacing:** never show two cards from the same cluster back-to-back.
- **Cold start (no interests / skipped onboarding):** fall back to pure serendipity (shuffle), and
  quietly learn: after ~5 saves, start weighting toward the clusters/tags of saved cards.
- **Session seed:** deterministic shuffle seeded once per session so back-swipe returns the same card
  (no jarring reshuffle), but each new session feels fresh.
- **Learning-aware (v2 toggle, not MVP):** optionally inject due-review nodes (`due <= now`) at a low
  rate so discovery and retention share one surface.

**Pseudocode (client-side, no backend):**

```
pool = NODES.filter(n => !feedSeen.has(n.id))
score(n) =
   0.60 * (tagsOverlap(n.tags, interests) ? 1 : 0)
 + 0.25 * random()
 + 0.15 * (relatedToRecentlyLiked(n) ? 1 : 0)
 + 0.10 * (!visited[n.id] ? 1 : 0)          // freshness nudge
next = argmax(score) with constraint(cluster != lastCluster)
```

All in-memory over the 270 nodes — cheap, offline-friendly, no server.

## 6. State additions (minimal, backward-compatible)

Add to the persisted store (all optional/defaulted so old backups import cleanly):

- `feedLikes?: Record<string, boolean>` — explicit "more like this" signal (or reuse `bookmarks`).
- Session-only (NOT persisted): `feedSeen: Set<string>`, `sessionSeed: number`, `lastCluster`.
  Reuse as-is: `interests`, `visited`, `bookmarks`, `gotIt`, `review`. No schema break.

## 7. Navigation & placement

Feed is a peer tab. Two options for `BottomNav` (currently Home/Explore/Review/You):

- **A (recommended):** rename Home→**Feed** as the landing surface's _sibling_, giving
  **Feed · Explore · Review · You** (4 tabs, Feed first). The old Map/continue/due view moves
  under Explore or a Home affordance, keeping the bar to 4.
- **B:** add a 5th tab (**Home · Feed · Explore · Review · You**) — simplest, but 5 tabs crowd small phones.
  Recommendation: **A** — commit to Feed as the default entry without deleting structured browsing.
  Route: `/feed`. Deep-link a specific card via `/feed?start=<id>` (e.g. from a share).

## 8. States

- **First card:** one-time swipe hint.
- **Interest-thin pool:** if interests match few nodes, blend in more serendipity rather than showing an empty feed.
- **Exhausted pool:** never dead-ends — recycle least-recently-seen with a subtle "You've seen a lot today ✦" marker every N cards.
- **Offline:** feed works from cached nodes; "Open full node" archived sources open offline; unavailable sources degrade to citation only.
- **Quiz-in-feed cancel:** dismissing the sheet returns to the exact card.

## 9. Metrics (the engagement loop worth watching)

Per card: **impression, dwell time, depth-expand (deeper tapped), save, gotIt, quiz-start, quiz-pass, share.**
North-star: _depth-expand rate_ and _saves per session_ — not raw swipe count. Optimizing for swipes
alone breeds junk; optimizing for "stopped to read deeper / saved it" keeps the feed substantive.

## 10. Performance

- Window the DOM: render current ± 2 cards only; recycle nodes. No raster images — the only image on a card is the idea's generated inline-SVG glyph (`docs/VISUAL-SYSTEM.md`), so cards stay text-cheap.
- Preload the next 2 cards' layers. Whole graph already in memory (see NODES-SPLIT-DECISION — still fine at 270).

## 11. Accessibility

- Every swipe action has a keyboard + visible-button equivalent (↑/↓, on-screen next/prev).
- Focus moves to the new card's title on advance; announce card position politely.
- Honor `prefers-reduced-motion`; ensure `paper`/`ink`/`accent` contrast passes AA at the large hook size.

## 12. Content implications (feeds back into add-content)

The feed lives or dies on `layer0` working as a **cold open** — a hook that stops the thumb without
any surrounding context. Add to the add-content house style and to `audit-content.ts`:

- a check/heuristic for `layer0` length + opening strength (flag layer0s that start with "This
  essay..." or bury the idea).
- consider a dedicated short `hook` field later if `layer0` proves too long for a card; for MVP,
  render the first ~55 words of `layer0` with a "more" fade.

## 13. Risks / anti-patterns

- **Becoming junk food:** guardrail = substance-first ranking (depth/saves, not swipe velocity).
- **Filter bubble:** the 25% serendipity slice is non-negotiable — it's what makes it _reading_, not a rut.
- **Infinite-scroll guilt:** consider a gentle "great session" marker rather than literally endless; opt-in.

## 14. Phased build

1. **MVP:** `/feed` route, full-screen scroll-snap cards from `layer0`, swipe + quick actions
   (save/gotIt/deeper/quiz), interest-blend algorithm, session no-repeat. Feed tab in `BottomNav`.
2. **v2:** "because you saved X" signal, share deep-links, metrics, exhaustion marker.
3. **v3:** learning-aware injection (due reviews in-feed), optional dedicated `hook` field + audit rule.

## 15. Open questions

- Feed as default landing (option A) or additive 5th tab (option B)? (Leaning A.)
- Reuse `bookmarks` as the "like" signal, or a separate `feedLikes`? (Leaning reuse.)
- Cap session length with a wellbeing marker, or truly infinite? (Leaning gentle marker.)
