import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiRequestError } from "./client";

afterEach(() => vi.restoreAllMocks());

describe("API client", () => {
  it("uses credentialed requests and returns envelopes", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { ok: true }, freshness: { state: "fresh", observedAt: "now" }, warnings: [], requestId: "r" }), { status: 200 }));
    const result = await api<{ ok: boolean }>("/api/v1/health");
    expect(result.data.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/health", expect.objectContaining({ credentials: "include" }));
  });

  it("turns API error envelopes into typed errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ code: "nope", message: "Denied", requestId: "r" }), { status: 403 }));
    await expect(api("/api/v1/private")).rejects.toMatchObject({ status: 403, code: "nope", message: "Denied" } satisfies Partial<ApiRequestError>);
  });
});
