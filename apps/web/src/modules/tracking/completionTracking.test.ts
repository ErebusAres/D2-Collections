import type { GuardianRankData, QuestProgress } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { completionTransition, guardianRankCompletionCandidates, isGuardianRankQuestComplete, isQuestComplete, questCompletionCandidates } from "./completionTracking";

describe("tracked completion detection", () => {
  it("only announces an observed incomplete-to-complete transition", () => {
    const incomplete = questCompletionCandidates([quest({ percent: 80 })], new Set(["quest"]));
    const baseline = completionTransition(null, incomplete);
    const complete = questCompletionCandidates([quest({ percent: 100, objectives: [{ objectiveHash: "o", name: "Objective", progress: 10, completionValue: 10, complete: true, percent: 100 }] })], new Set(["quest"]));
    const transition = completionTransition(baseline.state, complete);

    expect(baseline.newlyCompleted).toEqual([]);
    expect(transition.newlyCompleted).toMatchObject([{ id: "quest", name: "Tracked quest", complete: true, trackedInGuardianNexus: true }]);
    expect(completionTransition(transition.state, complete).newlyCompleted).toEqual([]);
  });

  it("uses explicit 100% objective completion and ignores an empty objective list", () => {
    expect(isQuestComplete(quest({ percent: 99, objectives: [{ objectiveHash: "o", name: "Objective", progress: 10, completionValue: 10, complete: false, percent: 100 }] }))).toBe(true);
    expect(isQuestComplete(quest({ percent: 0, objectives: [] }))).toBe(false);
  });

  it("collects site and Destiny tracked Guardian Rank objectives once", () => {
    const data = guardianRanks();
    const candidates = guardianRankCompletionCandidates(data, new Set(["record"]));

    expect(candidates).toEqual([{
      id: "record",
      name: "Rank objective",
      kind: "guardian-rank",
      complete: false,
      trackedInGuardianNexus: true
    }]);
    expect(isGuardianRankQuestComplete(data.ranks[0]!.categories[0]!.quests[0]!)).toBe(false);
  });
});

function quest(overrides: Partial<QuestProgress>): QuestProgress {
  return {
    instanceId: "quest",
    itemHash: "100",
    name: "Tracked quest",
    description: "",
    icon: "",
    currentStep: "Finish it.",
    characterId: "c1",
    inGameTracked: false,
    sitePinned: true,
    isExoticUnlock: false,
    rewards: [],
    objectives: [{ objectiveHash: "o", name: "Objective", progress: 8, completionValue: 10, complete: false, percent: 80 }],
    percent: 80,
    updatedAt: "2026-07-22T12:00:00.000Z",
    ...overrides
  };
}

function guardianRanks(): GuardianRankData {
  const objective = {
    recordHash: "record",
    name: "Rank objective",
    description: "",
    icon: "",
    state: "in-progress" as const,
    trackedInDestiny: true,
    objectives: [{ objectiveHash: "o", name: "Objective", progress: 1, completionValue: 2, percent: 50, complete: false, progressAvailable: true }]
  };
  return {
    currentRank: 6,
    renewedRank: 6,
    highestAchievedRank: 6,
    lifetimeHighestRank: 6,
    maximumRank: 12,
    suggestedRank: 6,
    ranks: [{
      rankHash: "6",
      rankNumber: 6,
      name: "Veteran",
      description: "",
      icon: "",
      foregroundImage: "",
      overlayImage: "",
      state: "current",
      completed: 0,
      total: 1,
      categories: [{ nodeHash: "category", name: "Journey", description: "", icon: "", seasonal: false, completed: 0, total: 1, quests: [objective] }]
    }],
    sources: { ranks: "DestinyProfileComponent and DestinyGuardianRankDefinition", objectives: "DestinyPresentationNodeDefinition, DestinyRecordDefinition, and profile records (component 900)" }
  };
}
