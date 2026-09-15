import { describe, it, expect } from "vitest";
import {
  currentStreak,
  dueCount,
  dueIds,
  stateSchema,
  isQueued,
  readNextNodes,
  type ReviewEntry,
} from "./store";

describe("store.ts pure functions", () => {
  describe("currentStreak", () => {
    it("returns 0 for empty array", () => {
      expect(currentStreak([])).toBe(0);
    });

    it("counts consecutive days backwards from today", () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(today.getDate() - 2);

      const days = [localDay(today), localDay(yesterday), localDay(twoDaysAgo)];

      expect(currentStreak(days)).toBe(3);
    });

    it("allows missing today if yesterday was logged", () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(today.getDate() - 2);

      const days = [localDay(yesterday), localDay(twoDaysAgo)];

      expect(currentStreak(days)).toBe(2);
    });

    it("breaks streak if gap is larger than 1 day", () => {
      const today = new Date();
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(today.getDate() - 3);

      const days = [localDay(today), localDay(threeDaysAgo)];

      // Streak should only be 1 (today), because yesterday is missing.
      expect(currentStreak(days)).toBe(1);
    });
  });

  describe("dueCount and dueIds", () => {
    it("returns correct counts based on due timestamp", () => {
      const now = Date.now();
      const review: Record<string, ReviewEntry> = {
        node1: { box: 1, due: now - 1000 }, // Past due
        node2: { box: 2, due: now + 50000 }, // Future
        node3: { box: 0, due: now - 5000 }, // Past due
      };

      expect(dueCount(review)).toBe(2);
      expect(dueIds(review)).toEqual(["node1", "node3"]);
    });

    it("returns 0 for empty review map", () => {
      expect(dueCount({})).toBe(0);
      expect(dueIds({})).toEqual([]);
    });
  });

  describe("submitQuiz (store action)", () => {
    it("moves up a box on correct (cap 5) and down two boxes on wrong (floor 0)", () => {
      useStore.getState().reset();
      for (let i = 0; i < 7; i++) useStore.getState().submitQuiz("B1", true);
      expect(useStore.getState().review.B1.box).toBe(5);
      useStore.getState().submitQuiz("B1", false);
      expect(useStore.getState().review.B1.box).toBe(3);
      useStore.getState().submitQuiz("B1", false);
      expect(useStore.getState().review.B1.box).toBe(1);
      useStore.getState().submitQuiz("B1", false);
      expect(useStore.getState().review.B1.box).toBe(0);
      expect(useStore.getState().review.B1.lastResult).toBe("incorrect");
    });
  });

  describe("visitNode read log", () => {
    it("dedupes and moves re-visited ids to the end", () => {
      useStore.getState().reset();
      useStore.getState().visitNode("A1");
      useStore.getState().visitNode("B2");
      useStore.getState().visitNode("A1");
      expect(useStore.getState().readLog).toEqual(["B2", "A1"]);
    });

    it("caps history at 200 entries", () => {
      useStore.getState().reset();
      for (let i = 0; i < 205; i++) useStore.getState().visitNode(`n${i}`);
      const log = useStore.getState().readLog;
      expect(log).toHaveLength(200);
      expect(log[log.length - 1]).toBe("n204");
      expect(log[0]).toBe("n5");
    });
  });

  describe("submitQuiz Leitner math", () => {
    it("clamps box at 0 on repeated incorrect answers", () => {
      useStore.getState().reset();
      useStore.getState().submitQuiz("A1", false); // 0 -> -2 clamped to 0
      useStore.getState().submitQuiz("A1", false);
      expect(useStore.getState().review.A1?.box).toBe(0);
    });

    it("clamps box at 5 on repeated correct answers", () => {
      useStore.getState().reset();
      for (let i = 0; i < 8; i++) useStore.getState().submitQuiz("A1", true);
      expect(useStore.getState().review.A1?.box).toBe(5);
    });

    it("incorrect moves back two boxes", () => {
      useStore.getState().reset();
      for (let i = 0; i < 4; i++) useStore.getState().submitQuiz("A1", true); // box 4
      useStore.getState().submitQuiz("A1", false);
      expect(useStore.getState().review.A1?.box).toBe(2);
      expect(useStore.getState().review.A1?.lastResult).toBe("incorrect");
    });
  });

  describe("reorderReadNext", () => {
    it("moves an item between positions", () => {
      useStore.getState().reset();
      ["A1", "B2", "C3"].forEach((id) => useStore.getState().addReadNext(id));
      useStore.getState().reorderReadNext(0, 2);
      expect(useStore.getState().readNext).toEqual(["B2", "C3", "A1"]);
    });
  });

  describe("stateSchema (Zod validation)", () => {
    it("passes on valid partial JSON state with catch defaults", () => {
      const validJSON = {
        gotIt: { node1: true },
        review: {},
        streakDays: ["2026-07-15"],
        glossary: [],
        interests: ["Startups"],
        onboardingComplete: true,
        ttsRate: 1.5,
        bookmarks: {},
        visited: {},
        scratchpad: "",
        readNext: ["node1", "node2"],
      };

      const result = stateSchema.safeParse(validJSON);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.readNext).toEqual(["node1", "node2"]);
      }
    });

    it("fails cleanly when given malicious or fundamentally malformed structures", () => {
      const badJSON = {
        gotIt: "this should be a record, not a string",
      };

      const result = stateSchema.safeParse(badJSON);
      expect(result.success).toBe(false);
    });

    it("strips out undocumented keys", () => {
      const extraKeysJSON = {
        gotIt: {},
        bookmarks: {},
        visited: {},
        review: {},
        streakDays: [],
        glossary: [],
        interests: [],
        onboardingComplete: false,
        ttsRate: 1.0,
        scratchpad: "",
        maliciousKey: "should disappear",
      };

      const result = stateSchema.safeParse(extraKeysJSON);
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>).maliciousKey).toBeUndefined();
        // and default readNext should be provided
        expect(result.data.readNext).toEqual([]);
      }
    });
  });
});
