import type { FireteamData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api/client";

export function useFireteamQuery(membershipId: string, characterId: string, enabled: boolean, autoRefresh = false) {
  return useQuery({
    queryKey: ["fireteam", membershipId, characterId],
    queryFn: () => api<FireteamData>(`/api/v2/fireteam?characterId=${encodeURIComponent(characterId)}`),
    enabled: Boolean(enabled && characterId),
    staleTime: 60e3,
    // Poll briefly only during the first thirty seconds of a claimed job.
    // A stalled background job must not keep every browser polling rapidly.
    refetchInterval: ({ state }) => autoRefresh && state.data?.data.sharingEnabled
      ? state.data.data.refreshState === "refreshing"
        && Date.now() - Date.parse(state.data.data.refreshAttemptedAt || "") < 30_000 ? 5_000 : 60_000
      : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false
  });
}
