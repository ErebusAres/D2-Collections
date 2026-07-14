import { describe, expect, it } from "vitest";
import type { CompactManifest, QuestProgress } from "@guardian-nexus/contracts";
import { mergeCollection, objectivePercent, recommendQuests } from "./index";

const quest = (overrides: Partial<QuestProgress>): QuestProgress => ({
  instanceId: "1",
  itemHash: "10",
  name: "A Quest",
  description: "",
  icon: "",
  currentStep: "Step one",
  characterId: "c1",
  inGameTracked: false,
  sitePinned: false,
  isExoticUnlock: false,
  rewards: [],
  objectives: [],
  percent: 0,
  updatedAt: "2026-07-14T00:00:00.000Z",
  ...overrides
});

describe("objectivePercent", () => {
  it("clamps progress and respects explicit completion", () => {
    expect(objectivePercent(5, 10)).toBe(50);
    expect(objectivePercent(20, 10)).toBe(100);
    expect(objectivePercent(0, 0, true)).toBe(100);
  });
});

describe("recommendQuests", () => {
  it("uses the specified priority order and explains it", () => {
    const results = recommendQuests([
      quest({ instanceId: "normal", name: "Normal", percent: 95 }),
      quest({ instanceId: "tracked", name: "Tracked", inGameTracked: true }),
      quest({ instanceId: "pinned", name: "Pinned" })
    ], { pinnedIds: new Set(["pinned"]) });
    expect(results.map((result) => result.quest.instanceId)).toEqual(["pinned", "tracked", "normal"]);
    expect(results[0]?.reasons).toContain("Site pinned");
  });

  it("rewards activity batching", () => {
    const results = recommendQuests([
      quest({ instanceId: "a", name: "A", activityName: "Pinnacle Ops" }),
      quest({ instanceId: "b", name: "B", activityName: "Pinnacle Ops" }),
      quest({ instanceId: "c", name: "C", activityName: "Tower" })
    ]);
    expect(results[0]?.reasons).toContain("Progresses with other quests");
  });
});

describe("mergeCollection", () => {
  it("consolidates legacy variants and preserves ownership across their collectible hashes", () => {
    const variants: CompactManifest["items"] = [
      { itemHash: "old", name: "Phoenix Protocol", description: "", icon: "/old.png", kind: "armor", className: "Warlock", slot: "Chest", itemType: "Chest Armor", source: "", catalystRecordHashes: ["not-a-real-armor-catalyst"] },
      { itemHash: "current", collectibleHash: "owned", name: "Phoenix Protocol", description: "Current", icon: "/current.png", kind: "armor", className: "Warlock", slot: "Chest", itemType: "Chest Armor", source: "Engrams", catalystRecordHashes: [] }
    ];
    const entries = mergeCollection({ version: "test", generatedAt: "now", items: variants, itemDefinitions: {}, objectiveDefinitions: {}, activityDefinitions: {}, recordDefinitions: {} }, {
      ownedCollectibleHashes: new Set(["owned"]),
      completedRecordHashes: new Set(),
      visibleRecordHashes: new Set()
    }, "Warlock");

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ itemHash: "current", owned: true, catalyst: "unavailable" });
  });

  it("combines ownership and catalyst state for duplicate weapon definitions", () => {
    const variants: CompactManifest["items"] = [
      { itemHash: "a", collectibleHash: "missing", name: "Test Rifle", description: "", icon: "/a.png", kind: "weapon", slot: "Kinetic", itemType: "Auto Rifle", source: "Quest", catalystRecordHashes: ["cat"] },
      { itemHash: "b", collectibleHash: "owned", name: "Test Rifle", description: "", icon: "/b.png", kind: "weapon", slot: "Kinetic", itemType: "Auto Rifle", source: "Quest", catalystRecordHashes: [] }
    ];
    const entries = mergeCollection({ version: "test", generatedAt: "now", items: variants, itemDefinitions: {}, objectiveDefinitions: {}, activityDefinitions: {}, recordDefinitions: {} }, {
      ownedCollectibleHashes: new Set(["owned"]),
      completedRecordHashes: new Set(["cat"]),
      visibleRecordHashes: new Set(["cat"])
    }, "Warlock");

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ owned: true, catalyst: "complete" });
  });
});
