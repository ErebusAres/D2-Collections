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

import { api, ApiRequestError, describeApiError, queuedApi, savedReadFailureIsCurrent } from "./client";
import { connectionFailureReport } from "./incidentReport";

beforeEach(() => {
  vi.clearAllMocks();
  offlineCache.readApiResponse.mockResolvedValue(undefined);
  offlineCache.readMutations.mockResolvedValue([]);
  offlineCache.removeMutation.mockResolvedValue(undefined);
  offlineCache.storeApiResponse.mockResolvedValue(undefined);
  offlineCache.storeMutation.mockResolvedValue(undefined);
  offlineCache.updateMutation.mockResolvedValue(undefined);
});

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("API client", () => {
  it("expires abandoned saved-data warning entries after two minutes", () => {
    const failedAt = Date.parse("2026-08-10T12:00:00.000Z");
    expect(savedReadFailureIsCurrent(failedAt, failedAt + 120_000)).toBe(true);
    expect(savedReadFailureIsCurrent(failedAt, failedAt + 120_001)).toBe(false);
  });

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

  it("formats a searchable error code and backend request reference for the UI", () => {
    const error = new ApiRequestError(503, { code: "server_error", message: "Guardian services failed.", requestId: "request-123" });
    expect(describeApiError(error)).toBe("Guardian services failed. Error code: server_error · Reference: request-123");
  });

  it("builds a copyable incident report with the narrowing details", () => {
    const report = connectionFailureReport({ code: "worker_resource_limit", message: "Over capacity", route: "/api/v2/fireteam", occurredAt: "2026-08-18T14:00:00.000Z", status: 500, requestId: "ray-123", retryAfterSeconds: 60, diagnostics: { failureSource: "cloudflare-runtime", method: "GET", durationMs: 123, cfRay: "ray-123-ORD" }, recentRequests: [{ route: "/api/v1/me/gear", method: "GET", status: 200, durationMs: 80, occurredAt: "2026-08-18T13:59:59.000Z" }] });
    expect(report).toContain("Error code: worker_resource_limit\nHTTP status: 500\nReference: ray-123\nRetry after: 60s");
    expect(report).toContain("Failure source: cloudflare-runtime\nMethod: GET\nDuration: 123ms\nCloudflare Ray: ray-123-ORD");
    expect(report).toContain("Recent API requests:\n- 2026-08-18T13:59:59.000Z GET /api/v1/me/gear -> 200 (80ms)");
  });

  it("assigns client-side references to network failures", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(api("/api/v1/network-failure")).rejects.toMatchObject({ status: 0, code: "network_error", requestId: expect.stringMatching(/^client-/) });
  });

  it("turns Cloudflare 1102 pages into a retryable service error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("error code: 1102 Worker exceeded resource limits", { status: 500, headers: { "cf-ray": "runtime-ray-ORD", "content-type": "text/html", server: "cloudflare" } }));
    await expect(api("/api/v1/session")).rejects.toMatchObject({ status: 500, code: "worker_resource_limit", message: "Guardian services are temporarily over capacity.", diagnostics: { failureSource: "cloudflare-runtime", method: "GET", responseBodyKind: "cloudflare-1102", cfRay: "runtime-ray-ORD" } });
  });

  it("never resurrects an older Fireteam snapshot when its D1 read fails", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { snapshotVersion: 7, members: [{ membershipId: "1", isSelf: true }] },
        freshness: { state: "fresh", observedAt: "2026-08-20T16:00:00.000Z" },
        warnings: [],
        requestId: "live-fireteam"
      }), { status: 200 }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await api("/api/v2/fireteam?characterId=no-resurrection");
    await expect(api("/api/v2/fireteam?characterId=no-resurrection")).rejects.toThrow("Failed to fetch");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(offlineCache.readApiResponse).not.toHaveBeenCalled();
  });

  it("retains a Fireteam 1102 Ray ID and opens a per-route circuit breaker", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("error code: 1102 Worker exceeded resource limits", { status: 500, headers: { "cf-ray": "abc123-ORD" } }));
    await expect(api("/api/v2/fireteam?characterId=c1")).rejects.toMatchObject({ code: "worker_resource_limit", message: "Fireteam snapshot delayed—showing the last committed version.", requestId: "abc123" });
    await expect(api("/api/v2/fireteam?characterId=c2")).rejects.toMatchObject({ code: "worker_resource_limit" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    offlineCache.readApiResponse.mockResolvedValue({
      savedAt: new Date(Date.now() - 3 * 60_000).toISOString(),
      envelope: { data: { members: [{ membershipId: "2", isSelf: false }], trackedItems: ["stale"] }, freshness: { state: "fresh", observedAt: "now" }, warnings: [], requestId: "saved" }
    });
    await expect(api<any>("/api/v2/fireteam?characterId=c3")).rejects.toMatchObject({ code: "worker_resource_limit" });
    expect(offlineCache.readApiResponse).not.toHaveBeenCalled();
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

  it("keeps the newest in-memory response when a later read temporarily fails", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { members: ["current"] }, freshness: { state: "fresh", observedAt: "2026-08-10T16:00:00.000Z" }, warnings: [], requestId: "live" }), { status: 200 }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    offlineCache.readApiResponse.mockResolvedValue({
      savedAt: "2026-08-10T15:00:00.000Z",
      envelope: { data: { members: ["old-disk"] }, freshness: { state: "fresh", observedAt: "2026-08-10T15:00:00.000Z" }, warnings: [], requestId: "disk" }
    });

    await expect(api<{ members: string[] }>("/api/v1/me/memory-race")).resolves.toMatchObject({ data: { members: ["current"] } });
    const fallback = await api<{ members: string[] }>("/api/v1/me/memory-race");
    expect(fallback.data.members).toEqual(["current"]);
    expect(["stale", "offline"]).toContain(fallback.freshness.state);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(offlineCache.readApiResponse).not.toHaveBeenCalled();
  });

  it("rejects a successful response older than the last accepted snapshot", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { value: "new" }, freshness: { state: "fresh", observedAt: "2026-08-10T16:00:00.000Z" }, warnings: [], requestId: "new" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { value: "old" }, freshness: { state: "fresh", observedAt: "2026-08-10T15:00:00.000Z" }, warnings: [], requestId: "old" }), { status: 200 }));

    await expect(api<{ value: string }>("/api/v1/me/out-of-order")).resolves.toMatchObject({ data: { value: "new" } });
    await expect(api<{ value: string }>("/api/v1/me/out-of-order")).resolves.toMatchObject({ data: { value: "new" }, requestId: "new" });
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

  it("reuses a recent persisted activity feed after a document reload", async () => {
    const saved = {
      savedAt: new Date(Date.now() - 10_000).toISOString(),
      envelope: { data: { events: ["saved"] }, freshness: { state: "fresh", observedAt: "now" }, warnings: [], requestId: "saved-feed" }
    };
    offlineCache.readApiResponse.mockResolvedValue(saved);
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(api<{ events: string[] }>("/api/v2/fireteam/activity")).resolves.toEqual(saved.envelope);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes the activity feed after its persisted cooldown expires", async () => {
    offlineCache.readApiResponse.mockResolvedValue({
      savedAt: new Date(Date.now() - 60_001).toISOString(),
      envelope: { data: { events: ["old"] }, freshness: { state: "fresh", observedAt: "old" }, warnings: [], requestId: "old-feed" }
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { events: ["new"] }, freshness: { state: "fresh", observedAt: "new" }, warnings: [], requestId: "new-feed" }), { status: 200 }));

    await expect(api<{ events: string[] }>("/api/v2/fireteam/activity?test=expired")).resolves.toMatchObject({ data: { events: ["new"] } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reuses Journey progress across reloads for its five-minute refresh window", async () => {
    const saved = {
      savedAt: new Date(Date.now() - 4 * 60_000).toISOString(),
      envelope: { data: { triumphs: ["saved"] }, freshness: { state: "fresh", observedAt: "now" }, warnings: [], requestId: "saved-journey" }
    };
    offlineCache.readApiResponse.mockResolvedValue(saved);
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(api<{ triumphs: string[] }>("/api/v1/me/journey?characterId=c1")).resolves.toEqual(saved.envelope);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes Journey progress once its five-minute window expires", async () => {
    offlineCache.readApiResponse.mockResolvedValue({
      savedAt: new Date(Date.now() - 5 * 60_000 - 1).toISOString(),
      envelope: { data: { triumphs: ["old"] }, freshness: { state: "fresh", observedAt: "old" }, warnings: [], requestId: "old-journey" }
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { triumphs: ["new"] }, freshness: { state: "fresh", observedAt: "new" }, warnings: [], requestId: "new-journey" }), { status: 200 }));

    await expect(api<{ triumphs: string[] }>("/api/v1/me/journey?characterId=c2")).resolves.toMatchObject({ data: { triumphs: ["new"] } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps a failed Journey attempt from being retried by immediate reloads", async () => {
    vi.useFakeTimers();
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => values.set(key, value)
    });
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { triumphs: ["new"] }, freshness: { state: "fresh", observedAt: "new" }, warnings: [], requestId: "journey-after-wait" }), { status: 200 }));

    await expect(api("/api/v1/me/journey?characterId=reload-guard")).rejects.toMatchObject({ code: "network_error" });
    const retry = api<{ triumphs: string[] }>("/api/v1/me/journey?characterId=reload-guard");
    await vi.advanceTimersByTimeAsync(4 * 60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    await expect(retry).resolves.toMatchObject({ data: { triumphs: ["new"] } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
