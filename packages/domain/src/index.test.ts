import { describe, expect, it } from "vitest";
import type { QuestProgress } from "@guardian-nexus/contracts";
import { objectivePercent, recommendQuests } from "./index";

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
