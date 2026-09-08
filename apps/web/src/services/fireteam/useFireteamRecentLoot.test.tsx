// @vitest-environment jsdom

import type {
  ApiEnvelope,
  GearActionResult,
  RecentItemTimelineData,
  WeaponItem
} from "@guardian-nexus/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFireteamRecentLoot } from "./useFireteamRecentLoot";

const apiClient = vi.hoisted(() => ({
  api: vi.fn(),
  queuedApi: vi.fn(),
  mutationHeaders: vi.fn((csrfToken?: string) => csrfToken
    ? { "x-csrf-token": csrfToken }
    : {})
}));

vi.mock("../api/client", () => apiClient);

const recentWeapon: WeaponItem = {
  instanceId: "item-1",
  itemHash: "weapon-1",
  name: "Recent Rifle",
  icon: "/weapon.png",
  itemType: "Auto Rifle",
  slot: "Kinetic",
  damageType: "Kinetic",
  rarity: "Legendary",
  power: 2000,
  location: "inventory",
  equipped: false,
  locked: false,
  masterworked: false,
  gearTier: 0,
  crafted: false,
  enhanced: false,
  perkColumns: [],
  originTraits: [],
  rollDataState: "complete",
  reviewState: "unique",
  reviewReasons: [],
  duplicateCount: 1,
  wishlisted: false,
  firstSeenAt: "2026-09-08T12:00:00Z",
  isNew: true
};

const recentLootEnvelope: ApiEnvelope<RecentItemTimelineData> = {
  data: {
    timelineSchemaVersion: 1,
    events: [{
      id: "event-1",
      kind: "weapon-found",
      sourceKey: "item-1",
      itemHash: "weapon-1",
      instanceId: "item-1",
      name: "Recent Rifle",
      icon: "/weapon.png",
      quantity: 1,
      observedAt: "2026-09-08T12:00:00Z",
      lastObservedAt: "2026-09-08T12:00:00Z",
      gear: { kind: "weapon", ...recentWeapon }
    }],
    retentionDays: 30,
    firstObservationEstablished: true,
    observedAt: "2026-09-08T12:00:00Z"
  },
  freshness: {
    state: "fresh",
    observedAt: "2026-09-08T12:00:00Z"
  },
  warnings: ["Recent Loot warning"],
  requestId: "request-1"
};

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
}

function createQueryWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function renderRecentLootHook(
  queryClient: QueryClient,
  overrides: Record<string, unknown> = {}
) {
  return renderHook(() => useFireteamRecentLoot({
    characterId: "character-1",
    authenticated: true,
    recentLootIsVisible: true,
    csrfToken: "csrf-token",
    ...overrides
  }), { wrapper: createQueryWrapper(queryClient) });
}

function successfulGearAction(action: GearActionResult["action"]): ApiEnvelope<GearActionResult> {
  return {
    data: { action, succeeded: ["item-1"], skipped: [], failed: [] },
    freshness: { state: "fresh", observedAt: "2026-09-08T12:00:00Z" },
    warnings: [],
    requestId: `request-${action}`
  };
}

beforeEach(() => {
  apiClient.api.mockReset();
  apiClient.queuedApi.mockReset();
  apiClient.mutationHeaders.mockClear();
});

afterEach(cleanup);

describe("useFireteamRecentLoot", () => {
  it("loads and exposes the selected character's Fireteam Recent Loot", async () => {
    const queryClient = createQueryClient();
    apiClient.api.mockResolvedValue(recentLootEnvelope);

    const { result } = renderRecentLootHook(queryClient);

    await waitFor(() => expect(result.current.recentLootEvents).toHaveLength(1));
    expect(apiClient.api).toHaveBeenCalledWith(
      "/api/v2/fireteam/recent-items?characterId=character-1"
    );
    expect(result.current.recentLootWarnings).toEqual(["Recent Loot warning"]);
    expect(result.current.recentLootRetentionDays).toBe(30);
    expect(result.current.recentLootFirstObservationEstablished).toBe(true);
    expect(queryClient.getQueryState([
      "fireteam-recent-items",
      "character-1"
    ])).toBeDefined();
  });

  it("optimistically updates an item tag and restores the cache when saving fails", async () => {
    const queryClient = createQueryClient();
    const queryKey = ["fireteam-recent-items", "character-1"] as const;
    queryClient.setQueryData(queryKey, recentLootEnvelope);
    let rejectRequest: ((reason: Error) => void) | undefined;
    apiClient.queuedApi.mockImplementation(() => new Promise((_resolve, reject) => {
      rejectRequest = reject;
    }));
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderRecentLootHook(queryClient, { recentLootIsVisible: false });

    act(() => result.current.updateRecentLootItemTag("item-1", "favorite"));

    await waitFor(() => expect(
      queryClient.getQueryData<ApiEnvelope<RecentItemTimelineData>>(queryKey)
        ?.data.events[0]?.gear?.tag
    ).toBe("favorite"));
    expect(apiClient.queuedApi).toHaveBeenCalledWith(
      "/api/v1/me/gear/item-state",
      {
        method: "PUT",
        headers: { "x-csrf-token": "csrf-token" },
        body: JSON.stringify({ itemInstanceId: "item-1", tag: "favorite" })
      },
      { persist: true }
    );

    await act(async () => rejectRequest?.(new Error("Tag save failed")));

    await waitFor(() => expect(
      queryClient.getQueryData<ApiEnvelope<RecentItemTimelineData>>(queryKey)
        ?.data.events[0]?.gear?.tag
    ).toBeUndefined());
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey });
  });

  it("translates pull and socket actions and refreshes affected gear caches", async () => {
    const queryClient = createQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    apiClient.api
      .mockResolvedValueOnce(successfulGearAction("transfer"))
      .mockResolvedValueOnce(successfulGearAction("setWeaponSocket"));
    const { result } = renderRecentLootHook(queryClient, { recentLootIsVisible: false });

    act(() => result.current.pullRecentLootItemToCharacter("item-1"));

    await waitFor(() => expect(apiClient.api).toHaveBeenCalledWith(
      "/api/v1/me/gear/action",
      {
        method: "POST",
        headers: { "x-csrf-token": "csrf-token" },
        body: JSON.stringify({
          action: "transfer",
          itemInstanceId: "item-1",
          target: "character",
          targetCharacterId: "character-1"
        })
      }
    ));
    await waitFor(() => expect(result.current.recentLootActionPending).toBe(false));

    act(() => result.current.changeRecentLootWeaponSocket("item-1", 2, "plug-1"));

    await waitFor(() => expect(apiClient.api).toHaveBeenCalledWith(
      "/api/v1/me/gear/action",
      {
        method: "POST",
        headers: { "x-csrf-token": "csrf-token" },
        body: JSON.stringify({
          action: "setWeaponSocket",
          itemInstanceId: "item-1",
          characterId: "character-1",
          socketIndex: 2,
          plugItemHash: "plug-1"
        })
      }
    ));
    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: [
        "fireteam-recent-items",
        "character-1"
      ] });
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["gear", "character-1"]
      });
    });
  });

  it("surfaces the first failed gear action without refreshing successful caches", async () => {
    const queryClient = createQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    apiClient.api.mockResolvedValue({
      ...successfulGearAction("transfer"),
      data: {
        action: "transfer",
        succeeded: [],
        skipped: [],
        failed: [{
          itemInstanceId: "item-1",
          code: "transfer_failed",
          message: "Transfer failed"
        }]
      }
    });
    const { result } = renderRecentLootHook(queryClient, { recentLootIsVisible: false });

    act(() => result.current.pullRecentLootItemToCharacter("item-1"));

    await waitFor(() => expect(result.current.recentLootActionError?.message)
      .toBe("Transfer failed"));
    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});
