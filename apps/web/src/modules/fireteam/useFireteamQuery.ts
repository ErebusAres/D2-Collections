import type { FireteamData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api/client";
import { FIRETEAM_ROSTER_REFRESH_INTERVAL_MS } from "../../services/liveRefresh";

export const fireteamQueryKey = (membershipId: string, characterId: string) => ["fireteam", membershipId, characterId] as const;

export function useFireteamQuery(membershipId: string, characterId: string, enabled: boolean, autoRefresh = true) {
  return useQuery({
    queryKey: fireteamQueryKey(membershipId, characterId),
    queryFn: () => api<FireteamData>(`/api/v2/fireteam?characterId=${encodeURIComponent(characterId)}`),
    enabled: Boolean(enabled && characterId),
    staleTime: FIRETEAM_ROSTER_REFRESH_INTERVAL_MS,
    refetchInterval: (query) => autoRefresh && query.state.data?.data.sharingEnabled ? FIRETEAM_ROSTER_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
    refetchOnMount: true,
    refetchOnWindowFocus: false
  });
}
