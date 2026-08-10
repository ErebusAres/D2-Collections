import type { FireteamData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api/client";

export const fireteamQueryKey = (membershipId: string, characterId: string) => ["fireteam", membershipId, characterId] as const;

export function useFireteamQuery(membershipId: string, characterId: string, enabled: boolean) {
  return useQuery({
    queryKey: fireteamQueryKey(membershipId, characterId),
    queryFn: () => api<FireteamData>(`/api/v1/fireteam?characterId=${encodeURIComponent(characterId)}`),
    enabled: Boolean(enabled && characterId),
    staleTime: 30_000,
    // A stale response has already queued one Worker-side Bungie refresh. Poll
    // only until that refreshed snapshot is readable, then return control to
    // the route's single five-minute coordinator.
    refetchInterval: (query) => query.state.data?.freshness.state === "stale" ? 15_000 : false,
    refetchIntervalInBackground: false
  });
}
