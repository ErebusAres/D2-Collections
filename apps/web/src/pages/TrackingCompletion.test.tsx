// @vitest-environment jsdom

import type { ApiEnvelope, GuardianRankData, QuestData, QuestProgress } from "@guardian-nexus/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../services/api/client";
import { GuardianRankPage } from "./GuardianRankPage";
import { QuestsPage } from "./QuestsPage";

const setPreference = vi.fn();
let preferences: Record<string, string> = {};

vi.mock("../context/GuardianContext", () => ({
  pinsKey: (membershipId: string, characterId: string) => `pins:${membershipId}:${characterId}`,
  useGuardian: () => ({
    session: { authenticated: true, guardian: { membershipId: "member-1" } },
    loading: false,
    selectedCharacterId: "c1",
    autoRefresh: false,
    preferences,
    setPreference,
    signIn: vi.fn(),
    refresh: vi.fn()
  })
}));
vi.mock("../services/api/client", () => ({ api: vi.fn() }));

beforeEach(() => {
  preferences = {};
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("tracked objective completion", () => {
  it("announces a newly completed quest and removes its site pin", async () => {
    const client = queryClient();
    const quest = trackedQuest();
    let response = questEnvelope(quest);
    vi.mocked(api).mockImplementation(async () => response);
    localStorage.setItem("pins:member-1:c1", JSON.stringify([quest.instanceId]));

    render(<QueryClientProvider client={client}><MemoryRouter><QuestsPage /></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByText("Tracked quest")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();

    response = questEnvelope({
      ...quest,
      percent: 100,
      objectives: [{ objectiveHash: "objective", name: "Objective", progress: 10, completionValue: 10, complete: true, percent: 100 }]
    });
    await act(async () => { await client.invalidateQueries({ queryKey: ["quests"] }); });

    expect((await screen.findByRole("status")).textContent).toContain("Quest complete");
    expect(screen.getByRole("status").textContent).toContain("Removed from Guardian Nexus tracking");
    await waitFor(() => expect(localStorage.getItem("pins:member-1:c1")).toBe("[]"));
  });

  it("announces a newly completed Guardian Rank objective and removes site tracking", async () => {
    const client = queryClient();
    preferences = { "guardianRank.tracked": JSON.stringify(["record"]) };
    let response = rankEnvelope(false);
    vi.mocked(api).mockImplementation(async () => response);

    render(<QueryClientProvider client={client}><MemoryRouter><GuardianRankPage /></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByText("Rank objective")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();

    response = rankEnvelope(true);
    await act(async () => { await client.invalidateQueries({ queryKey: ["guardian-rank"] }); });

    expect((await screen.findByRole("status")).textContent).toContain("Guardian Rank objective complete");
    expect(screen.getByRole("status").textContent).toContain("Rank objective");
    expect(setPreference).toHaveBeenCalledWith("guardianRank.tracked", "[]");
  });
});

function queryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
}

function questEnvelope(quest: QuestProgress): ApiEnvelope<QuestData> {
  return envelope({ quests: [quest], recommendations: [], currentActivity: "Orbit" });
}

function trackedQuest(): QuestProgress {
  return {
    instanceId: "quest",
    itemHash: "100",
    name: "Tracked quest",
    description: "Complete it.",
    icon: "",
    currentStep: "Finish the objective.",
    characterId: "c1",
    inGameTracked: false,
    sitePinned: true,
    isExoticUnlock: false,
    rewards: [],
    objectives: [{ objectiveHash: "objective", name: "Objective", progress: 8, completionValue: 10, complete: false, percent: 80 }],
    percent: 80,
    updatedAt: "2026-07-22T12:00:00.000Z",
    category: "quest"
  };
}

function rankEnvelope(complete: boolean): ApiEnvelope<GuardianRankData> {
  return envelope({
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
      completed: complete ? 1 : 0,
      total: 1,
      categories: [{
        nodeHash: "category",
        name: "Journey",
        description: "",
        icon: "",
        seasonal: false,
        completed: complete ? 1 : 0,
        total: 1,
        quests: [{
          recordHash: "record",
          name: "Rank objective",
          description: "Complete activities.",
          icon: "",
          state: complete ? "completed" : "in-progress",
          trackedInDestiny: false,
          objectives: [{ objectiveHash: "objective", name: "Activities", progress: complete ? 10 : 8, completionValue: 10, percent: complete ? 100 : 80, complete, progressAvailable: true }]
        }]
      }]
    }],
    sources: { ranks: "DestinyProfileComponent and DestinyGuardianRankDefinition", objectives: "DestinyPresentationNodeDefinition, DestinyRecordDefinition, and profile records (component 900)" }
  });
}

function envelope<T>(data: T): ApiEnvelope<T> {
  return {
    data,
    freshness: { state: "fresh", observedAt: "2026-07-22T12:00:00.000Z" },
    warnings: [],
    requestId: "tracking-completion"
  };
}
