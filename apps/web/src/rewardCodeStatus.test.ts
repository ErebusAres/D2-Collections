import { describe, expect, it } from "vitest";
import { accountOwnedCodes, mergedHiddenCodes } from "./rewardCodeStatus";

describe("reward code account state", () => {
  it("only auto-hides rewards Bungie reports as owned", () => {
    const detected = accountOwnedCodes([
      { code: "OWNED", reward: "Owned", state: "reward-owned", matchedCollectibleHashes: ["1"] },
      { code: "MISSING", reward: "Missing", state: "not-owned", matchedCollectibleHashes: ["2"] },
      { code: "UNKNOWN", reward: "Unknown", state: "unavailable", matchedCollectibleHashes: [] }
    ]);
    expect([...detected]).toEqual(["OWNED"]);
  });

  it("combines browser checkmarks with account ownership", () => {
    expect([...mergedHiddenCodes(new Set(["MANUAL"]), new Set(["OWNED"]))]).toEqual(["MANUAL", "OWNED"]);
  });
});
