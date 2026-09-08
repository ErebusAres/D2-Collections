// @vitest-environment jsdom

import type {
  ApiEnvelope,
  LootWatcherRunResult,
  UserPreferencesData
} from "@guardian-nexus/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFireteamLootWatchers } from "./useFireteamLootWatchers";

const apiClient = vi.hoisted(() => ({
  api: vi.fn(),
  mutationHeaders: vi.fn((csrfToken?: string) => csrfToken
    ? { "x-csrf-token": csrfToken }
    : {})
}));

vi.mock("../api/client", () => apiClient);

const savePreference = vi.fn();

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

function renderLootWatchersHook(
  queryClient: QueryClient,
  savedPreferences: UserPreferencesData["values"] = {}
) {
  return renderHook(() => useFireteamLootWatchers({
    characterId: "character-1",
    csrfToken: "csrf-token",
    savedPreferences,
    savePreference
  }), { wrapper: createQueryWrapper(queryClient) });
}

function watcherResult(
  result: Partial<LootWatcherRunResult> = {}
): ApiEnvelope<LootWatcherRunResult> {
  return {
    data: {
      movedToVault: [],
      locked: [],
      taggedJunk: [],
      skipped: [],
      warnings: [],
      ...result
    },
    freshness: { state: "fresh", observedAt: "2026-09-08T12:00:00Z" },
    warnings: [],
    requestId: "watcher-request"
  };
}

beforeEach(() => {
  apiClient.api.mockReset();
  apiClient.mutationHeaders.mockClear();
  savePreference.mockReset();
});

afterEach(cleanup);

describe("useFireteamLootWatchers", () => {
  it("translates saved preference values into the complete watcher configuration", () => {
    const queryClient = createQueryClient();

    const { result } = renderLootWatchersHook(queryClient, {
      "fireteam.watcher.farming.v1": "on",
      "fireteam.watcher.highestPower.v1": "off",
      "fireteam.watcher.tier5Fits.v1": "on",
      "fireteam.watcher.duplicateFits.v1": "on"
    });

    expect(result.current.lootWatchers).toEqual({
      farmingMode: true,
      highestPowerLock: false,
      tier5FitLock: true,
      duplicateFitJunk: true
    });
    expect(savePreference).not.toHaveBeenCalled();
    expect(apiClient.api).not.toHaveBeenCalled();
  });

  it("saves and immediately runs an updated watcher configuration", async () => {
    const queryClient = createQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    apiClient.api.mockResolvedValue(watcherResult());
    const { result } = renderLootWatchersHook(queryClient, {
      "fireteam.watcher.highestPower.v1": "on"
    });

    act(() => result.current.toggleLootWatcher("farmingMode", true));

    expect(savePreference).toHaveBeenCalledWith(
      "fireteam.watcher.farming.v1",
      "on"
    );
    await waitFor(() => expect(apiClient.api).toHaveBeenCalledWith(
      "/api/v2/fireteam/loot-watchers/run",
      {
        method: "POST",
        headers: { "x-csrf-token": "csrf-token" },
        body: JSON.stringify({
          characterId: "character-1",
          config: {
            farmingMode: true,
            highestPowerLock: true,
            tier5FitLock: false,
            duplicateFitJunk: false
          }
        })
      }
    ));
    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["fireteam-recent-items", "character-1"]
      });
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["gear", "character-1"]
      });
    });
    expect(apiClient.mutationHeaders).toHaveBeenCalledWith("csrf-token");
  });

  it("reports pending and failed watcher updates in human-readable text", async () => {
    const queryClient = createQueryClient();
    let rejectRequest: ((reason: Error) => void) | undefined;
    apiClient.api.mockImplementation(() => new Promise((_resolve, reject) => {
      rejectRequest = reject;
    }));
    const { result } = renderLootWatchersHook(queryClient);

    act(() => result.current.toggleLootWatcher("tier5FitLock", true));

    await waitFor(() => {
      expect(result.current.lootWatcherUpdatePending).toBe(true);
      expect(result.current.lootWatcherStatus).toBe("Updating watchers…");
    });

    await act(async () => rejectRequest?.(new Error("Watcher service unavailable")));

    await waitFor(() => {
      expect(result.current.lootWatcherUpdatePending).toBe(false);
      expect(result.current.lootWatcherStatus).toBe("Watcher service unavailable");
    });
  });

  it("summarizes completed actions, warnings, skipped runs, and saved settings", async () => {
    const queryClient = createQueryClient();
    apiClient.api
      .mockResolvedValueOnce(watcherResult({
        movedToVault: ["item-1", "item-2"],
        locked: ["item-3"],
        taggedJunk: ["item-4"],
        warnings: ["Vault nearly full"]
      }))
      .mockResolvedValueOnce(watcherResult({ skipped: ["No new loot"] }))
      .mockResolvedValueOnce(watcherResult());
    const { result } = renderLootWatchersHook(queryClient);

    act(() => result.current.toggleLootWatcher("farmingMode", true));
    await waitFor(() => expect(result.current.lootWatcherStatus).toBe(
      "2 moved · 1 locked · 1 tagged junk · Vault nearly full"
    ));

    act(() => result.current.toggleLootWatcher("highestPowerLock", true));
    await waitFor(() => expect(result.current.lootWatcherStatus).toBe("No new loot"));

    act(() => result.current.toggleLootWatcher("duplicateFitJunk", true));
    await waitFor(() => expect(result.current.lootWatcherStatus)
      .toBe("Watcher settings saved."));
  });
});
