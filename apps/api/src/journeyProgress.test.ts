import { describe, expect, it } from "vitest";
import type { CompactManifest, JourneyProgressManifest } from "@guardian-nexus/contracts";
import { normalizeJourneyProgress, trackedItemsFromJourney } from "./journeyProgress";

describe("Journey progress", () => {
  it("normalizes record, weekly, and artifact progress for tracking", () => {
    const manifest: JourneyProgressManifest = {
      version: "test",
      generatedAt: "2026-07-28T12:00:00.000Z",
      records: {
        "10": {
          hash: "10",
          name: "Seal record",
          description: "Complete the seal",
          icon: "",
          type: "Triumph",
          title: "Star Baker",
          score: 10,
          scope: 0,
          objectiveHashes: ["20"],
          parentNodeHashes: ["30"]
        },
        "11": {
          hash: "11",
          name: "Hidden old challenge",
          description: "Do not render this",
          icon: "",
          type: "Seasonal Challenge",
          title: "",
          score: 0,
          scope: 0,
          objectiveHashes: ["20"],
          parentNodeHashes: ["30"]
        }
      },
      objectives: {
        "20": { hash: "20", name: "Bake cookies", description: "", completionValue: 10 }
      },
      nodes: {
        "30": { hash: "30", name: "Event seal", description: "", icon: "" }
      }
    };
    const activities = {
      version: "test",
      activityDefinitions: {
        "40": { hash: "40", displayProperties: { name: "Ritual activity", description: "Complete matches" } },
        "41": { hash: "41", displayProperties: { name: "Iron Banner: Control", description: "Fight alongside the Iron Lords" } }
      },
      objectiveDefinitions: {
        "50": { hash: "50", progressDescription: "Matches", completionValue: 3 }
      }
    } as unknown as CompactManifest;
    const profile = {
      profileRecords: {
        data: {
          score: { activeScore: 1234, lifetimeScore: 5678, legacyScore: 90 },
          trackedRecordHash: 10,
          records: {
            "10": { state: 0, objectives: [{ objectiveHash: 20, progress: 7, completionValue: 10, complete: false }] }
            ,"11": { state: 16, objectives: [{ objectiveHash: 20, progress: 0, completionValue: 10, complete: false }] }
          }
        }
      },
      characterActivities: {
        data: {
          char: {
            availableActivities: [{
              activityHash: 40,
              challenges: [{ objectiveHash: 50, progress: 2, completionValue: 3, complete: false }]
            }, {
              activityHash: 40,
              challenges: [{ objectiveHash: 50, progress: 1, completionValue: 3, complete: false }]
            }, { activityHash: 41 }]
          }
        }
      },
      characterProgressions: {
        data: {
          char: {
            seasonalArtifact: {
              artifactHash: 60,
              pointsAcquired: 8,
              pointsUsed: 5,
              powerBonusProgression: { level: 4, progressToNextLevel: 250, nextLevelAt: 500 }
            }
          }
        }
      }
    };

    const data = normalizeJourneyProgress(profile, manifest, activities, "char");

    expect(data.triumphScore.active).toBe(1234);
    expect(data.titles[0]).toMatchObject({ title: "Star Baker", percent: 70, tracked: true });
    expect(data.weeklyChallenges[0]).toMatchObject({ id: "40:50", name: "Ritual activity" });
    expect(data.weeklyChallenges[0]?.objective).toMatchObject({ progress: 2, completionValue: 3, percent: 66 });
    expect(data.weeklyChallenges).toHaveLength(1);
    expect(data.seasonalChallenges).toEqual([]);
    expect(data.currentActivities).toEqual([expect.objectContaining({ activityHash: "41", name: "Iron Banner: Control" })]);
    expect(data.artifact).toMatchObject({ pointsAcquired: 8, pointsSpent: 5, powerBonus: 4 });

    const tracked = trackedItemsFromJourney(data, new Set(["10", "40:50"]), "2026-07-28T12:00:00.000Z");
    expect(tracked).toHaveLength(2);
    expect(tracked.map((item) => item.kind)).toEqual(["title", "weekly"]);
  });
});
