import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { NODES, NODE_BY_ID, CLUSTERS } from "@/data/nodes";
import { allFullNodes } from "./testContent";

// Fresh module per test so the module-level cache doesn't leak between cases.
async function freshBodies() {
  vi.resetModules();
  return await import("./bodies");
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("bundled index", () => {
  it("carries no body fields — the whole point of the split", () => {
    for (const n of NODES) {
      const keys = Object.keys(n);
      expect(keys).not.toContain("layer1");
      expect(keys).not.toContain("layer2");
      expect(keys).not.toContain("quiz");
      expect(keys).not.toContain("furtherReading");
    }
  });

  it("matches content/ (the source of truth) node for node", () => {
    const full = allFullNodes();
    expect(NODES.map((n) => n.id)).toEqual(full.map((n) => n.id));
    for (const n of full) {
      const idx = NODE_BY_ID[n.id];
      expect(idx.title).toBe(n.title);
      expect(idx.thesis).toBe(n.thesis);
      expect(idx.related).toEqual(n.related);
      expect(idx.tags).toEqual(n.tags);
    }
  });
});

describe("generated body files", () => {
  it("exist for every cluster and cover every node with a valid quiz", () => {
    const dir = path.join(process.cwd(), "public/content/bodies");
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
    for (const c of CLUSTERS) {
      expect(manifest[c.id], `manifest entry for ${c.id}`).toMatch(/^[0-9a-f]{12}$/);
      const bodies = JSON.parse(fs.readFileSync(path.join(dir, `${c.id}.json`), "utf8"));
      for (const n of NODES.filter((n) => n.clusterId === c.id)) {
        const b = bodies[n.id];
        expect(b, `body for ${n.id}`).toBeTruthy();
        expect(b.quiz.options.length).toBeGreaterThanOrEqual(3);
        expect(b.quiz.correctIndex).toBeLessThan(b.quiz.options.length);
        expect(Array.isArray(b.furtherReading)).toBe(true);
      }
    }
  });

  it("stay small enough to fetch on a tap (≤ 25 KB gzipped each)", async () => {
    const { gzipSync } = await import("node:zlib");
    const dir = path.join(process.cwd(), "public/content/bodies");
    for (const c of CLUSTERS) {
      const gz = gzipSync(fs.readFileSync(path.join(dir, `${c.id}.json`))).length;
      expect(gz, `${c.id}.json gzipped`).toBeLessThan(25 * 1024);
    }
  });
});

describe("loadClusterBodies", () => {
  it("fetches a cluster once and serves later lookups from memory", async () => {
    const { loadClusterBodies, getBody } = await freshBodies();
    fetchMock.mockResolvedValue(
      jsonResponse({ A1: { quiz: { question: "q", options: ["a", "b", "c"], correctIndex: 0 } } }),
    );
    const a = NODE_BY_ID.A1;
    expect(getBody(a)).toBeUndefined();

    const [x, y] = await Promise.all([loadClusterBodies("A"), loadClusterBodies("A")]);
    expect(x).toBe(y);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/content/bodies/A.json");

    await loadClusterBodies("A");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getBody(a)?.quiz.question).toBe("q");
  });

  it("does not cache a failure, so a retry after coming back online works", async () => {
    const { loadClusterBodies } = await freshBodies();
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(loadClusterBodies("B")).rejects.toThrow("Failed to fetch");

    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    await expect(loadClusterBodies("B")).resolves.toEqual({});
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("treats a non-2xx as an error rather than caching an HTML 404 page", async () => {
    const { loadClusterBodies } = await freshBodies();
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "nope" }, 404));
    await expect(loadClusterBodies("ZZ")).rejects.toThrow("HTTP 404");
  });
});
