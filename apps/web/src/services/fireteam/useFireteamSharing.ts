import type { FireteamSharingMode, FireteamTrackedItem } from "@guardian-nexus/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mutationHeaders, queuedApi } from "../api/client";

interface UseFireteamSharingOptions {
  characterId: string;
  csrfToken?: string;
  currentPinnedQuestIds: string[];
  currentTrackedGuardianRankIds: string[];
  currentTrackedJourneyIds: string[];
  currentTrackedCollectionIds: string[];
  currentTrackedBuilds: FireteamTrackedItem[];
  currentHiddenTrackedItemKeys: string[];
}

export interface UpdateFireteamSharingInput {
  mode: FireteamSharingMode;
  pinnedQuestIds?: string[];
  trackedGuardianRankIds?: string[];
  trackedJourneyIds?: string[];
  trackedCollectionIds?: string[];
  trackedBuilds?: FireteamTrackedItem[];
  hiddenTrackedItemKeys?: string[];
  activityFeedEnabled?: boolean;
  untrackingItemKey?: string;
}

interface FireteamSharingCallbacks {
  onSettled?: () => void;
}

export function useFireteamSharing({
  characterId,
  csrfToken,
  currentPinnedQuestIds,
  currentTrackedGuardianRankIds,
  currentTrackedJourneyIds,
  currentTrackedCollectionIds,
  currentTrackedBuilds,
  currentHiddenTrackedItemKeys
}: UseFireteamSharingOptions) {
  const queryClient = useQueryClient();
  const refreshFireteamQueries = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["fireteam"] }),
    queryClient.invalidateQueries({ queryKey: ["fireteam-activity"] })
  ]);
  const sharingMutation = useMutation({
    mutationFn: ({
      mode,
      pinnedQuestIds = currentPinnedQuestIds,
      trackedGuardianRankIds = currentTrackedGuardianRankIds,
      trackedJourneyIds = currentTrackedJourneyIds,
      trackedCollectionIds = currentTrackedCollectionIds,
      trackedBuilds = currentTrackedBuilds,
      hiddenTrackedItemKeys = currentHiddenTrackedItemKeys,
      activityFeedEnabled
    }: UpdateFireteamSharingInput) => queuedApi("/api/v2/fireteam/share", {
      method: "PUT",
      headers: mutationHeaders(csrfToken),
      body: JSON.stringify({
        characterId,
        sitePinnedQuestIds: pinnedQuestIds,
        siteTrackedGuardianRankIds: trackedGuardianRankIds,
        siteTrackedJourneyIds: trackedJourneyIds,
        siteTrackedCollectionIds: trackedCollectionIds,
        siteTrackedBuilds: trackedBuilds,
        hiddenTrackedItemKeys,
        ...(activityFeedEnabled === undefined ? {} : { activityFeedEnabled }),
        mode
      })
    }),
    onSuccess: refreshFireteamQueries
  });
  const stopSharingMutation = useMutation({
    mutationFn: () => queuedApi("/api/v2/fireteam/share", {
      method: "DELETE",
      headers: mutationHeaders(csrfToken)
    }),
    onSuccess: refreshFireteamQueries
  });

  return {
    updateFireteamSharing: (
      input: UpdateFireteamSharingInput,
      callbacks?: FireteamSharingCallbacks
    ) => sharingMutation.mutate(input, callbacks && {
      onSettled: () => callbacks.onSettled?.()
    }),
    stopFireteamSharing: () => stopSharingMutation.mutate(),
    sharingUpdatePending: sharingMutation.isPending,
    stopSharingPending: stopSharingMutation.isPending,
    updatingUntrackingItemKey: sharingMutation.isPending
      ? sharingMutation.variables?.untrackingItemKey
      : undefined
  };
}
