import { describe, it, expect } from "vitest";
import { safeHttpUrl, safeArchiveId } from "./url";
import { absoluteUrl, resolveSiteUrl, SITE_URL, PLACEHOLDER_ORIGIN } from "./site";

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

describe("resolveSiteUrl", () => {
  it("prefers the build-time define over every env source", () => {
    // vite.config.ts bakes the origin in at build time; nothing at runtime
    // should be able to override what the bundle was built with.
    expect(
      resolveSiteUrl("https://baked.test", {
        SITE_URL: "https://env.test",
        VERCEL_PROJECT_PRODUCTION_URL: "prod.vercel.app",
        VERCEL_URL: "preview.vercel.app",
      }),
    ).toBe("https://baked.test");
  });

  it("reads SITE_URL from the environment and strips a trailing slash", () => {
    expect(resolveSiteUrl(undefined, { SITE_URL: "https://commonplace.example/" })).toBe(
      "https://commonplace.example",
    );
    expect(resolveSiteUrl(undefined, { SITE_URL: "https://commonplace.example" })).toBe(
      "https://commonplace.example",
    );
  });

  it("prefers the Vercel production domain over the per-deployment host", () => {
    // Vercel sets both on preview builds. Canonical/og:url/sitemap must name
    // the production domain, or every preview deploy publishes ~894
    // near-duplicate URLs and leaves crawlers to guess which is canonical.
    expect(
      resolveSiteUrl(undefined, {
        VERCEL_PROJECT_PRODUCTION_URL: "commonplace.vercel.app",
        VERCEL_URL: "commonplace-git-topic-team.vercel.app",
      }),
    ).toBe("https://commonplace.vercel.app");
  });

  it("falls back to VERCEL_URL, then to the placeholder origin", () => {
    expect(resolveSiteUrl(undefined, { VERCEL_URL: "commonplace-abc123.vercel.app/" })).toBe(
      "https://commonplace-abc123.vercel.app",
    );
    expect(resolveSiteUrl(undefined, {})).toBe(PLACEHOLDER_ORIGIN);
    expect(resolveSiteUrl(undefined, { SITE_URL: "", VERCEL_URL: "" })).toBe(PLACEHOLDER_ORIGIN);
  });
});

describe("absoluteUrl", () => {
  it("joins the site origin and strips query strings", () => {
    expect(absoluteUrl("/")).toBe(`${SITE_URL}/`);
    expect(absoluteUrl("/node/A1")).toBe(`${SITE_URL}/node/A1`);
    expect(absoluteUrl("/explore?cluster=A")).toBe(`${SITE_URL}/explore`);
  });
});
