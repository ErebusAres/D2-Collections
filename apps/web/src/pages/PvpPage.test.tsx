// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PvpData } from "@guardian-nexus/contracts";
import { api } from "../services/api/client";
import { PvpPage } from "./PvpPage";

vi.mock("../context/GuardianContext", () => ({
  useGuardian: () => ({
    session: { authenticated: true },
    selectedCharacterId: "hunter",
    autoRefresh: false
  })
}));

vi.mock("../services/api/client", () => ({ api: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PvP page", () => {
  it("shows the live Crucible rank, account totals, and mode breakdown", async () => {
    vi.mocked(api).mockResolvedValue(envelope(pvpData()));
    renderPage();

    expect(await screen.findByRole("heading", { name: "Brave II" })).toBeTruthy();
    expect(screen.getByText((_, element) => element?.tagName === "P" && Boolean(element.textContent?.includes("Live rank 7")))).toBeTruthy();
    expect(screen.getByText("53.33%")).toBeTruthy();
    expect(screen.getByText("100")).toBeTruthy();
    expect(screen.getAllByText("Gold III")).toHaveLength(2);
    expect(screen.getByText("Bungie returned no historical matches for this playlist.")).toBeTruthy();
  });

  it("uses the no-history state without hiding a rank Bungie still returned", async () => {
    const data = pvpData();
    data.hasActivity = false;
    data.overall = { ...data.overall, matches: 0, wins: 0, kills: 0, deaths: 0, assists: 0, winRate: 0, kd: 0, efficiency: 0 };
    vi.mocked(api).mockResolvedValue(envelope(data));
    renderPage();

    expect(await screen.findByRole("heading", { name: "This Guardian has no public PvP record yet" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Brave II" })).toBeTruthy();
  });
});

function renderPage() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><PvpPage /></QueryClientProvider>);
}

function envelope(data: PvpData) {
  return { data, freshness: { state: "fresh" as const, observedAt: "2026-07-21T12:00:00Z" }, warnings: [], requestId: "pvp-test" };
}

function pvpData(): PvpData {
  const crucible = { kind: "crucible" as const, progressionHash: "10", name: "Crucible Rank", description: "", icon: "", rankName: "Brave II", level: 7, stepIndex: 1, currentProgress: 4_250, progressToNextLevel: 250, nextLevelAt: 500, percent: 50, resets: 2 };
  const competitive = { ...crucible, kind: "competitive" as const, progressionHash: "20", name: "Competitive Division", rankName: "Gold III", level: 4, resets: 0 };
  return {
    characterId: "hunter",
    manifestVersion: "test",
    primaryRank: crucible,
    progressions: [crucible, competitive],
    hasActivity: true,
    overall: { kind: "all", name: "All Crucible", mode: 5, matches: 15, wins: 8, winRate: 53.33, kills: 100, deaths: 55, assists: 30, kd: 1.82, efficiency: 2.36, precisionKills: 20, bestSingleGameKills: 18, longestKillSpree: 7 },
    modes: [
      { kind: "competitive", name: "Competitive", mode: 69, matches: 10, wins: 6, winRate: 60, kills: 70, deaths: 35, assists: 20, kd: 2, efficiency: 2.57, precisionKills: 15, bestSingleGameKills: 18, longestKillSpree: 7 },
      { kind: "trials", name: "Trials of Osiris", mode: 84, matches: 0, wins: 0, winRate: 0, kills: 0, deaths: 0, assists: 0, kd: 0, efficiency: 0, precisionKills: 0, bestSingleGameKills: 0, longestKillSpree: 0 },
      { kind: "iron-banner", name: "Iron Banner", mode: 19, matches: 5, wins: 2, winRate: 40, kills: 30, deaths: 20, assists: 10, kd: 1.5, efficiency: 2, precisionKills: 5, bestSingleGameKills: 12, longestKillSpree: 5 }
    ],
    sources: {
      ranks: "Destiny2.GetProfile characterProgressions (component 202) and DestinyProgressionDefinition manifest data",
      stats: "Destiny2.GetHistoricalStats across the account's characters"
    }
  };
}
