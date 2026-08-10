import type { CollectionData, GuardianRankData, QuestProgress } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { profileComponentsFor } from "./bungie";
import { applyTrackedItemVisibility, completedTrackedItemEvents, mergeTrackedItems, missingTrackedQuestCompletionKeys, trackedItemsFromCollection, trackedItemsFromGuardianRanks, trackedItemsFromQuests } from "./fireteamTracking";

describe("Fireteam tracked items", () => {
  it("requests both pursuit and Guardian Rank profile components when refreshing a share", () => {
    expect(profileComponentsFor("fireteam-share").split(",")).toEqual(expect.arrayContaining(["102", "204", "301", "310", "900", "1000"]));
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

  it("adds only explicitly tracked missing Exotics with their acquisition guide", () => {
    const items = trackedItemsFromCollection(collection(false), new Set(["exotic-1"]), "2026-07-29T12:00:00.000Z");

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "exotic-1",
      kind: "exotic",
      trackedInDestiny: false,
      trackedInGuardianNexus: true,
      percent: 0,
      acquisitionGuide: {
        summary: "Complete the Exotic mission.",
        steps: ["Launch the mission.", "Claim the reward."],
        prerequisites: ["Finish the introduction."]
      }
    });
  });

  it("uses the existing completion event path when a tracked Exotic becomes owned", () => {
    const tracked = new Set(["exotic-1"]);
    const previous = trackedItemsFromCollection(collection(false), tracked, "2026-07-29T12:00:00.000Z");
    const active = trackedItemsFromCollection(collection(true), tracked, "2026-07-29T12:01:00.000Z");
    const candidates = trackedItemsFromCollection(collection(true), tracked, "2026-07-29T12:01:00.000Z", true, new Set(["exotic:exotic-1"]));

    expect(active).toEqual([]);
    expect(completedTrackedItemEvents(previous, candidates, [], "2026-07-29T12:01:00.000Z", 180_000))
      .toMatchObject([{ kind: "exotic", id: "exotic-1", percent: 100 }]);
  });

  it("shares a tracked catalyst with its exact masterwork objective counter", () => {
    const items = trackedItemsFromCollection(catalystCollection("obtained", 23), new Set(["catalyst:catalyst-record"]), "2026-07-29T12:00:00.000Z");

    expect(items).toMatchObject([{
      id: "catalyst-record",
      kind: "catalyst",
      name: "ABC Catalyst",
      context: "Catalyst · Test Exotic",
      trackedInGuardianNexus: true,
      percent: 46,
      objectives: [{ name: "Kill enemies", progress: 23, completionValue: 50, progressAvailable: true }]
    }]);
  });

  it("dismisses a completed catalyst through the existing Fireteam completion event", () => {
    const tracked = new Set(["catalyst:catalyst-record"]);
    const previous = trackedItemsFromCollection(catalystCollection("obtained", 49), tracked, "2026-07-29T12:00:00.000Z");
    const active = trackedItemsFromCollection(catalystCollection("complete", 50), tracked, "2026-07-29T12:01:00.000Z");
    const candidates = trackedItemsFromCollection(catalystCollection("complete", 50), tracked, "2026-07-29T12:01:00.000Z", true, new Set(["catalyst:catalyst-record"]));

    expect(active).toEqual([]);
    expect(completedTrackedItemEvents(previous, candidates, [], "2026-07-29T12:01:00.000Z", 180_000))
      .toMatchObject([{ kind: "catalyst", id: "catalyst-record", percent: 100, objectives: [{ progress: 50, complete: true, percent: 100 }] }]);
  });

  it("hides requested Fireteam items and drops exclusions after the source is no longer tracked", () => {
    const items = trackedItemsFromQuests([
      quest({ instanceId: "shown", sitePinned: true }),
      quest({ instanceId: "hidden", inGameTracked: true })
    ]);

    expect(applyTrackedItemVisibility(items, ["quest:hidden", "quest:stale", "quest:hidden"])).toEqual({
      items: [expect.objectContaining({ id: "shown" })],
      hiddenKeys: ["quest:hidden"]
    });
  });

  it("emits a short-lived completion event only for a previously shared item with confirmed completion", () => {
    const previous = trackedItemsFromQuests([quest({ instanceId: "complete", sitePinned: true })]);
    const candidates = trackedItemsFromQuests(
      [quest({ instanceId: "complete", percent: 100 }), quest({ instanceId: "untracked-complete", percent: 100 })],
      true,
      new Set(["quest:complete", "quest:untracked-complete"])
    );
    const events = completedTrackedItemEvents(previous, candidates, [], "2026-07-22T12:01:00.000Z", 180_000);

    expect(events).toHaveLength(1);
    expect(events.map((event) => [event.id, event.completedAt])).toEqual([["complete", "2026-07-22T12:01:00.000Z"]]);
    expect(events.some((event) => event.id === "untracked-complete")).toBe(false);

    const retained = completedTrackedItemEvents(previous, candidates, events, "2026-07-22T12:02:00.000Z", 180_000);
    expect(retained).toEqual(events);
  });

  it("treats a tracked quest removed from inventory as complete but preserves manual untracking as dismissal", () => {
    const previous = trackedItemsFromQuests([
      quest({ instanceId: "finished", inGameTracked: true }),
      quest({ instanceId: "untracked", inGameTracked: true }),
      quest({ instanceId: "expired-bounty", category: "bounty", inGameTracked: true })
    ]);
    const currentQuests = [
      quest({ instanceId: "untracked", inGameTracked: false }),
      quest({ instanceId: "next", inGameTracked: true })
    ];
    const inferred = missingTrackedQuestCompletionKeys(previous, currentQuests);
    const events = completedTrackedItemEvents(previous, [], [], "2026-07-22T12:01:00.000Z", 180_000, inferred);

    expect([...inferred]).toEqual(["quest:finished"]);
    expect(events).toMatchObject([{ kind: "quest", id: "finished", percent: 100 }]);
    expect(events.some((event) => event.id === "untracked" || event.id === "expired-bounty")).toBe(false);
    expect(trackedItemsFromQuests(currentQuests).map((item) => item.id)).toEqual(["next"]);
  });
});

function collection(owned: boolean): CollectionData {
  return {
    manifestVersion: "test",
    entries: [{
      itemHash: "exotic-1",
      name: "Test Exotic",
      description: "An Exotic.",
      icon: "/exotic.png",
      kind: "weapon" as const,
      slot: "Kinetic",
      itemType: "Exotic Auto Rifle",
      source: "Exotic mission",
      owned,
      catalyst: "unavailable" as const,
      xurSelling: false,
      guide: {
        itemHash: "exotic-1",
        acquisition: "Complete the Exotic mission.",
        steps: ["Launch the mission.", "Claim the reward."],
        prerequisites: ["Finish the introduction."],
        confidence: "verified" as const,
        sources: []
      }
    }],
    totals: { owned: owned ? 1 : 0, available: 1, catalystsAvailable: 0, catalystsOwned: 0, catalystsComplete: 0, xurSelling: 0 },
    xur: { state: "unavailable" as const, checkedAt: "2026-07-29T12:00:00.000Z" }
  };
}

function catalystCollection(state: "obtained" | "complete", progress: number) {
  const data = collection(true);
  data.entries[0]!.catalyst = state;
  data.entries[0]!.catalysts = [{
    recordHash: "catalyst-record",
    name: "ABC Catalyst",
    description: "Defeat enemies using ABC.",
    icon: "/catalyst.png",
    state,
    objectives: [{ objectiveHash: "kills", name: "Kill enemies", progress, completionValue: 50, complete: state === "complete", percent: progress * 2 }],
    percent: progress * 2,
    progressAvailable: true,
    trackedInDestiny: false
  }];
  return data;
}

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
