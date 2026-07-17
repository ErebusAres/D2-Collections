import type { QuestProgress } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { questProgressPresentation } from "./questProgress";

const quest = (overrides: Partial<QuestProgress> = {}): QuestProgress => ({
  instanceId: "quest", itemHash: "10", name: "Quest", description: "Do the thing", icon: "", currentStep: "Do the thing", characterId: "c1",
  inGameTracked: false, sitePinned: false, isExoticUnlock: false, rewards: [], objectives: [], percent: 0, updatedAt: "2026-07-16T00:00:00Z", ...overrides
});

describe("questProgressPresentation", () => {
  it("uses live objective progress when Bungie supplies counters", () => {
    expect(questProgressPresentation(quest({ percent: 40, objectives: [{ objectiveHash: "1", name: "Targets", progress: 4, completionValue: 10, complete: false, percent: 40 }] }))).toMatchObject({
      mode: "live", heading: "Live objectives", value: "40%", percent: 40, progressKnown: true
    });
  });

  it("uses manifest requirements and route position without inventing numeric progress", () => {
    expect(questProgressPresentation(quest({ stepNumber: 2, stepCount: 4, steps: [{ itemHash: "10", stepNumber: 2, name: "Current", description: "Defeat combatants", status: "current", percent: 0, progressKnown: false, objectives: [{ objectiveHash: "2", name: "Combatants", progress: 0, completionValue: 50, complete: false, percent: 0 }] }] }))).toMatchObject({
      mode: "requirements", heading: "Step requirements", value: "Step 2/4", percent: 25, progressKnown: false, instruction: "Defeat combatants"
    });
  });

  it("falls back to the current instruction when no counter or route is exposed", () => {
    expect(questProgressPresentation(quest())).toMatchObject({ mode: "instruction", value: "No numeric counter", instruction: "Do the thing" });
  });
});
