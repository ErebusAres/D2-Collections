// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFireteamActivityFeed } from "./useFireteamActivityFeed";

const apiClient = vi.hoisted(() => ({
  api: vi.fn(),
  queuedApi: vi.fn(),
  mutationHeaders: vi.fn((csrfToken?: string) => csrfToken
    ? { "x-csrf-token": csrfToken }
    : {})
}));

vi.mock("../api/client", () => apiClient);

const snapshotFeed = {
  enabled: true,
  channelAvailable: true,
  entries: [],
  historyLimit: 60,
  retentionDays: 7,
  messageMaxLength: 240
};

function createQueryWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
}

function renderActivityFeedHook(queryClient: QueryClient, overrides: Record<string, unknown> = {}) {
  return renderHook(() => useFireteamActivityFeed({
    membershipId: "membership-1",
    characterId: "character-1",
    authenticated: true,
    feedIsVisible: true,
    autoRefresh: false,
    csrfToken: "csrf-token",
    snapshotActivityFeed: snapshotFeed,
    snapshotActivityFeedEnabled: true,
    ...overrides
  }), { wrapper: createQueryWrapper(queryClient) });
}

beforeEach(() => {
  apiClient.api.mockReset();
  apiClient.queuedApi.mockReset();
  apiClient.mutationHeaders.mockClear();
});

afterEach(cleanup);

describe("useFireteamActivityFeed", () => {
  it("loads the live activity feed under the Fireteam activity query key", async () => {
    const queryClient = createQueryClient();
    const liveFeed = {
      ...snapshotFeed,
      entries: [{
        type: "message",
        id: "message-1",
        membershipId: "membership-2",
        displayName: "Guardian#1234",
        createdAt: "2026-09-03T12:00:00Z",
        body: "Ready."
      }]
    };
    apiClient.api.mockResolvedValue({ data: liveFeed, warnings: [] });

    const { result } = renderActivityFeedHook(queryClient);

    await waitFor(() => expect(result.current.displayedActivityFeed).toEqual(liveFeed));
    expect(apiClient.api).toHaveBeenCalledWith("/api/v2/fireteam/activity");
    expect(queryClient.getQueryState([
      "fireteam-activity",
      "membership-1",
      "character-1"
    ])).toBeDefined();
  });

  it("keeps the snapshot feed and skips the live request when the feed is hidden", () => {
    const queryClient = createQueryClient();

    const { result } = renderActivityFeedHook(queryClient, { feedIsVisible: false });

    expect(result.current.displayedActivityFeed).toBe(snapshotFeed);
    expect(apiClient.api).not.toHaveBeenCalled();
  });

  it("posts messages with CSRF protection and refreshes Fireteam activity", async () => {
    const queryClient = createQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    apiClient.api.mockResolvedValue({ data: snapshotFeed, warnings: [] });
    apiClient.queuedApi.mockResolvedValue({ data: { accepted: true }, warnings: [] });
    const { result } = renderActivityFeedHook(queryClient);

    act(() => result.current.sendActivityMessage("Need ammo"));

    await waitFor(() => expect(apiClient.queuedApi).toHaveBeenCalledWith(
      "/api/v2/fireteam/messages",
      {
        method: "POST",
        headers: { "x-csrf-token": "csrf-token" },
        body: JSON.stringify({ body: "Need ammo" })
      }
    ));
    await waitFor(() => expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["fireteam-activity"]
    }));
    expect(apiClient.mutationHeaders).toHaveBeenCalledWith("csrf-token");
  });
});
