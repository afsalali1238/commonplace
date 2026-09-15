import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { NODE_BY_ID } from "@/data/nodes";
import { MicroLabel } from "@/components/MicroLabel";
import { Quiz } from "@/components/Quiz";
import { useStore, dueIds, currentStreak } from "@/lib/store";
import { useHydrated } from "@/lib/hydrated";
import { FirstTimeHint } from "@/components/FirstTimeHint";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Review — Unknown" },
      { name: "description", content: "Spaced repetition for the ideas you've learned." },
    ],
  }),
  component: ReviewScreen,
});

function ReviewScreen() {
  const hydrated = useHydrated();
  const review = useStore((s) => s.review);
  const streakDays = useStore((s) => s.streakDays);
  const streak = hydrated ? currentStreak(streakDays) : 0;

  // Snapshot the due queue once, at the moment hydration completes - NOT
  // reactively on every `review` change. submitQuiz() updates `review` on
  // every answer, and a correct answer moves that id's `due` timestamp into
  // the future, so a `[hydrated, review]` dependency would re-filter *and*
  // re-shuffle the queue after every single answer. Combined with a plain
  // idx++ pointer, that reshuffle-on-answer silently skipped items and
  // ended sessions early ("You're all caught up" while items were still
  // due, just never reached because the array kept shrinking out from
  // under a monotonically increasing index).
  const queue = useMemo(() => {
    if (!hydrated) return [] as string[];
    const ids = dueIds(review);
    return ids.sort(() => Math.random() - 0.5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const [idx, setIdx] = useState(0);

  if (!hydrated) return <div className="px-5 pt-8" />;

  if (queue.length === 0 || idx >= queue.length) {
    return (
      <div className="px-5 pt-16 text-center">
        <MicroLabel>Review</MicroLabel>
        <h1 className="mt-3 font-serif text-4xl text-ink">You're all caught up.</h1>
        <p className="mt-3 font-serif text-lg italic text-ink-soft">Come back tomorrow.</p>
        <div className="mt-8 inline-flex items-baseline gap-3 border-t border-b border-line py-4">
          <span className="font-mono text-4xl text-accent">{streak}</span>
          <MicroLabel>Day streak</MicroLabel>
        </div>
        <div className="mt-10">
          <Link
            to="/"
            className="inline-flex border border-ink px-5 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink"
          >
            Back to feed
          </Link>
        </div>
      </div>
    );
  }

  const id = queue[idx];
  const node = NODE_BY_ID[id];
  if (!node) {
    setIdx(idx + 1);
    return null;
  }

  return (
    <div className="px-5 pt-8 pb-10">
      <div className="flex items-baseline justify-between">
        <MicroLabel>
          Review · {idx + 1} / {queue.length}
        </MicroLabel>
        <MicroLabel>Streak · {streak}d</MicroLabel>
      </div>

      {idx === 0 && (
        <FirstTimeHint id="hint-review-leitner" className="mt-6">
          This queue is only what's due today — answering elsewhere doesn't fill it up, a schedule
          does. Get one right and it moves further out before resurfacing; get it wrong and it comes
          right back to the front. Skipping a day doesn't lose progress, items just wait.
        </FirstTimeHint>
      )}

      <div className="mt-8">
        <Quiz
          key={node.id}
          node={node}
          hideHeader
          // Box number as the shuffle salt: each time this node comes back
          // around the options sit in a different order, so a 3rd sitting
          // can't be passed by remembering "it was C last time".
          salt={review[node.id]?.box ?? 0}
          renderFooter={() => (
            <div className="mt-6 border-t border-line pt-6">
              <p className="font-serif text-lg leading-snug text-ink">
                From{" "}
                <Link to="/node/$id" params={{ id: node.id }} className="italic text-accent">
                  {node.title}
                </Link>{" "}
                · {node.author}
              </p>
              <p className="mt-2 text-sm text-ink-soft">{node.thesis}</p>
              <button
                onClick={() => setIdx((n) => n + 1)}
                className="mt-6 w-full border border-ink bg-ink py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-paper"
              >
                {idx + 1 < queue.length ? "Next →" : "Finish"}
              </button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
