import { describe, expect, it } from "vitest";
import { rewardLevelProgress } from "./rewardsProgress";

describe("rewardLevelProgress", () => {
  it("derives a percentage when Bungie supplies XP values without a precomputed percent", () => {
    expect(rewardLevelProgress({
      state: "partial",
      source: "bungie-profile-character-progressions",
      progressToNextLevel: 62_500,
      nextLevelAt: 100_000
    })).toEqual({ current: 62_500, required: 100_000, percent: 63 });
  });

  it("keeps zero-percent level progress available", () => {
    expect(rewardLevelProgress({
      state: "available",
      source: "bungie-profile-character-progressions",
      progressToNextLevel: 0,
      nextLevelAt: 100_000,
      percent: 0
    })).toEqual({ current: 0, required: 100_000, percent: 0 });
  });

  it("returns unavailable when Bungie omits the next-level threshold", () => {
    expect(rewardLevelProgress({
      state: "partial",
      source: "bungie-profile-character-progressions",
      progressToNextLevel: 250
    })).toBeNull();
  });
});
