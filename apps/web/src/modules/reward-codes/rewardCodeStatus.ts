import type { RewardCodeAccountStatus, RewardCodeStatusData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "../../services/api/client";
import { useRedeemedRewardCodes } from "./rewardCodePreferences";

export function accountOwnedCodes(statuses: RewardCodeAccountStatus[] = []): Set<string> {
  return new Set(statuses.filter((entry) => entry.state === "reward-owned").map((entry) => entry.code));
}

export function mergedHiddenCodes(manual: ReadonlySet<string>, accountOwned: ReadonlySet<string>): Set<string> {
  return new Set([...manual, ...accountOwned]);
}

export function useRewardCodeStatus(membershipId: string | undefined, authenticated: boolean, autoRefresh: boolean) {
  const manual = useRedeemedRewardCodes(membershipId);
  const query = useQuery({
    queryKey: ["reward-code-status", membershipId],
    queryFn: () => api<RewardCodeStatusData>("/api/v1/me/reward-code-status"),
    enabled: Boolean(authenticated && membershipId),
    staleTime: 5 * 60_000,
    refetchInterval: autoRefresh ? 5 * 60_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 1
  });
  const statuses = query.data?.data.statuses || [];
  const detected = useMemo(() => accountOwnedCodes(statuses), [statuses]);
  const hidden = useMemo(() => mergedHiddenCodes(manual, detected), [manual, detected]);
  const byCode = useMemo(() => new Map(statuses.map((entry) => [entry.code, entry])), [statuses]);
  return { manual, detected, hidden, byCode, data: query.data?.data, warnings: query.data?.warnings || [], loading: query.isLoading, error: query.error as Error | null };
}
