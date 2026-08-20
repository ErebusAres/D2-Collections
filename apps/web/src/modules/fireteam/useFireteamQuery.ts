import type { FireteamData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api/client";
import { LIVE_REFRESH_INTERVAL_MS } from "../../services/liveRefresh";

export const fireteamQueryKey = (membershipId: string, characterId: string) => ["fireteam", membershipId, characterId] as const;

export function useFireteamQuery(membershipId: string, characterId: string, enabled: boolean) {
  return useQuery({
    queryKey: fireteamQueryKey(membershipId, characterId),
    queryFn: () => api<FireteamData>(`/api/v2/fireteam?characterId=${encodeURIComponent(characterId)}`),
    enabled: Boolean(enabled && characterId),
    staleTime: LIVE_REFRESH_INTERVAL_MS,
    refetchInterval: false,
    refetchIntervalInBackground: false,
    refetchOnMount: true,
    refetchOnWindowFocus: false
  });
}
