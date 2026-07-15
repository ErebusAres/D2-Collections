import { afterEach, describe, expect, it, vi } from "vitest";
import { bungieGet, destinyDisplayName } from "../src/bungie";
import type { Env } from "../src/types";

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
