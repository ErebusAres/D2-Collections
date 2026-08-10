// @vitest-environment jsdom

import type { FireteamData, QuestData, QuestProgress } from "@guardian-nexus/contracts";
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
  vi.mocked(queuedApi).mockResolvedValue({ data: { sharing: true }, freshness: { state: "fresh", observedAt: "now" }, warnings: [], requestId: "share" });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Fireteam refresh cycle", () => {
  it("refreshes presence independently while a tracked-progress write is queued", async () => {
    let fireteamReads = 0;
    let orderReads = 0;
    let finishWrite!: () => void;
    const writeFinished = new Promise<void>((resolve) => { finishWrite = resolve; });
    vi.mocked(api).mockImplementation(async (path) => {
      if (path.startsWith("/api/v1/me/quests")) {
        orderReads += 1;
        return ordersEnvelope();
      }
      fireteamReads += 1;
      return envelope("temporary");
    });
    vi.mocked(queuedApi).mockImplementation(async () => {
      await writeFinished;
      return { data: { sharing: true }, freshness: { state: "fresh", observedAt: "now" }, warnings: [], requestId: "share" };
    });

    render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><FireteamRoute /></QueryClientProvider></MemoryRouter>);
    expect(await screen.findByText(/Fireteam refresh in/)).toBeTruthy();
    expect(await screen.findByText("Active in Destiny · 6")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Seasonal Hub Orders" }).getAttribute("href")).toBe("/journey/season");
    expect(screen.getByRole("link", { name: /Hub order 1/ }).getAttribute("href")).toBe("/quests/order-1");
    expect(screen.getByRole("img", { name: "Trace Rifle" }).getAttribute("title")).toBe("Trace Rifle");
    expect(screen.queryByText("[Trace Rifle]", { exact: false })).toBeNull();
    await waitFor(() => expect(fireteamReads).toBe(1));
    expect(orderReads).toBe(1);

    await act(async () => { vi.advanceTimersByTime(60_000); });
    await waitFor(() => expect(fireteamReads).toBe(2));
    expect(orderReads).toBe(1);
    expect(queuedApi).not.toHaveBeenCalled();

    await act(async () => { vi.advanceTimersByTime(4 * 60_000); });
    await waitFor(() => expect(queuedApi).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(vi.mocked(queuedApi).mock.calls[0]?.[1]?.body))).not.toHaveProperty("activityFeedEnabled");
    await waitFor(() => expect(fireteamReads).toBeGreaterThanOrEqual(3));
    expect(orderReads).toBe(2);
    finishWrite();
  });

  it("runs the completion step before cleaning up a Hub order Bungie reports complete", async () => {
    let firstOrderComplete = false;
    vi.mocked(api).mockImplementation(async (path) => path.startsWith("/api/v1/me/quests")
      ? ordersEnvelope(firstOrderComplete)
      : envelope());

    render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><FireteamRoute /></QueryClientProvider></MemoryRouter>);
    expect(await screen.findByText("Active in Destiny · 6")).toBeTruthy();
    expect(screen.getByText("Hub order 1")).toBeTruthy();
    expect(screen.getByText("Hub order 6")).toBeTruthy();

    firstOrderComplete = true;
    await act(async () => { vi.advanceTimersByTime(5 * 60_000); });
    await waitFor(() => expect(screen.getByText("Active in Destiny · 5")).toBeTruthy());
    expect(screen.queryByRole("link", { name: /Hub order 1/ })).toBeNull();
    expect(screen.getByText("Hub order 6")).toBeTruthy();
    const completion = await screen.findByRole("status");
    expect(completion.textContent).toContain("Order complete");
    expect(completion.textContent).toContain("Hub order 1");
  });

  it("does not duplicate the Worker cron's persistent share rebuild", async () => {
    vi.mocked(api).mockImplementation(async (path) => path.startsWith("/api/v1/me/quests") ? ordersEnvelope() : envelope("persistent"));
    render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><FireteamRoute /></QueryClientProvider></MemoryRouter>);
    expect(await screen.findByText(/Fireteam refresh in/)).toBeTruthy();

    await act(async () => { vi.advanceTimersByTime(5 * 60_000); });
    await waitFor(() => expect(vi.mocked(api).mock.calls.filter(([path]) => String(path).startsWith("/api/v1/me/quests")).length).toBe(2));
    expect(queuedApi).not.toHaveBeenCalled();
  });
});

function envelope(sharingMode: "temporary" | "persistent" = "persistent") {
  const data: FireteamData = {
    sharingEnabled: true,
    sharingMode,
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
      sharingMode,
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


function ordersEnvelope(firstOrderComplete = false) {
  const quests: QuestProgress[] = Array.from({ length: 6 }, (_, index) => {
    const complete = firstOrderComplete && index === 0;
    return {
      instanceId: `order-${index + 1}`,
      itemHash: `order-hash-${index + 1}`,
      name: `Hub order ${index + 1}`,
      description: "Complete Seasonal Hub activities.",
      itemType: "Order",
      icon: "",
      currentStep: `Order objective ${index + 1}`,
      characterId: "c1",
      inGameTracked: false,
      sitePinned: false,
      isExoticUnlock: false,
      rewards: [],
      objectives: [{
        objectiveHash: `objective-${index + 1}`,
        name: index === 0 ? "[Trace Rifle] Rapidly defeated" : `Activities ${index + 1}`,
        progress: complete ? 5 : 2,
        completionValue: 5,
        complete,
        percent: complete ? 100 : 40
      }],
      percent: complete ? 100 : 40,
      updatedAt: "now",
      category: "order"
    };
  });
  const data: QuestData = { quests, recommendations: [] };
  return { data, freshness: { state: "fresh" as const, observedAt: "now" }, warnings: [], requestId: "orders" };
}
