import type { FireteamData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api/client";

export const fireteamQueryKey = (membershipId: string, characterId: string) => ["fireteam", membershipId, characterId] as const;

export function useFireteamQuery(membershipId: string, characterId: string, enabled: boolean, autoRefresh: boolean) {
  return useQuery({
    queryKey: fireteamQueryKey(membershipId, characterId),
    queryFn: () => api<FireteamData>(`/api/v2/fireteam?characterId=${encodeURIComponent(characterId)}`),
    enabled: Boolean(enabled && characterId),
    staleTime: 60e3,
    refetchInterval: (query) => autoRefresh && query.state.data?.data.sharingEnabled && 60e3,
    refetchIntervalInBackground: false,
    refetchOnMount: true,
    refetchOnWindowFocus: false
  });
}
