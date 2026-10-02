import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWithCacheFallback, matchCached } from "./offline";

const fetchMock = vi.fn<typeof fetch>();
const matchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  matchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("caches", { match: matchMock });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const text = (body: string, status = 200) => new Response(body, { status });

describe("matchCached", () => {
  it("returns a successful cached copy, matching across Vary", async () => {
    matchMock.mockResolvedValue(text("saved"));
    const res = await matchCached("/content/sources/A1-0.md");
    expect(await res?.text()).toBe("saved");
    expect(matchMock).toHaveBeenCalledWith("/content/sources/A1-0.md", { ignoreVary: true });
  });

  it("ignores cached error responses (older workers stored 404/503s)", async () => {
    matchMock.mockResolvedValue(text("", 503));
    expect(await matchCached("/x")).toBeUndefined();
  });

  it("is a no-op where Cache Storage doesn't exist", async () => {
    vi.stubGlobal("caches", undefined);
    expect(await matchCached("/x")).toBeUndefined();
  });
});

describe("fetchWithCacheFallback", () => {
  it("uses the network when it answers", async () => {
    fetchMock.mockResolvedValue(text("fresh"));
    const res = await fetchWithCacheFallback("/x");
    expect(await res.text()).toBe("fresh");
    expect(matchMock).not.toHaveBeenCalled();
  });

  it("serves the downloaded copy when offline and no service worker answered", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    matchMock.mockResolvedValue(text("saved"));
    const res = await fetchWithCacheFallback("/content/sources/A1-0.md");
    expect(await res.text()).toBe("saved");
  });

  it("serves the cached copy when the network returns an error status", async () => {
    fetchMock.mockResolvedValue(text("", 503));
    matchMock.mockResolvedValue(text("saved"));
    expect(await (await fetchWithCacheFallback("/x")).text()).toBe("saved");
  });

  it("still surfaces the failure when nothing is cached", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    matchMock.mockResolvedValue(undefined);
    await expect(fetchWithCacheFallback("/x")).rejects.toThrow("Failed to fetch");

    fetchMock.mockResolvedValue(text("", 404));
    expect((await fetchWithCacheFallback("/x")).status).toBe(404);
  });
});
