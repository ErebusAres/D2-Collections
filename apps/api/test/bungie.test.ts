import { afterEach, describe, expect, it, vi } from "vitest";
import { bungieGet, destinyDisplayName, xurInventoryFor } from "../src/bungie";
import type { Env, SessionRow } from "../src/types";

afterEach(() => vi.unstubAllGlobals());

describe("destinyDisplayName", () => {
  it("formats Bungie's public global display name and discriminator", () => {
    expect(destinyDisplayName({ bungieGlobalDisplayName: "Guardian", bungieGlobalDisplayNameCode: 42 })).toBe("Guardian#0042");
    expect(destinyDisplayName({ displayName: "PlatformGuardian" })).toBe("PlatformGuardian");
  });
});

describe("bungieGet", () => {
  it("turns Bungie application errors returned over HTTP 200 into gateway errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ErrorCode: 5,
      Message: "System disabled"
    }), { status: 200, headers: { "Content-Type": "application/json" } })));

    await expect(bungieGet("/Destiny2/3/Profile/1/", { BUNGIE_API_KEY: "test" } as Env))
      .rejects.toMatchObject({ status: 502, code: "bungie_request_failed", message: "System disabled" });
  });

  it("turns application-level throttle responses into retryable errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ErrorCode: 36,
      Message: "Throttle limit exceeded",
      ThrottleSeconds: 7
    }), { status: 200, headers: { "Content-Type": "application/json" } })));

    await expect(bungieGet("/Destiny2/3/Profile/1/", { BUNGIE_API_KEY: "test" } as Env))
      .rejects.toMatchObject({ status: 429, code: "bungie_throttled", retryAfterSeconds: 7 });
  });
});

describe("xurInventoryFor", () => {
  it("reads Xûr's enabled live sales from the character vendor endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ErrorCode: 1,
      Response: {
        vendor: { data: { enabled: true, nextRefreshDate: "2026-07-17T17:00:00Z" } },
        sales: { data: { 0: { itemHash: 111 }, 1: { itemHash: 222 }, 2: { itemHash: 111 } } }
      }
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const row = { membership_type: 3, membership_id: "member" } as SessionRow;

    const result = await xurInventoryFor(row, "character-xur-test", { BUNGIE_API_KEY: "test" } as Env, "access");

    expect(result).toMatchObject({ state: "available", itemHashes: ["111", "222"], nextRefreshAt: "2026-07-17T17:00:00Z" });
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/Vendors/2190858386/?components=400,402");
  });
});
