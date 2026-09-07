import type { FireteamData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api/client";

export const FIRETEAM_POLL_INTERVAL_MS = 60_000;
export const FIRETEAM_COMMIT_CHECK_INTERVAL_MS = 5_000;

export function fireteamPollInterval(autoRefresh: boolean, response?: { data: FireteamData }): number | false {
  if (!autoRefresh || !response?.data.sharingEnabled) return false;
  return response.data.refreshState === "refreshing"
    ? FIRETEAM_COMMIT_CHECK_INTERVAL_MS
    : FIRETEAM_POLL_INTERVAL_MS;
}

export function useFireteamQuery(membershipId: string, characterId: string, enabled: boolean, autoRefresh = false) {
  return useQuery({
    queryKey: ["fireteam", membershipId, characterId],
    queryFn: () => api<FireteamData>(`/api/v2/fireteam?characterId=${encodeURIComponent(characterId)}`),
    enabled: Boolean(enabled && characterId),
    staleTime: 60e3,
    // The first due read starts the Worker refresh after returning the last
    // committed snapshot. Poll briefly while that commit is in flight so the
    // page actually receives it, then return to the bounded one-minute read.
    refetchInterval: (query) => fireteamPollInterval(autoRefresh, query.state.data),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false
  });
}
