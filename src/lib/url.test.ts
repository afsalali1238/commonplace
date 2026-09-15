import { describe, it, expect } from "vitest";
import { safeHttpUrl, safeArchiveId } from "./url";
import { absoluteUrl, SITE_URL } from "./site";

describe("safeHttpUrl", () => {
  it("accepts http and https", () => {
    expect(safeHttpUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(safeHttpUrl("http://example.com")).toBe("http://example.com/");
  });

  it("rejects javascript, data, and relative schemes", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeHttpUrl("data:text/html,hi")).toBeUndefined();
    expect(safeHttpUrl("/relative")).toBeUndefined();
    expect(safeHttpUrl("")).toBeUndefined();
    expect(safeHttpUrl(undefined)).toBeUndefined();
  });
});

describe("safeArchiveId", () => {
  it("accepts real archive slugs", () => {
    expect(safeArchiveId("A1-0")).toBe("A1-0");
    expect(safeArchiveId("AA1-entropy-0")).toBe("AA1-entropy-0");
  });

  it("rejects path traversal and empty values", () => {
    expect(safeArchiveId("../etc/passwd")).toBeUndefined();
    expect(safeArchiveId("A1/../B1")).toBeUndefined();
    expect(safeArchiveId("")).toBeUndefined();
    expect(safeArchiveId("A1-0.md")).toBeUndefined();
  });
});

describe("absoluteUrl", () => {
  it("joins the site origin and strips query strings", () => {
    expect(absoluteUrl("/")).toBe(`${SITE_URL}/`);
    expect(absoluteUrl("/node/A1")).toBe(`${SITE_URL}/node/A1`);
    expect(absoluteUrl("/explore?cluster=A")).toBe(`${SITE_URL}/explore`);
  });
});
