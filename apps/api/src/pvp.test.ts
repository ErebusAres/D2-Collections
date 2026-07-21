import { describe, expect, it } from "vitest";
import type { RewardsManifest } from "@guardian-nexus/contracts";
import { normalizePvpData, normalizePvpProgressions } from "./pvp";

const manifest: RewardsManifest = {
  version: "test-manifest",
  generatedAt: "2026-07-21T00:00:00Z",
  seasonPassDefinitions: {},
  progressionDefinitions: {},
  itemDefinitions: {},
  pvpProgressionDefinitions: {
    "10": {
      kind: "crucible",
      displayProperties: { name: "Crucible Rank", description: "Earn reputation with Lord Shaxx." },
      steps: [
        { stepName: "Brave I", progressTotal: 250 },
        { stepName: "Brave II", progressTotal: 500, icon: "/rank.png" }
      ]
    },
    "20": {
      kind: "competitive",
      displayProperties: { name: "Competitive Division" },
      steps: [{ stepName: "Gold III", progressTotal: 5_750 }]
    }
  }
};

const profile = {
  characterProgressions: { data: {
    hunter: { progressions: {
      "10": { level: 7, stepIndex: 1, currentProgress: 4_250, progressToNextLevel: 250, nextLevelAt: 500, currentResetCount: 2 },
      "20": { level: 4, stepIndex: 0, currentProgress: 5_420, progressToNextLevel: 5_420, nextLevelAt: 5_750 }
    } }
  } }
};

describe("PvP normalization", () => {
  it("uses the manifest rank label and the exact live progression values", () => {
    const rows = normalizePvpProgressions(profile, manifest, "hunter");

    expect(rows[0]).toMatchObject({
      kind: "crucible",
      rankName: "Brave II",
      level: 7,
      currentProgress: 4_250,
      progressToNextLevel: 250,
      nextLevelAt: 500,
      percent: 50,
      resets: 2,
      icon: "https://www.bungie.net/rank.png"
    });
    expect(rows[1]).toMatchObject({ kind: "competitive", rankName: "Gold III", level: 4 });
  });

  it("aggregates account characters and recomputes ratios from Bungie's totals", () => {
    const data = normalizePvpData({
      profile,
      manifest,
      characterId: "hunter",
      historicalStats: [
        history({ matches: 10, wins: 6, kills: 70, deaths: 35, assists: 20, precision: 15, best: 18, spree: 7 }),
        history({ matches: 5, wins: 2, kills: 30, deaths: 20, assists: 10, precision: 5, best: 12, spree: 5 })
      ]
    });

    expect(data.primaryRank?.rankName).toBe("Brave II");
    expect(data.hasActivity).toBe(true);
    expect(data.overall).toMatchObject({
      matches: 15,
      wins: 8,
      winRate: 53.33,
      kills: 100,
      deaths: 55,
      assists: 30,
      kd: 1.82,
      efficiency: 2.36,
      precisionKills: 20,
      bestSingleGameKills: 18,
      longestKillSpree: 7
    });
  });

  it("returns an honest empty activity state when Bungie has no historical rows", () => {
    const data = normalizePvpData({ profile, manifest, characterId: "hunter", historicalStats: [] });

    expect(data.hasActivity).toBe(false);
    expect(data.overall.matches).toBe(0);
    expect(data.primaryRank?.level).toBe(7);
  });
});

function history(values: { matches: number; wins: number; kills: number; deaths: number; assists: number; precision: number; best: number; spree: number }) {
  const stat = (value: number) => ({ basic: { value } });
  return { allPvP: { allTime: {
    activitiesEntered: stat(values.matches),
    activitiesWon: stat(values.wins),
    kills: stat(values.kills),
    deaths: stat(values.deaths),
    assists: stat(values.assists),
    precisionKills: stat(values.precision),
    bestSingleGameKills: stat(values.best),
    longestKillSpree: stat(values.spree)
  } } };
}
