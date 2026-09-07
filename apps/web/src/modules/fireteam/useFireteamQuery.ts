import type { FireteamData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { api } from "../../services/api/client";

export function useFireteamQuery(membershipId: string, characterId: string, enabled: boolean, autoRefresh = false) {
  const rapidRefreshStartedAt = useRef(0);
  return useQuery({
    queryKey: ["fireteam", membershipId, characterId],
    queryFn: () => api<FireteamData>(`/api/v2/fireteam?characterId=${encodeURIComponent(characterId)}`),
    enabled: Boolean(enabled && characterId),
    staleTime: 60e3,
    // The first due read starts the Worker refresh after returning the last
    // committed snapshot. Poll briefly while that commit is in flight so the
    // page actually receives it, then return to the bounded one-minute read.
    refetchInterval: ({ state }) => {
      if (!autoRefresh || !state.data?.data.sharingEnabled) return false;
      if (state.data.data.refreshState !== "refreshing") {
        rapidRefreshStartedAt.current = 0;
        return 60_000;
      }
      if (!rapidRefreshStartedAt.current) rapidRefreshStartedAt.current = Date.now();
      return Date.now() - rapidRefreshStartedAt.current < 30_000 ? 5_000 : 60_000;
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false
  });
}
