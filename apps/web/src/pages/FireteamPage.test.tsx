// @vitest-environment jsdom

import type { FireteamData } from "@guardian-nexus/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, queuedApi } from "../services/api/client";
import { FireteamPage } from "./FireteamPage";

vi.mock("../context/GuardianContext", () => ({
  pinsKey: (membershipId: string, characterId: string) => `pins:${membershipId}:${characterId}`,
  useGuardian: () => ({
    session: { authenticated: true, csrfToken: "csrf", guardian: { membershipId: "member-1" } },
    selectedCharacterId: "c1",
    autoRefresh: false,
    preferences: { "guardianRank.tracked": JSON.stringify(["rank-record"]) }
  })
}));
vi.mock("../services/api/client", () => ({ api: vi.fn(), queuedApi: vi.fn(), mutationHeaders: vi.fn(() => ({})) }));

beforeEach(() => {
  localStorage.setItem("pins:member-1:c1", JSON.stringify(["quest-instance"]));
  vi.mocked(api).mockResolvedValue(envelope());
  vi.mocked(queuedApi).mockResolvedValue({ data: { sharing: true }, freshness: { state: "fresh", observedAt: "now" }, warnings: [], requestId: "share" });
});

afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });

describe("Fireteam tracked items", () => {
  it("shows quest-like and Guardian Rank tracking and refreshes the active share with both site lists", async () => {
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><FireteamPage /></QueryClientProvider>);

    expect(await screen.findByText("Shared tracked items")).toBeTruthy();
    expect(screen.getByText("Weekly order")).toBeTruthy();
    expect(screen.getByText("Order · Vanguard")).toBeTruthy();
    expect(screen.getByText("Rank service")).toBeTruthy();
    expect(screen.getByText("Guardian Rank · Journey · Progress to rank 8")).toBeTruthy();

    await waitFor(() => expect(vi.mocked(queuedApi)).toHaveBeenCalled());
    const [, init] = vi.mocked(queuedApi).mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toMatchObject({
      characterId: "c1",
      sitePinnedQuestIds: ["quest-instance"],
      siteTrackedGuardianRankIds: ["rank-record"],
      mode: "temporary"
    });
  });
});

function envelope() {
  const data: FireteamData = {
    sharingEnabled: true,
    sharingMode: "temporary",
    activity: "The Tower",
    members: [{
      membershipId: "member-1",
      displayName: "Guardian",
      inGameName: "Guardian#1234",
      presenceLabel: "Fireteam member",
      onlineState: "online",
      activity: "The Tower",
      activitySource: "shared",
      isSelf: true,
      isLeader: false,
      syncState: "synced",
      sharing: true,
      sharingMode: "temporary",
      trackedItems: [
        {
          id: "quest-instance", definitionHash: "quest-hash", kind: "order", name: "Weekly order", description: "Complete activities.", icon: "", context: "Order · Vanguard",
          trackedInDestiny: false, trackedInGuardianNexus: true, objectives: [{ objectiveHash: "q", name: "Activities", progress: 2, completionValue: 5, percent: 40, complete: false, progressAvailable: true }], percent: 40, updatedAt: "now"
        },
        {
          id: "rank-record", definitionHash: "rank-record", kind: "guardian-rank", name: "Rank service", description: "Earn commendations.", icon: "", context: "Guardian Rank · Journey · Progress to rank 8",
          trackedInDestiny: true, trackedInGuardianNexus: true, objectives: [{ objectiveHash: "r", name: "Commendations", progress: 4, completionValue: 10, percent: 40, complete: false, progressAvailable: true }], percent: 40, updatedAt: "now"
        }
      ],
      quests: [],
      overlaps: [],
      freshness: { state: "fresh", observedAt: "now", ageSeconds: 0 }
    }],
    social: { state: "available", friendsState: "available", clanState: "available", contacts: [] }
  };
  return { data, freshness: { state: "fresh" as const, observedAt: "now" }, warnings: [], requestId: "fireteam" };
}
