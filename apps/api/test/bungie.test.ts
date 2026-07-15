import { afterEach, describe, expect, it, vi } from "vitest";
import { bungieGet, destinyDisplayName, loadQuestManifest, seasonPassProgress, socialRosterFor, xurInventoryFor } from "../src/bungie";
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

describe("seasonPassProgress", () => {
  it("uses the normal reward track for XP until that track reaches its cap", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ErrorCode: 1, Response: { rewardProgressionHash: 11, prestigeProgressionHash: 22 } }), { status: 200, headers: { "Content-Type": "application/json" } })));
    const profile = { profile: { data: { currentSeasonPassHash: 99 } }, characterProgressions: { data: { c1: { progressions: {
      11: { level: 33, levelCap: 100, currentProgress: 3_362_500, progressToNextLevel: 62_500, nextLevelAt: 100_000 },
      22: { level: 0, progressToNextLevel: 0, nextLevelAt: 100_000 }
    } } } } };

    await expect(seasonPassProgress(profile, "access", { BUNGIE_API_KEY: "test" } as Env, "c1")).resolves.toMatchObject({
      rank: 33,
      progress: {
        state: "available",
        activeProgressionHash: "11",
        currentProgress: 3_362_500,
        progressToNextLevel: 62_500,
        nextLevelAt: 100_000,
        percent: 63
      }
    });
  });

  it("combines reward and prestige ranks while reporting current XP progress", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ErrorCode: 1, Response: { rewardProgressionHash: 11, prestigeProgressionHash: 22 } }), { status: 200, headers: { "Content-Type": "application/json" } })));
    const profile = { profile: { data: { currentSeasonPassHash: 99 } }, characterProgressions: { data: { c1: { progressions: { 11: { level: 100, progressToNextLevel: 0, nextLevelAt: 0 }, 22: { level: 5, progressToNextLevel: 250, nextLevelAt: 1000 } } } } } };

    await expect(seasonPassProgress(profile, "access", { BUNGIE_API_KEY: "test" } as Env, "c1")).resolves.toEqual({
      rank: 105,
      progress: {
        state: "available",
        source: "bungie-profile-character-progressions",
        passHash: "99",
        rewardProgressionHash: "11",
        prestigeProgressionHash: "22",
        activeProgressionHash: "22",
        currentProgress: 0,
        progressToNextLevel: 250,
        nextLevelAt: 1000,
        percent: 25
      }
    });
  });

  it("reports why XP is unavailable when component 202 is missing", async () => {
    const profile = { profile: { data: { currentSeasonPassHash: 99 } } };

    await expect(seasonPassProgress(profile, "access", { BUNGIE_API_KEY: "test" } as Env, "c1")).resolves.toMatchObject({
      rank: 0,
      progress: {
        state: "unavailable",
        source: "bungie-profile-character-progressions",
        passHash: "99",
        reason: expect.stringContaining("characterProgressions")
      }
    });
  });
});

describe("socialRosterFor", () => {
  it("merges Bungie friends and clan presence without duplicating a Guardian", async () => {
    const responses = [
      { friends: [{ lastSeenAsMembershipId: "friend-1", lastSeenAsBungieMembershipType: 3, bungieGlobalDisplayName: "Friend", bungieGlobalDisplayNameCode: 7, onlineStatus: 1, onlineTitle: 2 }] },
      { results: [{ group: { groupId: "clan-1", name: "Test Clan" } }] },
      { results: [{ isOnline: true, destinyUserInfo: { membershipId: "friend-1", membershipType: 3, bungieGlobalDisplayName: "Friend", bungieGlobalDisplayNameCode: 7 } }, { isOnline: false, destinyUserInfo: { membershipId: "clan-2", membershipType: 3, bungieGlobalDisplayName: "Clanmate", bungieGlobalDisplayNameCode: 8 } }] }
    ];
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ ErrorCode: 1, Response: responses.shift() }), { status: 200, headers: { "Content-Type": "application/json" } }))));
    const row = { membership_type: 3, membership_id: "social-test-member" } as SessionRow;

    const result = await socialRosterFor(row, "access", { BUNGIE_API_KEY: "test" } as Env);

    expect(result.state).toBe("available");
    expect(result.contacts).toMatchObject([
      { membershipId: "friend-1", displayName: "Friend#0007", source: "friend-and-clan", clanName: "Test Clan", onlineState: "online", inDestiny2: true },
      { membershipId: "clan-2", displayName: "Clanmate#0008", source: "clan", onlineState: "offline" }
    ]);
  });
});

describe("manifest overlays", () => {
  it("keeps social features and pursuit definitions outside the core manifest payload", async () => {
    const values = [
      { version: "overlay-test", generatedAt: "now", items: [], itemDefinitions: { base: {} }, objectiveDefinitions: {}, activityDefinitions: {}, recordDefinitions: {} },
      { version: "overlay-test", collectionFeatureDefinitions: { weapon: [{ itemHash: "feature", name: "Weapon mode", description: "Mode", icon: "/mode.png" }] } },
      { version: "overlay-test", itemDefinitions: { bounty: { itemTypeDisplayName: "Bounty" } }, objectiveDefinitions: { objective: { completionValue: 10 } } }
    ];
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(values.shift()), { status: 200, headers: { "Content-Type": "application/json" } }))));

    const result = await loadQuestManifest({ GAME_DATA_URL: "https://example.test/data/manifest.json" } as Env);

    expect(result.itemDefinitions).toMatchObject({ base: {}, bounty: { itemTypeDisplayName: "Bounty" } });
    expect(result.collectionFeatureDefinitions?.weapon?.[0]?.name).toBe("Weapon mode");
  });
});
