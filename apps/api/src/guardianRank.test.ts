import { describe, expect, it } from "vitest";
import type { GuardianRankManifest } from "@guardian-nexus/contracts";
import { normalizeGuardianRanks } from "./guardianRank";

const manifest: GuardianRankManifest = {
  version: "test",
  generatedAt: "now",
  rootNodeHash: "root",
  maximumRank: 8,
  ranks: [
    { hash: "6", rankNumber: 6, name: "Veteran", description: "Rank six", icon: "/six.png", foregroundImage: "", overlayImage: "", presentationNodeHash: "rank6" },
    { hash: "7", rankNumber: 7, name: "Elite", description: "Rank seven", icon: "/seven.png", foregroundImage: "", overlayImage: "", presentationNodeHash: "rank7" }
  ],
  nodes: {
    rank6: { hash: "rank6", name: "Veteran", description: "", icon: "", seasonal: false, childNodeHashes: ["cat6"], recordHashes: [] },
    rank7: { hash: "rank7", name: "Elite", description: "", icon: "", seasonal: false, childNodeHashes: ["cat7"], recordHashes: [] },
    cat6: { hash: "cat6", name: "Power", description: "", icon: "", seasonal: false, childNodeHashes: [], recordHashes: ["record6"] },
    cat7: { hash: "cat7", name: "Journey", description: "", icon: "", seasonal: true, childNodeHashes: [], recordHashes: ["record7"] }
  },
  records: {
    record6: { hash: "record6", name: "Ascension", description: "Reach the target.", icon: "", scope: 0, objectiveHashes: ["objective6"] },
    record7: { hash: "record7", name: "Service", description: "Complete activities.", icon: "", scope: 1, objectiveHashes: ["objective7"] }
  },
  objectives: {
    objective6: { hash: "objective6", name: "Reach Power", description: "", completionValue: 1 },
    objective7: { hash: "objective7", name: "Activities", description: "", completionValue: 10 }
  }
};

describe("normalizeGuardianRanks", () => {
  it("uses the current displayed rank while retaining the renewed floor separately", () => {
    const profile = {
      profile: { data: { currentGuardianRank: 8, renewedGuardianRank: 6, lifetimeHighestGuardianRank: 8 } },
      profileRecords: { data: { trackedRecordHash: 100, records: { record6: { state: 1, objectives: [{ objectiveHash: "objective6", progress: 1, completionValue: 1, complete: true }] } } } },
      characterRecords: { data: { c1: { trackedRecordHash: "record7", records: { record7: { state: 4, objectives: [{ objectiveHash: "objective7", progress: 4, completionValue: 10, complete: false }] } } } } }
    };

    const data = normalizeGuardianRanks(profile, manifest, "c1");
    expect(data).toMatchObject({ currentRank: 8, renewedRank: 6, highestAchievedRank: 8, lifetimeHighestRank: 8, maximumRank: 8, suggestedRank: 7 });
    expect(data.ranks[0]).toMatchObject({ state: "previous", completed: 1, total: 1 });
    expect(data.ranks[1]).toMatchObject({ state: "previous", completed: 0, total: 1 });
    expect(data.ranks).toHaveLength(2);
    expect(data.ranks[1]?.categories[0]?.quests[0]).toMatchObject({ state: "in-progress", trackedInDestiny: true, objectives: [{ progress: 4, completionValue: 10, percent: 40, progressAvailable: true }] });
  });

  it("marks missing live rows unavailable instead of inventing completion", () => {
    const data = normalizeGuardianRanks({ profile: { data: { currentGuardianRank: 6 } } }, manifest, "c1");
    expect(data.ranks[1]?.categories[0]?.quests[0]).toMatchObject({ state: "unavailable", objectives: [{ progress: 0, progressAvailable: false }] });
  });

  it("defaults to the objective-backed current rank and shows its next-rank requirements", () => {
    const data = normalizeGuardianRanks({ profile: { data: { currentGuardianRank: 7, renewedGuardianRank: 6, lifetimeHighestGuardianRank: 8 } } }, manifest, "c1");

    expect(data).toMatchObject({ currentRank: 7, renewedRank: 6, highestAchievedRank: 7, maximumRank: 8, suggestedRank: 7 });
    expect(data.ranks[1]).toMatchObject({ rankNumber: 7, state: "current", total: 1 });
    expect(data.ranks).toHaveLength(2);
  });

  it("selects the highest objective-backed rank when the current rank is the hidden terminal rank", () => {
    const data = normalizeGuardianRanks({ profile: { data: { currentGuardianRank: 8, renewedGuardianRank: 8, lifetimeHighestGuardianRank: 8 } } }, manifest, "c1");

    expect(data).toMatchObject({ currentRank: 8, maximumRank: 8, suggestedRank: 7 });
    expect(data.ranks.map((rank) => rank.rankNumber)).toEqual([6, 7]);
  });
});
