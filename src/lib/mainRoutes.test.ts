import { describe, it, expect } from "vitest";
import {
  MAIN_TABS,
  MAIN_TAB_PATHS,
  SECONDARY_PATHS,
  routeDepth,
  transitionType,
} from "./mainRoutes";

// The bar is a product decision recorded in docs/PRODUCT-BRIEF.md §5. This
// test exists so a change to it is a deliberate, reviewed edit of both.
describe("primary navigation contract", () => {
  it("is exactly Feed · Explore · Review · You, in that order", () => {
    expect(MAIN_TABS.map((t) => t.label)).toEqual(["Feed", "Explore", "Review", "You"]);
    expect(MAIN_TAB_PATHS).toEqual(["/", "/explore", "/review", "/you"]);
  });

  it("puts the due badge on Review and nowhere else", () => {
    const badged = MAIN_TABS.filter((t) => "badge" in t && t.badge === "due").map((t) => t.label);
    expect(badged).toEqual(["Review"]);
  });

  it("routes every path to exactly one tab (or none), never two", () => {
    const paths = [
      "/",
      "/node/A1",
      "/explore",
      "/explore?cluster=A",
      "/skim",
      "/map",
      "/review",
      "/you",
      "/onboarding",
      "/read/A1-0",
    ];
    for (const p of paths) {
      const hits = MAIN_TABS.filter((t) => t.match(p)).map((t) => t.label);
      expect(hits.length, `${p} matched ${hits.join(",")}`).toBeLessThanOrEqual(1);
    }
    expect(MAIN_TABS.find((t) => t.match("/skim"))?.label).toBe("Explore");
    expect(MAIN_TABS.find((t) => t.match("/node/J5"))?.label).toBe("Feed");
    expect(MAIN_TABS.find((t) => t.match("/onboarding"))).toBeUndefined();
  });

  it("keeps Skim warm for offline as a secondary destination", () => {
    expect(SECONDARY_PATHS).toContain("/skim");
  });
});

describe("route transitions", () => {
  it("tabs are depth 0, secondary screens 1, ideas 2", () => {
    expect(routeDepth("/")).toBe(0);
    expect(routeDepth("/explore")).toBe(0);
    expect(routeDepth("/review")).toBe(0);
    expect(routeDepth("/you")).toBe(0);
    expect(routeDepth("/skim")).toBe(1);
    expect(routeDepth("/onboarding")).toBe(1);
    expect(routeDepth("/node/A1")).toBe(2);
    expect(routeDepth("/read/A1-0")).toBe(2);
  });

  it("types a navigation by the change in depth", () => {
    expect(transitionType("/", "/node/A1")).toBe("deeper");
    expect(transitionType("/node/A1", "/")).toBe("shallower");
    expect(transitionType("/", "/explore")).toBe("lateral");
    expect(transitionType("/explore", "/skim")).toBe("deeper");
    expect(transitionType(undefined, "/node/A1")).toBe("lateral");
  });
});
