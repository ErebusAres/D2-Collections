// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { GuardianRankData } from "@guardian-nexus/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../services/api/client";
import { GuardianRankPage } from "./GuardianRankPage";

const setPreference = vi.fn();
vi.mock("../context/GuardianContext", () => ({
  useGuardian: () => ({ session: { authenticated: true }, selectedCharacterId: "c1", autoRefresh: false, preferences: { "guardianRank.tracked": "[]" }, setPreference })
}));
vi.mock("../services/api/client", () => ({ api: vi.fn() }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Guardian Rank page", () => {
  it("opens on the next rank, keeps previous ranks available, and saves tracked objectives", async () => {
    vi.mocked(api).mockResolvedValue(envelope());
    renderPage();

    expect(await screen.findByRole("heading", { name: "Elite" })).toBeTruthy();
    expect(screen.getByText("4 / 10")).toBeTruthy();
    expect(screen.getByRole("button", { name: "View rank 6: Veteran" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Track Service" }));
    expect(setPreference).toHaveBeenCalledWith("guardianRank.tracked", JSON.stringify(["record7"]));

    fireEvent.click(screen.getByRole("button", { name: "View rank 6: Veteran" }));
    expect(await screen.findByRole("heading", { name: "Veteran" })).toBeTruthy();
    expect(screen.getByText("Ascension")).toBeTruthy();
  });
});

function renderPage() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><GuardianRankPage /></QueryClientProvider>);
}

function envelope() {
  const data: GuardianRankData = {
    currentRank: 6,
    renewedRank: 6,
    lifetimeHighestRank: 8,
    suggestedRank: 7,
    ranks: [
      { rankHash: "6", rankNumber: 6, name: "Veteran", description: "Current rank", icon: "", foregroundImage: "", overlayImage: "", state: "current", completed: 1, total: 1, categories: [{ nodeHash: "cat6", name: "Power", description: "", icon: "", seasonal: false, completed: 1, total: 1, quests: [{ recordHash: "record6", name: "Ascension", description: "Reach the target.", icon: "", state: "completed", trackedInDestiny: false, objectives: [{ objectiveHash: "objective6", name: "Reach Power", progress: 1, completionValue: 1, percent: 100, complete: true, progressAvailable: true }] }] }] },
      { rankHash: "7", rankNumber: 7, name: "Elite", description: "Next rank", icon: "", foregroundImage: "", overlayImage: "", state: "next", completed: 0, total: 1, categories: [{ nodeHash: "cat7", name: "Journey", description: "", icon: "", seasonal: false, completed: 0, total: 1, quests: [{ recordHash: "record7", name: "Service", description: "Complete activities.", icon: "", state: "in-progress", trackedInDestiny: false, objectives: [{ objectiveHash: "objective7", name: "Activities", progress: 4, completionValue: 10, percent: 40, complete: false, progressAvailable: true }] }] }] }
    ],
    sources: { ranks: "DestinyProfileComponent and DestinyGuardianRankDefinition", objectives: "DestinyPresentationNodeDefinition, DestinyRecordDefinition, and profile records (component 900)" }
  };
  return { data, freshness: { state: "fresh" as const, observedAt: "2026-07-21T12:00:00Z" }, warnings: [], requestId: "rank-test" };
}
