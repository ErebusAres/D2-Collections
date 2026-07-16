import { describe, expect, it } from "vitest";
import { normalizeRewardCodeStatus } from "../src/rewardCodes";

const manifest = {
  version: "test",
  generatedAt: "2026-07-16T00:00:00Z",
  definitions: {
    "OWN-ED1-COD": { reward: "Owned reward", items: [{ itemHash: "1", collectibleHash: "11", name: "Owned reward", icon: "", itemType: "Emblem" }] },
    "NOT-OWN-ED2": { reward: "Missing reward", items: [{ itemHash: "2", collectibleHash: "22", name: "Missing reward", icon: "", itemType: "Emblem" }] },
    "UNM-APP-ED3": { reward: "Unmapped reward", items: [] }
  }
};

describe("normalizeRewardCodeStatus", () => {
  it("detects acquired rewards from real profile collectible state", () => {
    const result = normalizeRewardCodeStatus({ profileCollectibles: { data: { collectibles: { "11": { state: 0 }, "22": { state: 1 } } } } }, manifest, "now");
    expect(result.statuses.find((entry) => entry.code === "OWN-ED1-COD")?.state).toBe("reward-owned");
    expect(result.statuses.find((entry) => entry.code === "NOT-OWN-ED2")?.state).toBe("not-owned");
    expect(result.statuses.find((entry) => entry.code === "UNM-APP-ED3")?.state).toBe("unavailable");
  });

  it("does not invent ownership when Bungie omits collectibles", () => {
    const result = normalizeRewardCodeStatus({}, manifest, "now");
    expect(result.statuses.find((entry) => entry.code === "OWN-ED1-COD")?.state).toBe("unavailable");
  });
});
