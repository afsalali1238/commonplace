import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { NODE_BY_ID, type NodeIndex } from "@/data/nodes";
import { MicroLabel } from "@/components/MicroLabel";
import { Quiz } from "@/components/Quiz";
import { Bone } from "@/components/Skeleton";
import { useNodeBody, withBody } from "@/lib/bodies";
import { useStore, dueIds, currentStreak } from "@/lib/store";
import { useHydrated } from "@/lib/hydrated";
import { FirstTimeHint } from "@/components/FirstTimeHint";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Review — Commonplace" },
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
    // Filter to ids that still exist in the corpus: a node can be merged or
    // removed between releases while its review entry persists locally, and
    // an unknown id must never reach NODE_BY_ID[...].
    const ids = dueIds(review).filter((id) => NODE_BY_ID[id]);
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
  // Guaranteed by the queue filter above (due ids that no longer exist are
  // dropped at memo time) — no setState-during-render skip hack needed.
  const node = NODE_BY_ID[id];

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
        <ReviewQuiz
          key={node.id}
          index={node}
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

/**
 * One due card's quiz. Lives in its own component because the quiz question
 * comes from the on-demand body half of the node: the hook must run after
 * ReviewScreen's early returns (caught-up screen, hydration placeholder),
 * which only a child component allows.
 */
function ReviewQuiz({
  index,
  salt,
  renderFooter,
}: {
  index: NodeIndex;
  salt: number;
  renderFooter: (correct: boolean) => ReactNode;
}) {
  const state = useNodeBody(index);

  if (state.status === "error") {
    return (
      <p className="text-sm text-ink-soft">
        Couldn't load this question — you may be offline. It will be back next session.
      </p>
    );
  }
  if (state.status !== "ready") {
    return (
      <div aria-busy="true" className="space-y-2.5">
        <Bone className="h-6 w-5/6" />
        <Bone className="h-12 w-full" />
        <Bone className="h-12 w-full" />
        <Bone className="h-12 w-full" />
      </div>
    );
  }
  return (
    <Quiz node={withBody(index, state.body)} hideHeader salt={salt} renderFooter={renderFooter} />
  );
}
