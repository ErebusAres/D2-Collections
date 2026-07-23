import type { GuardianRankData, QuestProgress } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { profileComponentsFor } from "./bungie";
import { mergeTrackedItems, trackedItemsFromGuardianRanks, trackedItemsFromQuests } from "./fireteamTracking";

describe("Fireteam tracked items", () => {
  it("requests both pursuit and Guardian Rank profile components when refreshing a share", () => {
    expect(profileComponentsFor("fireteam-share").split(",")).toEqual(expect.arrayContaining(["102", "204", "301", "310", "900"]));
  });

  it("shares every tracked pursuit kind and excludes untracked inventory", () => {
    const items = trackedItemsFromQuests([
      quest({ instanceId: "quest", category: "quest", sitePinned: true }),
      quest({ instanceId: "bounty", category: "bounty", inGameTracked: true }),
      quest({ instanceId: "order", category: "order", sitePinned: true }),
      quest({ instanceId: "private", category: "quest" })
    ]);

    expect(items.map((item) => [item.id, item.kind])).toEqual([
      ["quest", "quest"],
      ["bounty", "bounty"],
      ["order", "order"]
    ]);
    expect(items[0]).toMatchObject({ trackedInGuardianNexus: true, trackedInDestiny: false, objectives: [{ progressAvailable: true }] });
  });

  it("stops sharing completed pursuits even when Destiny or the site still marks them tracked", () => {
    const items = trackedItemsFromQuests([
      quest({ instanceId: "percent-complete", sitePinned: true, percent: 100 }),
      quest({ instanceId: "objective-complete", inGameTracked: true, objectives: [{ objectiveHash: "objective", name: "Progress", progress: 10, completionValue: 10, complete: true, percent: 100 }] }),
      quest({ instanceId: "still-active", sitePinned: true, percent: 99 })
    ]);

    expect(items.map((item) => item.id)).toEqual(["still-active"]);
  });

  it("includes site and Destiny tracked Guardian Rank objectives once with the current-rank context", () => {
    const data = guardianRanks();
    const items = trackedItemsFromGuardianRanks(data, new Set(["site-record"]), "2026-07-22T12:00:00.000Z");

    expect(items).toHaveLength(2);
    expect(items.find((item) => item.id === "destiny-record")).toMatchObject({
      kind: "guardian-rank",
      trackedInDestiny: true,
      trackedInGuardianNexus: false,
      context: "Guardian Rank · Journey · Progress to rank 7",
      percent: 40
    });
    expect(items.find((item) => item.id === "site-record")).toMatchObject({ trackedInGuardianNexus: true, percent: 25 });
  });

  it("stops sharing completed Guardian Rank objectives", () => {
    const data = guardianRanks();
    data.ranks[0]!.categories[0]!.quests[0]!.state = "completed";
    data.ranks[0]!.categories[0]!.quests[0]!.objectives[0]!.complete = true;
    data.ranks[0]!.categories[0]!.quests[0]!.objectives[0]!.percent = 100;

    const items = trackedItemsFromGuardianRanks(data, new Set(["site-record"]), "2026-07-22T12:00:00.000Z");

    expect(items.map((item) => item.id)).toEqual(["site-record"]);
  });

  it("deduplicates the same tracked item across assembled groups", () => {
    const item = trackedItemsFromQuests([quest({ instanceId: "same", sitePinned: true })])[0]!;
    expect(mergeTrackedItems([item], [{ ...item, percent: 80 }])).toEqual([{ ...item, percent: 80 }]);
  });
});

function quest(overrides: Partial<QuestProgress>): QuestProgress {
  return {
    instanceId: "item",
    itemHash: "100",
    name: "Tracked pursuit",
    description: "Description",
    icon: "",
    currentStep: "Complete the objective.",
    characterId: "c1",
    inGameTracked: false,
    sitePinned: false,
    isExoticUnlock: false,
    rewards: [],
    objectives: [{ objectiveHash: "objective", name: "Progress", progress: 2, completionValue: 10, complete: false, percent: 20 }],
    percent: 20,
    updatedAt: "2026-07-22T12:00:00.000Z",
    ...overrides
  };
}

function guardianRanks(): GuardianRankData {
  const destiny = {
    recordHash: "destiny-record",
    name: "Service",
    description: "Complete activities.",
    icon: "",
    state: "in-progress" as const,
    trackedInDestiny: true,
    objectives: [{ objectiveHash: "destiny-objective", name: "Activities", progress: 4, completionValue: 10, percent: 40, complete: false, progressAvailable: true }]
  };
  const site = {
    recordHash: "site-record",
    name: "Commendations",
    description: "Earn commendations.",
    icon: "",
    state: "in-progress" as const,
    trackedInDestiny: false,
    objectives: [{ objectiveHash: "site-objective", name: "Commendations", progress: 1, completionValue: 4, percent: 25, complete: false, progressAvailable: true }]
  };
  const category = { nodeHash: "category", name: "Journey", description: "", icon: "", seasonal: false, completed: 0, total: 2, quests: [destiny, site] };
  return {
    currentRank: 6,
    renewedRank: 6,
    highestAchievedRank: 6,
    lifetimeHighestRank: 6,
    maximumRank: 8,
    suggestedRank: 6,
    ranks: [
      { rankHash: "6", rankNumber: 6, name: "Veteran", description: "", icon: "", foregroundImage: "", overlayImage: "", state: "current", completed: 0, total: 2, categories: [category] },
      { rankHash: "7", rankNumber: 7, name: "Elite", description: "", icon: "", foregroundImage: "", overlayImage: "", state: "next", completed: 0, total: 2, categories: [category] }
    ],
    sources: { ranks: "DestinyProfileComponent and DestinyGuardianRankDefinition", objectives: "DestinyPresentationNodeDefinition, DestinyRecordDefinition, and profile records (component 900)" }
  };
}
