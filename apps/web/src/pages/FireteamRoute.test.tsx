// @vitest-environment jsdom

import type { FireteamData, QuestData, QuestProgress } from "@guardian-nexus/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, queuedApi } from "../services/api/client";
import { FireteamRoute } from "./FireteamRoute";

const guardianSettings = vi.hoisted(() => ({ autoRefresh: true }));

vi.mock("../context/GuardianContext", () => ({
  useGuardian: () => ({
    session: { authenticated: true, csrfToken: "csrf", guardian: { membershipId: "member-1" } },
    selectedCharacterId: "c1",
    autoRefresh: guardianSettings.autoRefresh,
    preferences: {}
  })
}));
vi.mock("../services/api/client", () => ({ api: vi.fn(), queuedApi: vi.fn(), mutationHeaders: vi.fn(() => ({})) }));
vi.mock("./FireteamPage", () => ({ FireteamPage: () => <div>Fireteam content</div> }));

beforeEach(() => {
  guardianSettings.autoRefresh = true;
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Fireteam page", () => {
  it("uses only the committed deadline and never resets on the same snapshot", async () => {
    vi.setSystemTime("2026-08-20T11:57:00.000Z");
    let version = 4;
    let committedAt = "2026-08-20T11:55:00.000Z";
    vi.mocked(api).mockImplementation(async (path) => String(path).startsWith("/api/v1/me/quests") ? questEnvelope() as never : fireteamEnvelope(version, committedAt));

    const client = renderFireteam();
    const refetchQueries = vi.spyOn(client, "refetchQueries");
    expect(await screen.findByText("Fireteam refresh in 3:00")).toBeTruthy();
    const fireteamCalls = () => vi.mocked(api).mock.calls.filter(([path]) => String(path).startsWith("/api/v2/fireteam?")).length;
    expect(fireteamCalls()).toBe(1);

    await act(async () => { vi.advanceTimersByTime(3 * 60_000); });
    await waitFor(() => expect(fireteamCalls()).toBe(2));
    expect(screen.getByText("Refreshing Fireteam")).toBeTruthy();

    await act(async () => { vi.advanceTimersByTime(60_000); });
    await waitFor(() => expect(fireteamCalls()).toBe(3));
    expect(screen.getByText("Refreshing Fireteam")).toBeTruthy();

    version = 5;
    committedAt = new Date(Date.now()).toISOString();
    await act(async () => { vi.advanceTimersByTime(60_000); });
    await waitFor(() => expect(screen.getByText(/Fireteam refresh in 4:00|Fireteam refresh in 3:59/)).toBeTruthy());
    expect(refetchQueries).toHaveBeenCalledWith({ queryKey: ["fireteam-recent-items", "c1"], exact: true, type: "active" });
    expect(refetchQueries).toHaveBeenCalledWith({ queryKey: ["fireteam-activity", "member-1", "c1"], exact: true, type: "active" });
  });

  it("loads every active Hub order independently without requiring Destiny tracking", async () => {
    vi.mocked(api).mockImplementation(async (path) => String(path).startsWith("/api/v1/me/quests") ? questEnvelope([order(false)]) as never : fireteamEnvelope(1, new Date(Date.now()).toISOString()));
    renderFireteam();
    expect(await screen.findByText("Active Orders · 1")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Atomic order/ }).getAttribute("href")).toBe("/quests/order-1");
    expect(vi.mocked(api).mock.calls.some(([path]) => String(path).startsWith("/api/v1/me/quests?"))).toBe(true);
    expect(queuedApi).not.toHaveBeenCalled();
  });

  it("waits for the backend when no snapshot has committed", async () => {
    vi.mocked(api).mockImplementation(async (path) => String(path).startsWith("/api/v1/me/quests") ? questEnvelope() as never : fireteamEnvelope(0));
    renderFireteam();
    expect(await screen.findByText("Preparing Fireteam snapshot")).toBeTruthy();
    const fireteamCalls = () => vi.mocked(api).mock.calls.filter(([path]) => String(path).startsWith("/api/v2/fireteam?")).length;
    await act(async () => { vi.advanceTimersByTime(60_000); });
    await waitFor(() => expect(fireteamCalls()).toBeGreaterThanOrEqual(2));
    expect(queuedApi).not.toHaveBeenCalled();
  });

  it("does not poll forever before the user enables sharing", async () => {
    const response = fireteamEnvelope(0);
    response.data.sharingEnabled = false;
    response.data.sharingMode = "off";
    vi.mocked(api).mockImplementation(async (path) => String(path).startsWith("/api/v1/me/quests") ? questEnvelope() as never : response);
    renderFireteam();
    expect(await screen.findByText("Share to enable Fireteam sync")).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(5 * 60_000); });
    expect(vi.mocked(api).mock.calls.filter(([path]) => String(path).startsWith("/api/v2/fireteam?")).length).toBe(1);
  });

  it("shows and honors the backend retry deadline after a delayed refresh", async () => {
    vi.setSystemTime("2026-08-20T12:00:00.000Z");
    const response = fireteamEnvelope(4, "2026-08-20T11:55:00.000Z");
    response.data.refreshState = "delayed";
    response.data.refreshRetryAt = "2026-08-20T12:01:00.000Z";
    vi.mocked(api).mockImplementation(async (path) => String(path).startsWith("/api/v1/me/quests") ? questEnvelope() as never : response);

    renderFireteam();
    expect(await screen.findByText("Fireteam retry in 1:00")).toBeTruthy();
    const fireteamCalls = () => vi.mocked(api).mock.calls.filter(([path]) => String(path).startsWith("/api/v2/fireteam?")).length;
    expect(fireteamCalls()).toBe(1);

    await act(async () => { vi.advanceTimersByTime(59_000); });
    expect(fireteamCalls()).toBe(1);
    await act(async () => { vi.advanceTimersByTime(1_000); });
    await waitFor(() => expect(fireteamCalls()).toBe(2));
    expect(screen.getByText("Fireteam refresh delayed")).toBeTruthy();
  });

  it("honors the global auto-refresh setting without hiding committed data", async () => {
    guardianSettings.autoRefresh = false;
    vi.mocked(api).mockImplementation(async (path) => String(path).startsWith("/api/v1/me/quests") ? questEnvelope() as never : fireteamEnvelope(2, "2026-08-20T11:55:00.000Z"));
    renderFireteam();

    expect(await screen.findByText("Fireteam refresh off")).toBeTruthy();
    expect(screen.getByText("Fireteam content")).toBeTruthy();
    expect(vi.mocked(api).mock.calls.filter(([path]) => String(path).startsWith("/api/v2/fireteam?")).length).toBe(1);
  });
});

function renderFireteam() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<MemoryRouter><QueryClientProvider client={client}><FireteamRoute /></QueryClientProvider></MemoryRouter>);
  return client;
}

function fireteamEnvelope(snapshotVersion: number, committedAt?: string, quests: QuestProgress[] = []) {
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
  return { data, freshness: { state: snapshotVersion ? "fresh" as const : "stale" as const, observedAt: committedAt || new Date().toISOString() }, warnings: [], requestId: "fireteam" };
}

function order(inGameTracked = true): QuestProgress {
  return {
    instanceId: "order-1",
    itemHash: "hash-1",
    name: "Atomic order",
    description: "One snapshot.",
    itemType: "Order",
    icon: "",
    currentStep: "Defeat targets",
    characterId: "c1",
    inGameTracked,
    sitePinned: false,
    isExoticUnlock: false,
    rewards: [],
    objectives: [{ objectiveHash: "objective-1", name: "Defeat targets", progress: 2, completionValue: 5, complete: false, percent: 40 }],
    percent: 40,
    updatedAt: "2026-08-20T11:55:00.000Z",
    category: "order"
  };
}

function questEnvelope(quests: QuestProgress[] = []) {
  const data: QuestData = { quests, recommendations: [] };
  return { data, freshness: { state: "fresh" as const, observedAt: new Date().toISOString() }, warnings: [], requestId: "quests" };
}
