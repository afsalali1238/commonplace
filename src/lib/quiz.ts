import type { Quiz } from "@/data/nodes";
import { seededPermutation } from "./random";

export type ShuffledOption = { originalIndex: number; text: string; correct: boolean };

/**
 * A node's quiz options in a per-node shuffled order.
 *
 * Why shuffle: early authored data had the correct answer at index 1 in ~82%
 * of nodes (a later content pass spread the positions), so an unshuffled quiz
 * teaches the slot pattern and the Leitner boxes end up measuring
 * pattern-matching instead of recall. The permutation is a pure function of
 * the node id (plus an optional salt), so it is stable across re-renders,
 * identical on server and client (no hydration mismatch), and never
 * reshuffles under the user's thumb mid-answer.
 *
 * `salt` varies the order between sittings of the same node — Review passes
 * the Leitner box — so a returning user can't rely on "it was the third one".
 */
export function shuffledOptions(nodeId: string, quiz: Quiz, salt = 0): ShuffledOption[] {
  const order = seededPermutation(quiz.options.length, nodeId, salt);
  return order.map((originalIndex) => ({
    originalIndex,
    text: quiz.options[originalIndex],
    correct: originalIndex === quiz.correctIndex,
  }));
}
