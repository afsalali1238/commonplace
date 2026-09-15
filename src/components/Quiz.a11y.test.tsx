// @vitest-environment jsdom
/**
 * Automated accessibility gate (starts closing TECH_DEBT §1). Renders the
 * Quiz to static HTML, mounts it in jsdom, and runs axe-core against it.
 * Fails on serious/critical violations; minor advisories are listed but not
 * fatal so the gate can tighten over time.
 */
import { describe, it, expect } from "vitest";
// In-memory indexedDB for jsdom — the store's persist middleware targets
// idb-keyval whenever `window` exists, and jsdom ships no indexedDB.
import "fake-indexeddb/auto";
import { renderToString } from "react-dom/server";
import type { Node } from "@/data/nodes";
import { Quiz } from "./Quiz";

const sampleNode: Node = {
  id: "TEST1",
  clusterId: "T",
  title: "Test Idea",
  author: "Test Author",
  year: 2020,
  medium: "Essay",
  category: "Tests",
  thesis: "A test thesis used to exercise the quiz markup.",
  related: [],
  furtherReading: [],
  tags: ["Tests"],
  layer0: "Layer zero summary.",
  quiz: {
    question: "Which option best captures the test thesis?",
    options: [
      "The correct interpretation of the test thesis",
      "A plausible but wrong reading",
      "Another distractor with comparable length",
      "A clearly incorrect option",
    ],
    correctIndex: 0,
    explanation: "The first option restates the thesis accurately.",
  },
};

async function axeReport(html: string) {
  document.body.innerHTML = `<main>${html}</main>`;
  const axe = (await import("axe-core")).default;
  return axe.run(document.body, { resultTypes: ["violations"] });
}

describe("Quiz accessibility (axe-core)", () => {
  it("unanswered quiz has no serious or critical violations", async () => {
    const results = await axeReport(renderToString(<Quiz node={sampleNode} />));
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });

  it("answered (revealed) state has no serious or critical violations", async () => {
    // Render the revealed state indirectly: pick an answer via a real DOM
    // click so aria-live feedback and disabled radios are exercised.
    const { createRoot } = await import("react-dom/client");
    const { act } = await import("react");
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.innerHTML = "";
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<Quiz node={sampleNode} />);
    });
    const firstOption = container.querySelector('button[role="radio"]');
    expect(firstOption).not.toBeNull();
    await act(async () => {
      firstOption!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const axe = (await import("axe-core")).default;
    const results = await axe.run(document.body, { resultTypes: ["violations"] });
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });
});
