import type { FireteamData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api/client";
import { LIVE_REFRESH_INTERVAL_MS } from "../../services/liveRefresh";

export const fireteamQueryKey = (membershipId: string, characterId: string) => ["fireteam", membershipId, characterId] as const;
export const FIRETEAM_PRESENCE_REFRESH_INTERVAL_MS = 60_000;

export function useFireteamQuery(membershipId: string, characterId: string, enabled: boolean, refreshPresence = false) {
  return useQuery({
    queryKey: fireteamQueryKey(membershipId, characterId),
    queryFn: () => api<FireteamData>(`/api/v1/fireteam?characterId=${encodeURIComponent(characterId)}`),
    enabled: Boolean(enabled && characterId),
    staleTime: LIVE_REFRESH_INTERVAL_MS,
    // The API read is cheap and schedules a leased, narrow Bungie presence
    // refresh. Tracked progress keeps its separate five-minute cadence.
    refetchInterval: refreshPresence ? FIRETEAM_PRESENCE_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  });
}
