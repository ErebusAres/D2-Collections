import { describe, expect, it } from "vitest";
import type { CompactManifest } from "@guardian-nexus/contracts";
import { activityName, guardianOnlineState, normalizeQuests } from "../src/normalize";

const manifest = {
  version: "test",
  generatedAt: "now",
  items: [],
  itemDefinitions: {},
  objectiveDefinitions: {},
  activityDefinitions: {
    "42": { displayProperties: { name: "A Story Mission" } },
    "99": { displayProperties: { name: "A Transitory Activity" } }
  },
  recordDefinitions: {}
} satisfies CompactManifest;

describe("activityName", () => {
  it("falls back to the selected character activity when transitory data is missing", () => {
    const profile = { characterActivities: { data: { c1: { currentActivityHash: 42 } } } };
    expect(activityName(profile, manifest, "c1")).toBe("A Story Mission");
  });

  it("prefers Bungie's transitory current activity when both sources resolve", () => {
    const profile = {
      profileTransitoryData: { data: { currentActivity: { activityHash: 99 } } },
      characterActivities: { data: { c1: { currentActivityHash: 42 } } }
    };
    expect(activityName(profile, manifest, "c1")).toBe("A Transitory Activity");
  });
});

describe("guardianOnlineState", () => {
  it("distinguishes an observed offline Guardian from online orbit and unknown presence", () => {
    expect(guardianOnlineState({ minutesPlayedThisSession: 0 }, undefined, true)).toBe("offline");
    expect(guardianOnlineState({ minutesPlayedThisSession: 12 }, undefined, true)).toBe("online");
    expect(guardianOnlineState({ minutesPlayedThisSession: 0 }, "The Tower", true)).toBe("online");
    expect(guardianOnlineState(undefined, undefined, false)).toBe("unknown");
  });
});

describe("normalizeQuests", () => {
  it("builds quest steps and resolves flavor text plus multiple real reward definitions", () => {
    const chainManifest = { ...manifest, itemDefinitions: {
      "11": { displayProperties: { name: "A Quest", description: "Finish the introduction." }, objectives: { objectiveHashes: ["101"] } },
      "22": { displayProperties: { name: "A Quest", description: "Defeat combatants." }, flavorText: "A test of resolve.", itemType: 12, itemTypeDisplayName: "Quest Step", inventory: { tierType: 6, tierTypeName: "Exotic" }, value: { itemValue: [{ itemHash: 501, quantity: 1 }, { itemHash: 502, quantity: 3 }] }, objectives: { objectiveHashes: ["102"] }, setData: { questStepSummary: "Fight through the area.", itemList: [{ trackingValue: 1, itemHash: 11 }, { trackingValue: 2, itemHash: 22 }, { trackingValue: 3, itemHash: 33 }] } },
      "33": { displayProperties: { name: "A Quest", description: "Return to the Tower." }, objectives: { objectiveHashes: ["103"] } },
      "501": { displayProperties: { name: "Test Weapon", description: "Reward one", icon: "/weapon.png" } },
      "502": { displayProperties: { name: "Test Currency", description: "Reward two", icon: "/currency.png" } }
    }, objectiveDefinitions: {
      "101": { progressDescription: "Introduction", completionValue: 1 },
      "102": { progressDescription: "Combatants", completionValue: 10 },
      "103": { progressDescription: "Return", completionValue: 1 }
    } } satisfies CompactManifest;
    const profile = { responseMintedTimestamp: "2026-07-15T00:00:00Z", characterInventories: { data: { c1: { items: [{ itemHash: 22, itemInstanceId: "i1" }] } } }, itemComponents: { objectives: { data: { i1: { objectives: [{ objectiveHash: 102, progress: 4, completionValue: 10, complete: false }] } } } } };
    const quest = normalizeQuests(profile, chainManifest, "c1").quests[0]!;
    expect(quest).toMatchObject({ stepNumber: 2, stepCount: 3, percent: 40, flavorText: "A test of resolve.", itemType: "Quest Step", rarity: "Exotic" });
    expect(quest.rewards).toEqual([
      { itemHash: "501", name: "Test Weapon", description: "Reward one", icon: "https://www.bungie.net/weapon.png", quantity: 1, definitionAvailable: true },
      { itemHash: "502", name: "Test Currency", description: "Reward two", icon: "https://www.bungie.net/currency.png", quantity: 3, definitionAvailable: true }
    ]);
    expect(quest.steps).toMatchObject([
      { stepNumber: 1, status: "completed", percent: 100, objectives: [{ progress: 1, completionValue: 1, complete: true }] },
      { stepNumber: 2, status: "current", percent: 40, objectives: [{ progress: 4, completionValue: 10 }] },
      { stepNumber: 3, status: "future", percent: 0, objectives: [{ progress: 0, completionValue: 1 }] }
    ]);
  });
});
