// @vitest-environment jsdom
/**
 * Automated accessibility gate for core interactive components (TECH_DEBT §1).
 * Renders components to DOM in jsdom and runs axe-core against initial
 * and interactive states (e.g. disclosures, dialogs).
 * Fails on serious/critical violations.
 */
import { describe, it, expect } from "vitest";
import "fake-indexeddb/auto";
import { renderToString } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { LayerReveal } from "./LayerReveal";
import { RecallReveal } from "./RecallReveal";
import { FirstTimeHint } from "./FirstTimeHint";
import { InstallAppButton } from "./InstallAppButton";
import { AudioBar } from "./AudioBar";
import { SearchBar } from "./SearchBar";
import type { NodeIndex } from "@/data/nodes";
import axe from "axe-core";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const sampleNode: NodeIndex = {
  id: "TEST1",
  clusterId: "T",
  title: "Test Idea",
  author: "Test Author",
  year: 2020,
  medium: "Essay",
  category: "Tests",
  thesis: "A test thesis used to exercise accessibility.",
  related: [],
  tags: ["Tests"],
  layer0: "Layer zero summary.",
};

async function runAxe(html: string) {
  document.body.innerHTML = `<main>${html}</main>`;
  return axe.run(document.body, { resultTypes: ["violations"] });
}

describe("Component accessibility audits (axe-core)", () => {
  it("LayerReveal (collapsed) has no serious or critical violations", async () => {
    const html = renderToString(
      <LayerReveal label="Core Mechanism">
        <p>This is the detailed explanation inside the revealed layer.</p>
      </LayerReveal>,
    );
    const results = await runAxe(html);
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });

  it("LayerReveal (revealed) has no serious or critical violations", async () => {
    const container = document.createElement("div");
    document.body.innerHTML = "";
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <LayerReveal label="Core Mechanism" revealSignal={1}>
          <p>Revealed layer content</p>
        </LayerReveal>,
      );
    });
    const results = await axe.run(document.body, { resultTypes: ["violations"] });
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });

  it("RecallReveal (hidden & revealed) has no serious or critical violations", async () => {
    const container = document.createElement("div");
    document.body.innerHTML = "";
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<RecallReveal text="Key takeaway to recall before checking the rest." />);
    });
    let results = await axe.run(document.body, { resultTypes: ["violations"] });
    let blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);

    // Click to reveal takeaway
    const btn = container.querySelector("button");
    expect(btn).not.toBeNull();
    await act(async () => {
      btn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    results = await axe.run(document.body, { resultTypes: ["violations"] });
    blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(blocking).toEqual([]);
  });

  it("FirstTimeHint has no serious or critical violations", async () => {
    const html = renderToString(
      <FirstTimeHint id="test-hint">
        This is a contextual first-time explanation of a mechanic.
      </FirstTimeHint>,
    );
    const results = await runAxe(html);
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });

  it("InstallAppButton has no serious or critical violations", async () => {
    const html = renderToString(<InstallAppButton />);
    const results = await runAxe(html);
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });

  it("AudioBar has no serious or critical violations", async () => {
    const html = renderToString(<AudioBar node={sampleNode} sentenceCount={5} />);
    const results = await runAxe(html);
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });

  it("SearchBar has no serious or critical violations", async () => {
    const html = renderToString(<SearchBar />);
    const results = await runAxe(html);
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });
});
