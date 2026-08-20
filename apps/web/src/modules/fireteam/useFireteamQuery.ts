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
    // This polls only the backend's saved D1 snapshot. The scheduled Worker,
    // not the browser, owns Bungie's narrow presence refresh.
    refetchInterval: refreshPresence ? FIRETEAM_PRESENCE_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  });
}
