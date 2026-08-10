import type { FireteamData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api/client";

export const fireteamQueryKey = (characterId: string) => ["fireteam", characterId] as const;

export function useFireteamQuery(characterId: string, enabled: boolean) {
  return useQuery({
    queryKey: fireteamQueryKey(characterId),
    queryFn: () => api<FireteamData>(`/api/v1/fireteam?characterId=${encodeURIComponent(characterId)}`),
    enabled: Boolean(enabled && characterId),
    staleTime: 30_000,
    refetchInterval: false,
    refetchIntervalInBackground: false
  });
}
