import type { FireteamData, FireteamSharingMode } from "@guardian-nexus/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Timer } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, mutationHeaders, queuedApi } from "../services/api/client";
import { pinsKey, useGuardian } from "../context/GuardianContext";
import { LIVE_REFRESH_INTERVAL_MS } from "../services/liveRefresh";
import { FireteamPage } from "./FireteamPage";
import styles from "./Pages.module.css";

const INITIAL_TRACKED_REFRESH_DELAY_MS = Math.max(1_000, LIVE_REFRESH_INTERVAL_MS - 10_000);

export function FireteamRoute() {
  return <>
    <FireteamRefreshCountdown />
    <FireteamPage />
  </>;
}

function FireteamRefreshCountdown() {
  const { session, selectedCharacterId, autoRefresh, preferences } = useGuardian();
  const queryClient = useQueryClient();
  const result = useQuery({
    queryKey: ["fireteam", selectedCharacterId],
    queryFn: () => api<FireteamData>(`/api/v1/fireteam?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled: Boolean(session?.authenticated),
    refetchInterval: false
  });
  const data = result.data?.data;
  const membershipId = session?.guardian?.membershipId || "";
  const storageKey = membershipId && selectedCharacterId ? pinsKey(membershipId, selectedCharacterId) : "";
  const mode = data?.sharingMode;
  const hiddenTrackedItemKeys = data?.hiddenTrackedItemKeys || [];
  const hiddenKeysSignature = hiddenTrackedItemKeys.join(",");
  const [now, setNow] = useState(() => Date.now());
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const refreshRunning = useRef(false);
  const canRefreshTrackedProgress = Boolean(data?.sharingEnabled && mode && mode !== "off" && selectedCharacterId);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const refreshTrackedProgress = useCallback(async () => {
    if (refreshRunning.current || !selectedCharacterId || !mode || mode === "off") return;
    refreshRunning.current = true;
    setRefreshing(true);
    try {
      await queuedApi("/api/v1/fireteam/share", {
        method: "PUT",
        headers: mutationHeaders(session?.csrfToken),
        body: JSON.stringify({
          characterId: selectedCharacterId,
          sitePinnedQuestIds: readStringArray(storageKey, 40),
          siteTrackedGuardianRankIds: readPreferenceArray(preferences["guardianRank.tracked"]),
          siteTrackedJourneyIds: readPreferenceArray(preferences["journey.tracked"]),
          hiddenTrackedItemKeys,
          mode: mode as FireteamSharingMode
        })
      });
      await queryClient.invalidateQueries({ queryKey: ["fireteam"] });
    } finally {
      refreshRunning.current = false;
      setRefreshing(false);
    }
  }, [hiddenKeysSignature, mode, preferences, queryClient, selectedCharacterId, session?.csrfToken, storageKey]);

  useEffect(() => {
    if (!autoRefresh || !canRefreshTrackedProgress) {
      setNextRefreshAt(null);
      return;
    }
    let cancelled = false;
    let timer = 0;
    const schedule = (delay: number) => {
      setNextRefreshAt(Date.now() + delay);
      timer = window.setTimeout(async () => {
        try { await refreshTrackedProgress(); } catch { /* The page already surfaces service warnings. */ }
        if (!cancelled) schedule(LIVE_REFRESH_INTERVAL_MS);
      }, delay);
    };
    schedule(INITIAL_TRACKED_REFRESH_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [autoRefresh, canRefreshTrackedProgress, refreshTrackedProgress]);

  const label = useMemo(() => {
    if (!autoRefresh) return "Tracked refresh off";
    if (!canRefreshTrackedProgress) return "Tracked sharing off";
    if (refreshing) return "Refreshing tracked quests";
    if (!nextRefreshAt) return "Scheduling tracked refresh";
    const seconds = Math.max(0, Math.ceil((nextRefreshAt - now) / 1_000));
    return `Tracked refresh in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }, [autoRefresh, canRefreshTrackedProgress, nextRefreshAt, now, refreshing]);

  return <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
    <span className={styles.primaryAction} aria-live="polite"><Timer size={15} />{label}</span>
  </div>;
}

function readPreferenceArray(value?: string): string[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string" && Boolean(entry)).slice(0, 200) : [];
  } catch { return []; }
}

function readStringArray(storageKey: string, limit: number): string[] {
  if (!storageKey) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string" && Boolean(entry)).slice(0, limit) : [];
  } catch { return []; }
}
