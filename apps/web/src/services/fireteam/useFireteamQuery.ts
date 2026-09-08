import type { FireteamData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

export function useFireteamQuery(membershipId: string, characterId: string, enabled: boolean, autoRefresh = false) {
  return useQuery({
    queryKey: ["fireteam", membershipId, characterId],
    queryFn: () => api<FireteamData>(`/api/v2/fireteam?characterId=${encodeURIComponent(characterId)}`),
    enabled: Boolean(enabled && characterId),
    staleTime: 60e3,
    // The first due read starts the Worker refresh after returning the last
    // committed snapshot. Poll briefly while that commit is in flight so the
    // page actually receives it, then return to the bounded one-minute read.
    refetchInterval: ({ state }) => autoRefresh && state.data?.data.sharingEnabled
      ? state.data.data.refreshState === "refreshing" ? 5_000 : 60_000
      : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false
  });
}
