import type { FireteamActivityFeed } from "@guardian-nexus/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, mutationHeaders, queuedApi } from "../api/client";
import { FIRETEAM_ACTIVITY_REFRESH_INTERVAL_MS } from "../liveRefresh";

interface UseFireteamActivityFeedOptions {
  membershipId: string;
  characterId: string;
  authenticated: boolean;
  feedIsVisible: boolean;
  autoRefresh: boolean;
  csrfToken?: string;
  snapshotActivityFeed?: FireteamActivityFeed;
  snapshotActivityFeedEnabled?: boolean;
}

export function useFireteamActivityFeed({
  membershipId,
  characterId,
  authenticated,
  feedIsVisible,
  autoRefresh,
  csrfToken,
  snapshotActivityFeed,
  snapshotActivityFeedEnabled
}: UseFireteamActivityFeedOptions) {
  const queryClient = useQueryClient();
  const activityFeedQuery = useQuery({
    queryKey: ["fireteam-activity", membershipId, characterId],
    queryFn: () => api<FireteamActivityFeed>("/api/v2/fireteam/activity"),
    enabled: Boolean(authenticated && feedIsVisible),
    staleTime: FIRETEAM_ACTIVITY_REFRESH_INTERVAL_MS,
    refetchInterval: autoRefresh ? FIRETEAM_ACTIVITY_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false
  });
  const messageMutation = useMutation({
    mutationFn: (body: string) => queuedApi("/api/v2/fireteam/messages", {
      method: "POST",
      headers: mutationHeaders(csrfToken),
      body: JSON.stringify({ body })
    }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["fireteam-activity"] })
  });
  const queriedActivityFeed = activityFeedQuery.data?.data;
  const displayedActivityFeed = queriedActivityFeed && Array.isArray(queriedActivityFeed.entries)
    ? queriedActivityFeed
    : snapshotActivityFeed || {
      enabled: Boolean(snapshotActivityFeedEnabled),
      channelAvailable: false,
      entries: [],
      historyLimit: 60,
      retentionDays: 7,
      messageMaxLength: 240
    };

  return {
    displayedActivityFeed,
    sendActivityMessage: (body: string) => messageMutation.mutate(body),
    activityMessageSending: messageMutation.isPending,
    activityFeedError: messageMutation.error instanceof Error
      ? messageMutation.error.message
      : activityFeedQuery.error instanceof Error
        ? activityFeedQuery.error.message
        : undefined
  };
}
