// @vitest-environment jsdom

import type { FireteamData } from "@guardian-nexus/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, queuedApi } from "../services/api/client";
import { FireteamRoute } from "./FireteamRoute";

vi.mock("../context/GuardianContext", () => ({
  pinsKey: (membershipId: string, characterId: string) => `pins:${membershipId}:${characterId}`,
  useGuardian: () => ({
    session: { authenticated: true, csrfToken: "csrf", guardian: { membershipId: "member-1" } },
    selectedCharacterId: "c1",
    autoRefresh: true,
    preferences: { "guardianRank.tracked": "[]", "journey.tracked": "[]" }
  })
}));
vi.mock("../services/api/client", () => ({ api: vi.fn(), queuedApi: vi.fn(), mutationHeaders: vi.fn(() => ({})) }));
vi.mock("./FireteamPage", () => ({ FireteamPage: () => <div>Fireteam content</div> }));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  localStorage.setItem("pins:member-1:c1", "[]");
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Fireteam refresh cycle", () => {
  it("finishes writing tracked progress before it reads the refreshed Fireteam snapshot", async () => {
    const calls: string[] = [];
    let finishWrite!: () => void;
    const writeFinished = new Promise<void>((resolve) => { finishWrite = resolve; });
    vi.mocked(api).mockImplementation(async () => {
      calls.push("read");
      return envelope();
    });
    vi.mocked(queuedApi).mockImplementation(async () => {
      calls.push("write");
      await writeFinished;
      return { data: { sharing: true }, freshness: { state: "fresh", observedAt: "now" }, warnings: [], requestId: "share" };
    });

    render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><FireteamRoute /></QueryClientProvider></MemoryRouter>);
    expect(await screen.findByText(/Tracked refresh in/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Seasonal Hub Orders" }).getAttribute("href")).toBe("/journey/season");
    expect(screen.getByRole("link", { name: /Weekly order/ }).getAttribute("href")).toBe("/quests/order-1");

    await act(async () => { vi.advanceTimersByTime(60_000); });
    await waitFor(() => expect(queuedApi).toHaveBeenCalledTimes(1));
    expect(calls).toEqual(["read", "write"]);

    finishWrite();
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
    expect(calls).toEqual(["read", "write", "read"]);
  });
});

function envelope() {
  const data: FireteamData = {
    sharingEnabled: true,
    sharingMode: "persistent",
    hiddenTrackedItemKeys: [],
    members: [{
      membershipId: "member-1",
      displayName: "Guardian",
      inGameName: "Guardian#1234",
      presenceLabel: "Fireteam member",
      onlineState: "online",
      activitySource: "shared",
      isSelf: true,
      isLeader: false,
      syncState: "synced",
      sharing: true,
      sharingMode: "persistent",
      trackedItems: [{
        id: "order-1",
        definitionHash: "order-hash",
        kind: "order",
        name: "Weekly order",
        description: "Complete activities.",
        icon: "",
        context: "Order · Seasonal Hub",
        trackedInDestiny: true,
        trackedInGuardianNexus: false,
        objectives: [{ objectiveHash: "objective-1", name: "Activities", progress: 2, completionValue: 5, percent: 40, complete: false, progressAvailable: true }],
        percent: 40,
        updatedAt: "now"
      }],
      quests: [],
      overlaps: [],
      freshness: { state: "fresh", observedAt: "now", ageSeconds: 0 }
    }],
    social: { state: "available", friendsState: "available", clanState: "available", contacts: [] }
  };
  return { data, freshness: { state: "fresh" as const, observedAt: "now" }, warnings: [], requestId: "fireteam" };
}
