// @vitest-environment jsdom

import type { FireteamData, QuestProgress } from "@guardian-nexus/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, queuedApi } from "../services/api/client";
import { FireteamV2Route } from "./FireteamV2Route";

vi.mock("../context/GuardianContext", () => ({
  useGuardian: () => ({
    session: { authenticated: true, csrfToken: "csrf", guardian: { membershipId: "member-1" } },
    selectedCharacterId: "c1",
    autoRefresh: true,
    preferences: {}
  })
}));
vi.mock("../services/api/client", () => ({ api: vi.fn(), queuedApi: vi.fn(), mutationHeaders: vi.fn(() => ({})) }));
vi.mock("./FireteamPage", () => ({ FireteamPage: ({ version }: { version?: string }) => <div>Fireteam content {version}</div> }));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Fireteam v2 page", () => {
  it("uses only the committed v2 deadline and never resets on the same snapshot", async () => {
    vi.setSystemTime("2026-08-20T11:57:00.000Z");
    let version = 4;
    let committedAt = "2026-08-20T11:55:00.000Z";
    vi.mocked(api).mockImplementation(async () => v2Envelope(version, committedAt));

    renderV2();
    expect(await screen.findByText("Fireteam v2 refresh in 3:00")).toBeTruthy();
    expect(vi.mocked(api)).toHaveBeenCalledTimes(1);

    await act(async () => { vi.advanceTimersByTime(3 * 60_000); });
    await waitFor(() => expect(vi.mocked(api)).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Refreshing Fireteam v2")).toBeTruthy();

    await act(async () => { vi.advanceTimersByTime(5_000); });
    await waitFor(() => expect(vi.mocked(api)).toHaveBeenCalledTimes(3));
    expect(screen.getByText("Refreshing Fireteam v2")).toBeTruthy();

    version = 5;
    committedAt = new Date(Date.now()).toISOString();
    await act(async () => { vi.advanceTimersByTime(5_000); });
    await waitFor(() => expect(screen.getByText("Fireteam v2 refresh in 4:55")).toBeTruthy());
  });

  it("derives tracked Hub orders from the same v2 snapshot without a quest endpoint", async () => {
    vi.mocked(api).mockResolvedValue(v2Envelope(1, new Date(Date.now()).toISOString(), [order()]));
    renderV2();
    expect(await screen.findByText("Tracked in Destiny · 1")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Atomic order/ }).getAttribute("href")).toBe("/quests/order-1");
    expect(vi.mocked(api).mock.calls.every(([path]) => String(path).startsWith("/api/v2/fireteam?"))).toBe(true);
    expect(queuedApi).not.toHaveBeenCalled();
  });

  it("waits for the backend when no v2 snapshot has committed", async () => {
    vi.mocked(api).mockResolvedValue(v2Envelope(0));
    renderV2();
    expect(await screen.findByText("Preparing Fireteam v2 snapshot")).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(5_000); });
    await waitFor(() => expect(vi.mocked(api).mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(queuedApi).not.toHaveBeenCalled();
  });

  it("shows and honors the backend retry deadline after a delayed refresh", async () => {
    vi.setSystemTime("2026-08-20T12:00:00.000Z");
    const response = v2Envelope(4, "2026-08-20T11:55:00.000Z");
    response.data.refreshState = "delayed";
    response.data.refreshRetryAt = "2026-08-20T12:01:00.000Z";
    vi.mocked(api).mockResolvedValue(response);

    renderV2();
    expect(await screen.findByText("Fireteam v2 retry in 1:00")).toBeTruthy();
    expect(vi.mocked(api)).toHaveBeenCalledTimes(1);

    await act(async () => { vi.advanceTimersByTime(59_000); });
    expect(vi.mocked(api)).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(1_000); });
    await waitFor(() => expect(vi.mocked(api)).toHaveBeenCalledTimes(2));
  });
});

function renderV2() {
  render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><FireteamV2Route /></QueryClientProvider></MemoryRouter>);
}

function v2Envelope(snapshotVersion: number, committedAt?: string, quests: QuestProgress[] = []) {
  const pageRefreshDueAt = committedAt ? new Date(Date.parse(committedAt) + 5 * 60_000).toISOString() : undefined;
  const data: FireteamData = {
    sharingEnabled: true,
    sharingMode: "persistent",
    snapshotVersion,
    pageUpdatedAt: committedAt,
    pageRefreshDueAt,
    refreshState: snapshotVersion ? "current" : "waiting",
    members: snapshotVersion ? [{
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
      trackedItems: [],
      quests,
      overlaps: [],
      freshness: { state: "fresh", observedAt: committedAt!, ageSeconds: 0 }
    }] : []
  };
  return { data, freshness: { state: snapshotVersion ? "fresh" as const : "stale" as const, observedAt: committedAt || new Date().toISOString() }, warnings: [], requestId: "v2" };
}

function order(): QuestProgress {
  return {
    instanceId: "order-1",
    itemHash: "hash-1",
    name: "Atomic order",
    description: "One snapshot.",
    itemType: "Order",
    icon: "",
    currentStep: "Defeat targets",
    characterId: "c1",
    inGameTracked: true,
    sitePinned: false,
    isExoticUnlock: false,
    rewards: [],
    objectives: [{ objectiveHash: "objective-1", name: "Defeat targets", progress: 2, completionValue: 5, complete: false, percent: 40 }],
    percent: 40,
    updatedAt: "2026-08-20T11:55:00.000Z",
    category: "order"
  };
}
