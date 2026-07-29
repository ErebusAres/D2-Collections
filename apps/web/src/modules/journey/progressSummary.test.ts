import { describe, expect, it } from "vitest";
import type { QuestProgress } from "@guardian-nexus/contracts";
import { bountyCadence, bountyVendor, isSeasonalPursuit, pursuitExpiryLabel, pursuitProgressLabel, questKind, questPercent } from "./progressSummary";

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

  it("identifies hub pursuits and formats useful progress without inventing it", () => {
    expect(isSeasonalPursuit(quest({ category: "order" }))).toBe(true);
    expect(isSeasonalPursuit(quest({ name: "Episode: Reclamation" }))).toBe(true);
    expect(isSeasonalPursuit(quest({ name: "Vanguard bounty" }))).toBe(false);
    expect(pursuitProgressLabel(quest({ objectives: [{ objectiveHash: "o", name: "Targets", progress: 3, completionValue: 10, percent: 30, complete: false }] }))).toBe("3 / 10");
    expect(pursuitProgressLabel(quest())).toBe("No counter");
  });

  it("formats pursuit expiry as a compact deadline", () => {
    const now = Date.parse("2026-07-29T12:00:00.000Z");
    expect(pursuitExpiryLabel("2026-07-29T14:00:00.000Z", now)).toBe("2h left");
    expect(pursuitExpiryLabel("2026-07-31T12:00:00.000Z", now)).toBe("2d left");
    expect(pursuitExpiryLabel(undefined, now)).toBeUndefined();
  });
});
