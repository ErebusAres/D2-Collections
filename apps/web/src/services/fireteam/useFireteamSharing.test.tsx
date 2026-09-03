// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFireteamSharing } from "./useFireteamSharing";

const apiClient = vi.hoisted(() => ({
  queuedApi: vi.fn(),
  mutationHeaders: vi.fn((csrfToken?: string) => csrfToken
    ? { "x-csrf-token": csrfToken }
    : {})
}));

vi.mock("../api/client", () => apiClient);

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
}

function renderSharingHook(queryClient: QueryClient) {
  function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return renderHook(() => useFireteamSharing({
    characterId: "character-1",
    csrfToken: "csrf-token",
    currentPinnedQuestIds: ["quest-1"],
    currentTrackedGuardianRankIds: ["rank-1"],
    currentTrackedJourneyIds: ["journey-1"],
    currentTrackedCollectionIds: ["collection-1"],
    currentTrackedBuilds: [],
    currentHiddenTrackedItemKeys: ["hidden-1"]
  }), { wrapper: QueryWrapper });
}

beforeEach(() => {
  apiClient.queuedApi.mockReset();
  apiClient.mutationHeaders.mockClear();
});

afterEach(cleanup);

describe("useFireteamSharing", () => {
  it("serializes the current tracked state and refreshes both Fireteam caches", async () => {
    const queryClient = createQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    apiClient.queuedApi.mockResolvedValue({ data: { sharing: true }, warnings: [] });
    const { result } = renderSharingHook(queryClient);

    act(() => result.current.updateFireteamSharing({ mode: "persistent" }));

    await waitFor(() => expect(apiClient.queuedApi).toHaveBeenCalledWith(
      "/api/v2/fireteam/share",
      {
        method: "PUT",
        headers: { "x-csrf-token": "csrf-token" },
        body: JSON.stringify({
          characterId: "character-1",
          sitePinnedQuestIds: ["quest-1"],
          siteTrackedGuardianRankIds: ["rank-1"],
          siteTrackedJourneyIds: ["journey-1"],
          siteTrackedCollectionIds: ["collection-1"],
          siteTrackedBuilds: [],
          hiddenTrackedItemKeys: ["hidden-1"],
          mode: "persistent"
        })
      }
    ));
    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["fireteam"] });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["fireteam-activity"] });
    });
  });

  it("tracks an in-flight untracking update without sending its UI key", async () => {
    const queryClient = createQueryClient();
    let finishRequest: ((value: unknown) => void) | undefined;
    apiClient.queuedApi.mockImplementation(() => new Promise((resolve) => {
      finishRequest = resolve;
    }));
    const onSettled = vi.fn();
    const { result } = renderSharingHook(queryClient);

    act(() => result.current.updateFireteamSharing({
      mode: "temporary",
      pinnedQuestIds: [],
      hiddenTrackedItemKeys: ["order:quest-1"],
      activityFeedEnabled: false,
      untrackingItemKey: "order:quest-1"
    }, { onSettled }));

    await waitFor(() => {
      expect(result.current.sharingUpdatePending).toBe(true);
      expect(result.current.updatingUntrackingItemKey).toBe("order:quest-1");
    });
    const [, request] = apiClient.queuedApi.mock.calls[0]!;
    const body = JSON.parse(String(request.body));
    expect(body.sitePinnedQuestIds).toEqual([]);
    expect(body.hiddenTrackedItemKeys).toEqual(["order:quest-1"]);
    expect(body.activityFeedEnabled).toBe(false);
    expect(body.untrackingItemKey).toBeUndefined();

    await act(async () => finishRequest?.({ data: { sharing: true }, warnings: [] }));
    await waitFor(() => expect(onSettled).toHaveBeenCalledOnce());
  });

  it("stops sharing with CSRF protection and refreshes both Fireteam caches", async () => {
    const queryClient = createQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    apiClient.queuedApi.mockResolvedValue({ data: { sharing: false }, warnings: [] });
    const { result } = renderSharingHook(queryClient);

    act(() => result.current.stopFireteamSharing());

    await waitFor(() => expect(apiClient.queuedApi).toHaveBeenCalledWith(
      "/api/v2/fireteam/share",
      {
        method: "DELETE",
        headers: { "x-csrf-token": "csrf-token" }
      }
    ));
    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["fireteam"] });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["fireteam-activity"] });
    });
    expect(apiClient.mutationHeaders).toHaveBeenCalledWith("csrf-token");
  });
});
