import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const offlineCache = vi.hoisted(() => ({
  readApiResponse: vi.fn(),
  readMutations: vi.fn(),
  removeMutation: vi.fn(),
  setOfflineCacheMembership: vi.fn(),
  storeApiResponse: vi.fn(),
  storeMutation: vi.fn(),
  updateMutation: vi.fn()
}));

vi.mock("./offlineCache", () => offlineCache);

import { api, ApiRequestError, queuedApi } from "./client";

beforeEach(() => {
  vi.clearAllMocks();
  offlineCache.readApiResponse.mockResolvedValue(undefined);
  offlineCache.readMutations.mockResolvedValue([]);
  offlineCache.removeMutation.mockResolvedValue(undefined);
  offlineCache.storeApiResponse.mockResolvedValue(undefined);
  offlineCache.storeMutation.mockResolvedValue(undefined);
  offlineCache.updateMutation.mockResolvedValue(undefined);
});

afterEach(() => vi.restoreAllMocks());

describe("API client", () => {
  it("uses credentialed requests and returns envelopes", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { ok: true }, freshness: { state: "fresh", observedAt: "now" }, warnings: [], requestId: "r" }), { status: 200 }));
    const result = await api<{ ok: boolean }>("/api/v1/health");
    expect(result.data.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/health", expect.objectContaining({ credentials: "include" }));
    expect(offlineCache.storeApiResponse).toHaveBeenCalledWith("/api/v1/health", expect.objectContaining({ data: { ok: true } }));
  });

  it("turns API error envelopes into typed errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ code: "nope", message: "Denied", requestId: "r" }), { status: 403 }));
    await expect(api("/api/v1/private")).rejects.toMatchObject({ status: 403, code: "nope", message: "Denied" } satisfies Partial<ApiRequestError>);
  });

  it("turns Cloudflare 1102 pages into a retryable service error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("error code: 1102 Worker exceeded resource limits", { status: 500 }));
    await expect(api("/api/v1/session")).rejects.toMatchObject({ status: 500, code: "worker_resource_limit", message: "Guardian services are temporarily over capacity." });
  });

  it("returns a timestamped saved response when a live read is temporarily unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    offlineCache.readApiResponse.mockResolvedValue({
      savedAt: "2026-07-21T20:00:00.000Z",
      envelope: { data: { quests: ["saved"] }, freshness: { state: "fresh", observedAt: "2026-07-21T19:59:00.000Z" }, warnings: [], requestId: "saved-request" }
    });

    const result = await api<{ quests: string[] }>("/api/v1/me/quests?characterId=c1");

    expect(result.data.quests).toEqual(["saved"]);
    expect(["stale", "offline"]).toContain(result.freshness.state);
    expect(result.warnings.join(" ")).toContain("Showing saved Guardian data");
  });

  it("does not expose saved private data after an explicit authorization failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ code: "not_authenticated", message: "Sign in again" }), { status: 401 }));
    offlineCache.readApiResponse.mockResolvedValue({ savedAt: "2026-07-21T20:00:00.000Z", envelope: { data: { private: true }, freshness: { state: "fresh", observedAt: "now" }, warnings: [], requestId: "saved" } });

    await expect(api("/api/v1/me/collection?characterId=c1")).rejects.toMatchObject({ status: 401 });
    expect(offlineCache.readApiResponse).not.toHaveBeenCalled();
  });

  it("removes a persisted safe mutation after the server accepts it", async () => {
    const persisted = { id: "mutation-1", scope: "guardian:1", path: "/api/v1/me/preferences", method: "PUT", body: "{}", savedAt: "now", expiresAt: "later", attempts: 0 };
    offlineCache.storeMutation.mockResolvedValue(persisted);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { values: {} }, freshness: { state: "fresh", observedAt: "now" }, warnings: [], requestId: "r" }), { status: 200 }));

    await queuedApi("/api/v1/me/preferences", { method: "PUT", body: "{}" }, { persist: true });

    expect(offlineCache.storeMutation).toHaveBeenCalled();
    expect(offlineCache.removeMutation).toHaveBeenCalledWith("mutation-1");
  });

  it("coalesces identical simultaneous reads", async () => {
    let release!: (response: Response) => void;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise<Response>((resolve) => { release = resolve; }));
    const first = api<{ ok: boolean }>("/api/v1/coalesced");
    const second = api<{ ok: boolean }>("/api/v1/coalesced");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    release(new Response(JSON.stringify({ data: { ok: true }, freshness: { state: "fresh", observedAt: "now" }, warnings: [], requestId: "r" }), { status: 200 }));
    await expect(Promise.all([first, second])).resolves.toEqual([expect.objectContaining({ data: { ok: true } }), expect.objectContaining({ data: { ok: true } })]);
  });
});
