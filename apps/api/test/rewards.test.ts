import type { RewardsManifest, RewardsPassProgress } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { normalizeRewardsPass } from "../src/rewards";

const progress: RewardsPassProgress = {
  state: "available",
  source: "bungie-profile-character-progressions",
  passHash: "99",
  rewardProgressionHash: "11",
  activeProgressionHash: "11",
  currentProgress: 1250,
  progressToNextLevel: 250,
  nextLevelAt: 1000,
  percent: 25
};

const manifest: RewardsManifest = {
  version: "test-manifest",
  generatedAt: "now",
  seasonPassDefinitions: {
    "99": { displayProperties: { name: "Test Rewards Pass", description: "Current pass" }, rewardProgressionHash: "11", prestigeProgressionHash: "", images: { iconImagePath: "/pass.png", themeBackgroundImagePath: "/theme.jpg" } }
  },
  progressionDefinitions: {
    "11": { rewardItems: [
      { rewardItemIndex: 0, rewardedAtProgressionLevel: 1, acquisitionBehavior: 1, uiDisplayStyle: "free_track", itemHash: 501, quantity: 1 },
      { rewardItemIndex: 1, rewardedAtProgressionLevel: 2, acquisitionBehavior: 0, uiDisplayStyle: "premium_track", itemHash: 502, quantity: 3 },
      { rewardItemIndex: 2, rewardedAtProgressionLevel: 3, acquisitionBehavior: 1, uiDisplayStyle: "free_track", itemHash: 503, quantity: 1 }
    ] }
  },
  itemDefinitions: {
    "501": { displayProperties: { name: "Claimed Engram", description: "Already claimed", icon: "/engram.png" } },
    "502": { displayProperties: { name: "Available Currency", description: "Ready", icon: "/currency.png" } },
    "503": { displayProperties: { name: "Locked Weapon", description: "Keep ranking", icon: "/weapon.png" } }
  }
};

describe("normalizeRewardsPass", () => {
  it("maps real reward definitions, levels, tracks, quantities, icons, and live state flags", () => {
    const profile = {
      profile: { data: { currentSeasonPassHash: 99 } },
      characterProgressions: { data: { c1: { progressions: { 11: { rewardItemStates: [6, 10, 0] } } } } }
    };

    const result = normalizeRewardsPass({ profile, manifest, rank: 2, progress, characterId: "c1" });

    expect(result).toMatchObject({ name: "Test Rewards Pass", rank: 2, rewardDataState: "available" });
    expect(result.rewards).toEqual([
      expect.objectContaining({ name: "Claimed Engram", icon: "https://www.bungie.net/engram.png", requiredLevel: 1, track: "Free track", quantity: 1, state: "claimed", acquisition: "claim-required" }),
      expect.objectContaining({ name: "Available Currency", icon: "https://www.bungie.net/currency.png", requiredLevel: 2, track: "Premium track", quantity: 3, state: "available", acquisition: "instant" }),
      expect.objectContaining({ name: "Locked Weapon", icon: "https://www.bungie.net/weapon.png", requiredLevel: 3, track: "Free track", quantity: 1, state: "locked" })
    ]);
  });

  it("does not fabricate a catalog when the rewards manifest is unavailable", () => {
    const result = normalizeRewardsPass({
      profile: { profile: { data: { currentSeasonPassHash: 99 } } },
      manifest: { version: "unavailable", generatedAt: "now", seasonPassDefinitions: {}, progressionDefinitions: {}, itemDefinitions: {} },
      rank: 0,
      progress: { ...progress, state: "unavailable", reason: "Component missing" },
      characterId: "c1"
    });

    expect(result).toMatchObject({ rewardDataState: "unavailable", rewards: [], rewardDataReason: "The Rewards Pass manifest could not be loaded." });
  });
});
