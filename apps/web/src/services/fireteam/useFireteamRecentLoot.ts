import type {
  ApiEnvelope,
  GearActionRequest,
  GearActionResult,
  GearTag,
  RecentItemTimelineData
} from "@guardian-nexus/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, mutationHeaders, queuedApi } from "../api/client";
import { LIVE_REFRESH_INTERVAL_MS } from "../liveRefresh";

interface UseFireteamRecentLootOptions {
  characterId: string;
  authenticated: boolean;
  recentLootIsVisible: boolean;
  csrfToken?: string;
}

interface UpdateRecentLootItemTagInput {
  itemInstanceId: string;
  tag: GearTag | null;
}

function recentLootQueryKey(characterId: string) {
  return ["fireteam-recent-items", characterId] as const;
}

function updateCachedItemTag(
  cachedRecentLoot: ApiEnvelope<RecentItemTimelineData> | undefined,
  itemInstanceId: string,
  tag?: GearTag
): ApiEnvelope<RecentItemTimelineData> | undefined {
  if (!cachedRecentLoot) return cachedRecentLoot;

  return {
    ...cachedRecentLoot,
    data: {
      ...cachedRecentLoot.data,
      events: cachedRecentLoot.data.events.map((recentLootEvent) =>
        recentLootEvent.gear?.instanceId === itemInstanceId
          ? {
            ...recentLootEvent,
            gear: { ...recentLootEvent.gear, tag }
          }
          : recentLootEvent
      )
    }
  };
}

export function useFireteamRecentLoot({
  characterId,
  authenticated,
  recentLootIsVisible,
  csrfToken
}: UseFireteamRecentLootOptions) {
  const queryClient = useQueryClient();
  const queryKey = recentLootQueryKey(characterId);
  const recentLootQuery = useQuery({
    queryKey,
    queryFn: () => api<RecentItemTimelineData>(
      `/api/v2/fireteam/recent-items?characterId=${encodeURIComponent(characterId)}`
    ),
    enabled: Boolean(authenticated && characterId && recentLootIsVisible),
    staleTime: LIVE_REFRESH_INTERVAL_MS,
    // Recent Loot is written by the canonical five-minute Fireteam snapshot.
    // FireteamRoute refetches this active query only after a newer snapshot
    // commits, so minute polling cannot discover additional saved data.
    refetchInterval: false,
    refetchIntervalInBackground: false
  });
  const itemTagMutation = useMutation({
    mutationFn: (input: UpdateRecentLootItemTagInput) => queuedApi(
      "/api/v1/me/gear/item-state",
      {
        method: "PUT",
        headers: mutationHeaders(csrfToken),
        body: JSON.stringify(input)
      },
      { persist: true }
    ),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const previousRecentLoot = queryClient.getQueryData<ApiEnvelope<RecentItemTimelineData>>(queryKey);
      queryClient.setQueryData<ApiEnvelope<RecentItemTimelineData>>(
        queryKey,
        (cachedRecentLoot) => updateCachedItemTag(
          cachedRecentLoot,
          input.itemInstanceId,
          input.tag || undefined
        )
      );
      return { queryKey, previousRecentLoot };
    },
    onError: (_error, _input, context) => {
      queryClient.setQueryData(
        context?.queryKey || queryKey,
        context?.previousRecentLoot
      );
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey })
  });
  const gearActionMutation = useMutation({
    mutationFn: async (gearAction: GearActionRequest) => {
      const response = await api<GearActionResult>("/api/v1/me/gear/action", {
        method: "POST",
        headers: mutationHeaders(csrfToken),
        body: JSON.stringify(gearAction)
      });
      const failedAction = response.data.failed[0];
      if (failedAction) throw new Error(failedAction.message);
      return response;
    },
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({ queryKey: ["gear", characterId] })
    ])
  });

  return {
    recentLootEvents: recentLootQuery.data?.data.events || [],
    recentLootLoading: recentLootQuery.isLoading,
    recentLootLoadError: recentLootQuery.error as Error | null,
    recentLootWarnings: recentLootQuery.data?.warnings,
    recentLootRetentionDays: recentLootQuery.data?.data.retentionDays,
    recentLootObservedAt: recentLootQuery.data?.data.observedAt,
    recentLootFirstObservationEstablished:
      recentLootQuery.data?.data.firstObservationEstablished,
    retryRecentLoot: () => void recentLootQuery.refetch(),
    updateRecentLootItemTag: (itemInstanceId: string, tag?: GearTag) =>
      itemTagMutation.mutate({ itemInstanceId, tag: tag || null }),
    pullRecentLootItemToCharacter: (itemInstanceId: string) =>
      gearActionMutation.mutate({
        action: "transfer",
        itemInstanceId,
        target: "character",
        targetCharacterId: characterId
      }),
    changeRecentLootWeaponSocket: (
      itemInstanceId: string,
      socketIndex: number,
      plugItemHash: string
    ) => gearActionMutation.mutate({
      action: "setWeaponSocket",
      itemInstanceId,
      characterId,
      socketIndex,
      plugItemHash
    }),
    recentLootActionPending: itemTagMutation.isPending || gearActionMutation.isPending,
    recentLootActionError: itemTagMutation.error || gearActionMutation.error
  };
}
