import { describe, expect, it } from "vitest";
import { hasClaimableReward, rewardLevelProgress } from "./rewardsProgress";

describe("rewardLevelProgress", () => {
  it("derives a percentage when Bungie supplies XP values without a precomputed percent", () => {
    expect(rewardLevelProgress({
      state: "partial",
      source: "bungie-profile-character-progressions",
      progressToNextLevel: 62_500,
      nextLevelAt: 100_000
    })).toEqual({ mode: "reward-rank", current: 62_500, required: 100_000, percent: 63, levelCurrent: 62_500, levelRequired: 100_000 });
  });

  it("keeps zero-percent level progress available", () => {
    expect(rewardLevelProgress({
      state: "available",
      source: "bungie-profile-character-progressions",
      progressToNextLevel: 0,
      nextLevelAt: 100_000,
      percent: 0
    })).toEqual({ mode: "reward-rank", current: 0, required: 100_000, percent: 0, levelCurrent: 0, levelRequired: 100_000 });
  });

  it("splits post-100 rank XP into five in-game progress pips", () => {
    expect(rewardLevelProgress({
      state: "available",
      source: "bungie-profile-character-progressions",
      progressionMode: "bright-engram",
      activeLevel: 101,
      levelsPerBrightEngram: 5,
      progressToNextLevel: 400_000,
      nextLevelAt: 500_000,
      percent: 80
    })).toEqual({
      mode: "bright-engram",
      current: 400_000,
      required: 500_000,
      percent: 80,
      levelCurrent: 400_000,
      levelRequired: 500_000,
      segments: [100, 100, 100, 100, 0]
    });
  });

  it("returns unavailable when Bungie omits the next-level threshold", () => {
    expect(rewardLevelProgress({
      state: "partial",
      source: "bungie-profile-character-progressions",
      progressToNextLevel: 250
    })).toBeNull();
  });
});

describe("hasClaimableReward", () => {
  it("pulses only for a reward Bungie marks available without a blocker", () => {
    const reward = { rewardItemIndex: 1, itemHash: "1", name: "Reward", description: "", icon: "", quantity: 1, requiredLevel: 1, track: "Free", acquisition: "claim-required" as const };
    expect(hasClaimableReward([{ ...reward, state: "available" }])).toBe(true);
    expect(hasClaimableReward([{ ...reward, state: "earned" }, { ...reward, rewardItemIndex: 2, state: "locked" }])).toBe(false);
  });
});
