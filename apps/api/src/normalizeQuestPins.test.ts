import { describe, expect, it } from "vitest";
import type { QuestData } from "@guardian-nexus/contracts";
import { applyQuestPins } from "./normalize";

describe("applyQuestPins", () => {
  it("applies request-local pins without mutating the cached quest snapshot", () => {
    const cached = {
      quests: [
        { instanceId: "quest-a", name: "A", sitePinned: false, objectives: [], percent: 0 },
        { instanceId: "quest-b", name: "B", sitePinned: false, objectives: [], percent: 0 }
      ],
      recommendations: [],
      currentActivity: "Orbit"
    } as unknown as QuestData;

    const result = applyQuestPins(cached, new Set(["quest-b"]));

    expect(result.quests.map((quest) => quest.sitePinned)).toEqual([false, true]);
    expect(cached.quests.map((quest) => quest.sitePinned)).toEqual([false, false]);
  });
});
