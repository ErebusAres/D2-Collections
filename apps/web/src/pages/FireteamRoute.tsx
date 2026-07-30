import type { FireteamData, FireteamSharingMode, FireteamTrackedItem } from "@guardian-nexus/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Timer } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, mutationHeaders, queuedApi } from "../services/api/client";
import { pinsKey, useGuardian } from "../context/GuardianContext";
import { LIVE_REFRESH_INTERVAL_MS } from "../services/liveRefresh";
import { FireteamPage } from "./FireteamPage";
import styles from "./Pages.module.css";

export function FireteamRoute() {
  return <div className={styles.fireteamRoute}>
    <FireteamRefreshCountdown />
    <div className={styles.fireteamPageContent}><FireteamPage /></div>
  </div>;
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
  const guardianRankTracked = preferences["guardianRank.tracked"];
  const journeyTracked = preferences["journey.tracked"];
  const collectionTracked = preferences["collection.tracked"];
  const [now, setNow] = useState(() => Date.now());
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [timerPinned, setTimerPinned] = useState(false);
  const refreshRunning = useRef(false);
  const timerRail = useRef<HTMLElement | null>(null);
  const canRefreshTrackedProgress = Boolean(data?.sharingEnabled && mode && mode !== "off" && selectedCharacterId);
  const trackedSeasonalOrders = useMemo(() => {
    const self = data?.members.find((member) => member.isSelf);
    return (self?.trackedItems || [])
      .filter((item) => item.kind === "order" && item.trackedInDestiny)
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [data?.members]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const updatePinnedState = () => {
      const rail = timerRail.current;
      if (!rail || window.innerWidth <= 1_200) {
        setTimerPinned(false);
        return;
      }
      const headerHeight = Number.parseFloat(getComputedStyle(rail).getPropertyValue("--shell-header-height")) || 130;
      setTimerPinned(rail.getBoundingClientRect().top <= headerHeight + 10);
    };
    updatePinnedState();
    window.addEventListener("scroll", updatePinnedState, { passive: true });
    window.addEventListener("resize", updatePinnedState);
    return () => {
      window.removeEventListener("scroll", updatePinnedState);
      window.removeEventListener("resize", updatePinnedState);
    };
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
          siteTrackedGuardianRankIds: readPreferenceArray(guardianRankTracked),
          siteTrackedJourneyIds: readPreferenceArray(journeyTracked),
          siteTrackedCollectionIds: readPreferenceArray(collectionTracked),
          hiddenTrackedItemKeys,
          mode: mode as FireteamSharingMode
        })
      });
      await queryClient.refetchQueries({ queryKey: ["fireteam", selectedCharacterId], exact: true, type: "active" });
    } finally {
      refreshRunning.current = false;
      setRefreshing(false);
    }
  }, [collectionTracked, guardianRankTracked, hiddenKeysSignature, journeyTracked, mode, queryClient, selectedCharacterId, session?.csrfToken, storageKey]);

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
    schedule(LIVE_REFRESH_INTERVAL_MS);
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

  return <aside ref={timerRail} className={styles.fireteamRefreshRail}>
    <div className={`${styles.fireteamRefreshDock} ${timerPinned ? styles.fireteamRefreshDockPinned : ""}`}>
      <span className={styles.fireteamRefreshTimer} aria-live="polite"><Timer size={15} />{label}</span>
      <section className={styles.fireteamTrackedOrders}>
        <header><span>Tracked in Destiny</span><strong>Seasonal Hub Orders</strong></header>
        {trackedSeasonalOrders.length
          ? trackedSeasonalOrders.map((order) => <TrackedSeasonalOrder key={`${order.kind}:${order.id}`} order={order} />)
          : <p>No in-game orders tracked.</p>}
      </section>
    </div>
  </aside>;
}

function TrackedSeasonalOrder({ order }: { order: FireteamTrackedItem }) {
  const activeObjective = order.objectives.find((objective) => !objective.complete) || order.objectives[0];
  return <article className={styles.fireteamTrackedOrder}>
    <div>{order.icon ? <img src={order.icon} alt="" /> : <Timer />}</div>
    <span>
      <strong>{order.name}</strong>
      <small>{activeObjective?.name || order.context}</small>
      <i><b style={{ width: `${order.percent}%` }} /></i>
    </span>
    <em>{order.percent}%</em>
  </article>;
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
