import { describe, expect, it } from "vitest";
import type { QuestProgress } from "@guardian-nexus/contracts";
import { bountyCadence, bountyVendor, questKind, questPercent } from "./progressSummary";

function quest(overrides: Partial<QuestProgress> = {}): QuestProgress {
  return {
    instanceId: "1", itemHash: "1", name: "Quest", description: "", icon: "", currentStep: "",
    characterId: "c1", inGameTracked: false, sitePinned: false, isExoticUnlock: false,
    rewards: [], objectives: [], percent: 0, updatedAt: "now", ...overrides
  };
}

describe("journey progress summaries", () => {
  it("classifies quest highlights without changing the tracker data", () => {
    expect(questKind(quest({ isExoticUnlock: true }))).toBe("exotic");
    expect(questKind(quest({ itemType: "Campaign Quest" }))).toBe("campaign");
    expect(questKind(quest({ inGameTracked: true }))).toBe("featured");
  });

  it("uses Bungie's pursuit labels for bounty cadence and vendor", () => {
    expect(bountyCadence(quest({ itemType: "Weekly Bounty" }))).toBe("weekly");
    expect(bountyCadence(quest({ expiresAt: "tomorrow" }))).toBe("daily");
    expect(bountyVendor(quest({ activityName: "Vanguard Ops" }))).toBe("Vanguard Ops");
  });

  it("averages known pursuit completion", () => {
    expect(questPercent([quest({ percent: 20 }), quest({ percent: 80 })])).toBe(50);
    expect(questPercent([])).toBe(0);
  });
});
