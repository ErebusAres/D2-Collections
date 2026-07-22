import type { RewardCodeAccountStatus, RewardCodeStatusData, UpdateRewardCodePreferenceRequest } from "@guardian-nexus/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { api, mutationHeaders, queuedApi } from "../../services/api/client";
import { setRewardCodeRedeemed, useRedeemedRewardCodes } from "./rewardCodePreferences";
import { useGuardian } from "../../context/GuardianContext";

export function accountOwnedCodes(statuses: RewardCodeAccountStatus[] = []): Set<string> {
  return new Set(statuses.filter((entry) => entry.state === "reward-owned").map((entry) => entry.code));
}

export function mergedHiddenCodes(manual: ReadonlySet<string>, accountOwned: ReadonlySet<string>): Set<string> {
  return new Set([...manual, ...accountOwned]);
}

export function useRewardCodeStatus(membershipId: string | undefined, authenticated: boolean, autoRefresh: boolean) {
  const { session } = useGuardian();
  const queryClient = useQueryClient();
  const localManual = useRedeemedRewardCodes(membershipId);
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
  const manual = useMemo(() => query.data?.data.manualCodesConfigured ? new Set(query.data.data.manualCodes) : localManual, [query.data?.data.manualCodes, query.data?.data.manualCodesConfigured, localManual]);
  const preferenceMutation = useMutation({
    mutationFn: (input: UpdateRewardCodePreferenceRequest) => queuedApi<{ manualCodes: string[] }>("/api/v1/me/reward-code-status", { method: "PUT", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify(input) }, { persist: true }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["reward-code-status", membershipId] })
  });
  const setManual = (code: string, redeemed: boolean) => {
    setRewardCodeRedeemed(membershipId, code, redeemed);
    if (authenticated && membershipId) preferenceMutation.mutate({ code, redeemed });
  };
  const migrated = useRef(false);
  useEffect(() => {
    if (migrated.current || !authenticated || !query.data || query.data.data.manualCodesConfigured || !localManual.size || preferenceMutation.isPending) return;
    migrated.current = true;
    localManual.forEach((code) => preferenceMutation.mutate({ code, redeemed: true }));
  }, [authenticated, localManual, preferenceMutation, query.data]);
  const detected = useMemo(() => accountOwnedCodes(statuses), [statuses]);
  const hidden = useMemo(() => mergedHiddenCodes(manual, detected), [manual, detected]);
  const byCode = useMemo(() => new Map(statuses.map((entry) => [entry.code, entry])), [statuses]);
  return { manual, detected, hidden, byCode, setManual, syncingManual: preferenceMutation.isPending, data: query.data?.data, warnings: query.data?.warnings || [], loading: query.isLoading, error: (query.error || preferenceMutation.error) as Error | null };
}
