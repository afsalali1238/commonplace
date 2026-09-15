import { describe, it, expect } from "vitest";
import { shuffledOptions } from "./quiz";
import { seededPermutation, hashString } from "./random";
import { allFullNodes } from "./testContent";

// Whole corpus with bodies (the quiz lives in the body half after the split).
const NODES = allFullNodes();

describe("seededPermutation", () => {
  it("is a valid permutation, stable for a key, and varies with key and salt", () => {
    const a = seededPermutation(4, "A1");
    expect([...a].sort()).toEqual([0, 1, 2, 3]);
    expect(seededPermutation(4, "A1")).toEqual(a);
    const others = ["A2", "B1", "AL20"].map((k) => seededPermutation(4, k));
    expect(others.some((o) => o.join() !== a.join())).toBe(true);
    expect(seededPermutation(4, "A1", 1).join() === a.join()).toBe(false);
  });

  it("hashes distinct short ids to distinct seeds", () => {
    const seeds = new Set(NODES.map((n) => hashString(n.id)));
    expect(seeds.size).toBe(NODES.length);
  });
});

describe("shuffledOptions", () => {
  it("keeps exactly one correct option and preserves every option text", () => {
    for (const n of NODES) {
      const opts = shuffledOptions(n.id, n.quiz);
      expect(opts.filter((o) => o.correct)).toHaveLength(1);
      expect(opts.find((o) => o.correct)!.text).toBe(n.quiz.options[n.quiz.correctIndex]);
      expect([...opts.map((o) => o.text)].sort()).toEqual([...n.quiz.options].sort());
    }
  });

  it("keeps the displayed position balanced (authored positions are spread)", () => {
    // Historically the authored correctIndex sat at index 1 in ~82% of nodes;
    // the content pass since then spread it out. The guard this test exists
    // for is the DISPLAYED distribution: whatever the authored positions are,
    // no slot may dominate after shuffling.
    const authored = [0, 0, 0, 0];
    for (const n of NODES) authored[n.quiz.correctIndex]++;
    for (let i = 0; i < 4; i++) expect(authored[i] / NODES.length).toBeLessThan(0.5);

    const displayed = [0, 0, 0, 0];
    for (const n of NODES) displayed[shuffledOptions(n.id, n.quiz).findIndex((o) => o.correct)]++;
    // Ideal is ~25% per slot for 4-option quizzes (3-option ones can't land
    // in slot D, which pulls it a little low). No slot may dominate.
    for (let i = 0; i < 4; i++) {
      expect(displayed[i] / NODES.length).toBeLessThan(0.4);
    }
    expect(Math.max(...displayed) - Math.min(...displayed)).toBeLessThan(NODES.length * 0.2);
  });

  it("changes the order for a different salt (Review passes the Leitner box)", () => {
    const changed = NODES.filter(
      (n) =>
        shuffledOptions(n.id, n.quiz, 0)
          .map((o) => o.originalIndex)
          .join() !==
        shuffledOptions(n.id, n.quiz, 2)
          .map((o) => o.originalIndex)
          .join(),
    ).length;
    expect(changed / NODES.length).toBeGreaterThan(0.85);
  });
});
