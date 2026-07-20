import { afterEach, describe, expect, it, vi } from "vitest";
import { bungieGet, destinyDisplayName, loadCompanionManifest, loadQuestManifest, mergeXurInventories, seasonPassProgress, socialRosterFor, xurCategoryFor, xurInventoriesForCharacters, xurInventoryFor } from "../src/bungie";
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
    const fetchMock = vi.fn().mockImplementation((url: string) => new Response(JSON.stringify({
      ErrorCode: 1,
      Response: {
        vendor: { data: { enabled: true, nextRefreshDate: "2026-07-17T17:00:00Z" } },
        sales: { data: url.includes("3751514131") ? { 10: { itemHash: 222 } } : { 0: { itemHash: 111 } } }
      }
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const row = { membership_type: 3, membership_id: "member" } as SessionRow;

    const result = await xurInventoryFor(row, "character-xur-test", { BUNGIE_API_KEY: "test" } as Env, "access");

    expect(result).toMatchObject({ state: "available", itemHashes: ["111", "222"], nextRefreshAt: "2026-07-17T17:00:00Z" });
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual(expect.arrayContaining([
      expect.stringContaining("/Vendors/2190858386/?components=304,305,400,401,402"),
      expect.stringContaining("/Vendors/3751514131/?components=304,305,400,401,402")
    ]));
  });
});

describe("xurCategoryFor", () => {
  it("separates catalysts and Exotic class items from materials", () => {
    expect(xurCategoryFor({ displayProperties: { name: "Prometheus Catalyst" }, itemTypeDisplayName: "Exotic Catalyst", inventory: { tierTypeName: "Exotic" } })).toBe("exotic-catalyst");
    expect(xurCategoryFor({ displayProperties: { name: "Stoicism" }, itemType: 2, equipmentSlot: "Class Armor", inventory: { tierTypeName: "Exotic" } })).toBe("exotic-class-item");
    expect(xurCategoryFor({ displayProperties: { name: "Kept Confidence" }, itemType: 30, itemTypeDisplayName: "Hand Cannon", inventory: { tierTypeName: "Legendary" } })).toBe("legendary-weapon");
    expect(xurCategoryFor({ displayProperties: { name: "Enhancement Core" }, itemType: 0, itemTypeDisplayName: "Material", inventory: { tierTypeName: "Legendary" } })).toBe("other");
  });

  it("loads class storefronts sequentially to stay within the Worker subrequest budget", async () => {
    let active = 0;
    let maximumActive = 0;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return new Response(JSON.stringify({ ErrorCode: 1, Response: { vendor: { data: { enabled: false } }, sales: { data: {} } } }), { status: 200 });
    }));

    await xurInventoriesForCharacters(
      { membership_type: 3, membership_id: "sequential-member" } as SessionRow,
      ["sequential-one", "sequential-two", "sequential-three"],
      { BUNGIE_API_KEY: "test" } as Env,
      "access"
    );

    expect(maximumActive).toBe(1);
  });
});

describe("mergeXurInventories", () => {
  it("combines class storefronts and removes shared duplicate offers", () => {
    const shared = { saleIndex: "0", itemHash: "100", category: "exotic-weapon", perks: [], stats: [], costs: [] };
    const base = { state: "available" as const, checkedAt: "2026-07-18T17:00:00Z", itemHashes: ["100"] };
    const result = mergeXurInventories([
      { ...base, offers: [shared, { ...shared, saleIndex: "1", itemHash: "200", category: "exotic-armor", className: "Titan" }] },
      { ...base, offers: [shared, { ...shared, saleIndex: "2", itemHash: "300", category: "exotic-armor", className: "Hunter" }] }
    ] as any);

    expect(result.offers).toEqual([
      shared,
      expect.objectContaining({ itemHash: "200", className: "Titan" }),
      expect.objectContaining({ itemHash: "300", className: "Hunter" })
    ]);
  });

  it("retains distinct sale slots of the same item", () => {
    const base = { state: "available" as const, checkedAt: "2026-07-18T17:00:00Z", itemHashes: ["100"] };
    const offer = { saleIndex: "0", itemHash: "100", category: "legendary-weapon", stats: [], costs: [] };
    const result = mergeXurInventories([
      { ...base, offers: [{ ...offer, saleIndex: "3751514131:1", perks: [{ itemHash: "perk-a" }] }] },
      { ...base, offers: [{ ...offer, saleIndex: "3751514131:2", perks: [{ itemHash: "perk-b" }] }] }
    ] as any);

    expect(result.offers).toHaveLength(2);
  });

  it("deduplicates the same sale when character-specific sockets differ", () => {
    const base = { state: "available" as const, checkedAt: "2026-07-18T17:00:00Z", itemHashes: ["100"] };
    const offer = { saleIndex: "2190858386:7", itemHash: "100", category: "exotic-armor", className: "Titan", stats: [], costs: [] };
    const result = mergeXurInventories([
      { ...base, offers: [{ ...offer, perks: [{ itemHash: "visible-on-one" }] }] },
      { ...base, offers: [{ ...offer, perks: [{ itemHash: "visible-on-two" }, { itemHash: "extra" }] }] }
    ] as any);

    expect(result.offers).toEqual([expect.objectContaining({ itemHash: "100", perks: [{ itemHash: "visible-on-two" }, { itemHash: "extra" }] })]);
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
        percent: 62,
        progressionMode: "reward-rank",
        activeLevel: 33
      }
    });
  });

  it("uses Bungie's post-100 reward progression without double-counting prestige", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ErrorCode: 1, Response: { rewardProgressionHash: 11, prestigeProgressionHash: 22 } }), { status: 200, headers: { "Content-Type": "application/json" } })));
    const profile = { profile: { data: { currentSeasonPassHash: 99 } }, characterProgressions: { data: { c1: { progressions: {
      11: { level: 101, currentProgress: 10_839_174, progressToNextLevel: 439_174, nextLevelAt: 500_000 },
      22: { level: 1, currentProgress: 939_259, progressToNextLevel: 439_259, nextLevelAt: 500_000 }
    } } } } };

    await expect(seasonPassProgress(profile, "access", { BUNGIE_API_KEY: "test" } as Env, "c1")).resolves.toEqual({
      rank: 101,
      progress: {
        state: "available",
        source: "bungie-profile-character-progressions",
        passHash: "99",
        rewardProgressionHash: "11",
        prestigeProgressionHash: "22",
        activeProgressionHash: "11",
        currentProgress: 10_839_174,
        progressToNextLevel: 439_174,
        nextLevelAt: 500_000,
        percent: 87,
        progressionMode: "bright-engram",
        activeLevel: 101,
        levelsPerBrightEngram: 5,
        segmentsPerRank: 5
      }
    });
  });

  it("falls back to prestige progression only when the reward progression is capped", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ErrorCode: 1, Response: { rewardProgressionHash: 11, prestigeProgressionHash: 22 } }), { status: 200, headers: { "Content-Type": "application/json" } })));
    const profile = { profile: { data: { currentSeasonPassHash: 99 } }, characterProgressions: { data: { c1: { progressions: { 11: { level: 100, progressToNextLevel: 0, nextLevelAt: 0 }, 22: { level: 2, progressToNextLevel: 100_000, nextLevelAt: 500_000 } } } } } };

    await expect(seasonPassProgress(profile, "access", { BUNGIE_API_KEY: "test" } as Env, "c1")).resolves.toMatchObject({
      rank: 102,
      progress: {
        activeProgressionHash: "22",
        progressToNextLevel: 100_000,
        nextLevelAt: 500_000,
        percent: 20,
        progressionMode: "bright-engram",
        activeLevel: 2,
        segmentsPerRank: 5
      }
    });
  });

  it("uses the highest account-wide season pass progression when the selected character is stale", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ErrorCode: 1, Response: { rewardProgressionHash: 11, prestigeProgressionHash: 22 } }), { status: 200, headers: { "Content-Type": "application/json" } })));
    const profile = { profile: { data: { currentSeasonPassHash: 99 } }, characterProgressions: { data: {
      stale: { progressions: { 11: { level: 100, progressToNextLevel: 0, nextLevelAt: 500_000 }, 22: { level: 0, progressToNextLevel: 0, nextLevelAt: 500_000 } } },
      fresh: { progressions: { 11: { level: 101, progressToNextLevel: 450_000, nextLevelAt: 500_000 }, 22: { level: 1, progressToNextLevel: 450_000, nextLevelAt: 500_000 } } }
    } } };

    await expect(seasonPassProgress(profile, "access", { BUNGIE_API_KEY: "test" } as Env, "stale")).resolves.toMatchObject({
      rank: 101,
      progress: {
        progressToNextLevel: 450_000,
        nextLevelAt: 500_000,
        percent: 90,
        activeProgressionHash: "11",
        activeLevel: 101,
        segmentsPerRank: 5
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
    expect(result.friendsState).toBe("available");
    expect(result.clanState).toBe("available");
    expect(result.contacts).toMatchObject([
      { membershipId: "friend-1", displayName: "Friend#0007", source: "friend-and-clan", clanName: "Test Clan", onlineState: "online", inDestiny2: true },
      { membershipId: "clan-2", displayName: "Clanmate#0008", source: "clan", onlineState: "offline" }
    ]);
  });

  it("loads every returned clan member page", async () => {
    const responses = [
      { friends: [] },
      { results: [{ group: { groupId: "clan-pages", name: "Full Clan" } }] },
      { results: [{ isOnline: false, destinyUserInfo: { membershipId: "page-1", membershipType: 3, bungieGlobalDisplayName: "First" } }], hasMore: true },
      { results: [{ isOnline: false, destinyUserInfo: { membershipId: "page-2", membershipType: 3, bungieGlobalDisplayName: "Second" } }], hasMore: false }
    ];
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ ErrorCode: 1, Response: responses.shift() }), { status: 200, headers: { "Content-Type": "application/json" } })));
    vi.stubGlobal("fetch", fetchMock);

    const result = await socialRosterFor({ membership_type: 3, membership_id: "paged-social-member" } as SessionRow, "access", { BUNGIE_API_KEY: "test" } as Env);

    expect(result.contacts.map((contact) => contact.membershipId)).toEqual(["page-1", "page-2"]);
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual(expect.arrayContaining([expect.stringContaining("currentpage=1"), expect.stringContaining("currentpage=2")]));
  });

  it("does not label Bungie's offline-or-unknown friend presence as confirmed offline", async () => {
    const responses = [
      { friends: [{ lastSeenAsMembershipId: "hidden-friend", lastSeenAsBungieMembershipType: 3, bungieGlobalDisplayName: "Hidden", onlineStatus: 0, onlineTitle: 0 }] },
      { results: [] }
    ];
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ ErrorCode: 1, Response: responses.shift() }), { status: 200, headers: { "Content-Type": "application/json" } }))));

    const result = await socialRosterFor({ membership_type: 3, membership_id: "hidden-social-member" } as SessionRow, "access", { BUNGIE_API_KEY: "test" } as Env);

    expect(result.contacts).toMatchObject([{ membershipId: "hidden-friend", onlineState: "unknown", inDestiny2: false }]);
  });
});

describe("manifest overlays", () => {
  it("reassembles companion item definitions from deployment chunks", async () => {
    const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      const value = url.endsWith("companion-manifest.json")
        ? { version: "chunk-test", generatedAt: "now", itemDefinitions: { index: { name: "Index" } }, itemDefinitionChunks: ["companion-manifest-00.json"], bucketDefinitions: {}, loadoutNameDefinitions: {}, loadoutIconDefinitions: {}, loadoutColorDefinitions: {} }
        : { itemDefinitions: { chunk: { name: "Chunk" } } };
      return Promise.resolve(new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadCompanionManifest({ GAME_DATA_URL: "https://example.test/data/manifest.json" } as Env);

    expect(result.itemDefinitions).toEqual({ index: { name: "Index" }, chunk: { name: "Chunk" } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://example.test/data/companion-manifest-00.json");
  });

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
