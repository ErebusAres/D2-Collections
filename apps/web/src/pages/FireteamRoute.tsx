import type { FireteamData, FireteamSharingMode, QuestData, QuestProgress } from "@guardian-nexus/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Timer } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, mutationHeaders, queuedApi } from "../services/api/client";
import { pinsKey, useGuardian } from "../context/GuardianContext";
import { LIVE_REFRESH_INTERVAL_MS } from "../services/liveRefresh";
import { parseTrackedBuilds } from "../modules/buildAdvisor/buildTracking";
import { CompletionPing, useCompletionPings } from "../components/common/CompletionPing";
import { completionTransition, isQuestComplete } from "../modules/tracking/completionTracking";
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
    enabled: Boolean(session?.authenticated && selectedCharacterId),
    refetchInterval: false
  });
  const orders = useQuery({
    queryKey: ["quests", selectedCharacterId, ""],
    queryFn: () => api<QuestData>(`/api/v1/me/quests?characterId=${encodeURIComponent(selectedCharacterId)}&pinned=`),
    enabled: Boolean(session?.authenticated && selectedCharacterId),
    refetchInterval: false,
    refetchIntervalInBackground: false
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
  const buildTracked = preferences["buildAdvisor.trackedBuilds.v1"];
  const [now, setNow] = useState(() => Date.now());
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [timerPinned, setTimerPinned] = useState(false);
  const refreshRunning = useRef(false);
  const completionState = useRef<Map<string, boolean> | null>(null);
  const completionContext = useRef("");
  const { notice: completionNotice, announce: announceCompletion, dismiss: dismissCompletion, clear: clearCompletions } = useCompletionPings();
  const timerRail = useRef<HTMLElement | null>(null);
  const canRefreshFireteam = Boolean(session?.authenticated && selectedCharacterId);
  const canShareTrackedProgress = Boolean(data?.sharingEnabled && mode && mode !== "off");
  const activeSeasonalOrders = useMemo(
    () => (orders.data?.data.quests || []).filter((quest) => quest.category === "order" && !questComplete(quest)),
    [orders.data?.data.quests]
  );

  useEffect(() => {
    if (!orders.data) return;
    const context = `${membershipId}:${selectedCharacterId}`;
    if (completionContext.current !== context) {
      completionContext.current = context;
      completionState.current = null;
      clearCompletions();
    }
    const candidates = orders.data.data.quests
      .filter((quest) => quest.category === "order")
      .map((quest) => ({ id: quest.instanceId, name: quest.name, kind: "order" as const, complete: isQuestComplete(quest), trackedInGuardianNexus: quest.sitePinned }));
    const transition = completionTransition(completionState.current, candidates);
    completionState.current = transition.state;
    announceCompletion(transition.newlyCompleted);
  }, [announceCompletion, clearCompletions, membershipId, orders.data, selectedCharacterId]);

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

  const refreshFireteamProgress = useCallback(async () => {
    if (refreshRunning.current || !selectedCharacterId) return;
    refreshRunning.current = true;
    setRefreshing(true);
    try {
      if (canShareTrackedProgress) {
        await queuedApi("/api/v1/fireteam/share", {
          method: "PUT",
          headers: mutationHeaders(session?.csrfToken),
          body: JSON.stringify({
            characterId: selectedCharacterId,
            sitePinnedQuestIds: readStringArray(storageKey, 40),
            siteTrackedGuardianRankIds: readPreferenceArray(guardianRankTracked),
            siteTrackedJourneyIds: readPreferenceArray(journeyTracked),
            siteTrackedCollectionIds: readPreferenceArray(collectionTracked),
            siteTrackedBuilds: parseTrackedBuilds(buildTracked),
            hiddenTrackedItemKeys,
            mode: mode as FireteamSharingMode
          })
        });
      }
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["fireteam", selectedCharacterId], exact: true, type: "active" }),
        queryClient.refetchQueries({ queryKey: ["quests", selectedCharacterId, ""], exact: true, type: "active" })
      ]);
    } finally {
      refreshRunning.current = false;
      setRefreshing(false);
    }
  }, [buildTracked, canShareTrackedProgress, collectionTracked, guardianRankTracked, hiddenKeysSignature, journeyTracked, mode, queryClient, selectedCharacterId, session?.csrfToken, storageKey]);

  useEffect(() => {
    if (!autoRefresh || !canRefreshFireteam) {
      setNextRefreshAt(null);
      return;
    }
    let cancelled = false;
    let timer = 0;
    const schedule = (delay: number) => {
      setNextRefreshAt(Date.now() + delay);
      timer = window.setTimeout(async () => {
        try { await refreshFireteamProgress(); } catch { /* The page already surfaces service warnings. */ }
        if (!cancelled) schedule(LIVE_REFRESH_INTERVAL_MS);
      }, delay);
    };
    schedule(LIVE_REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [autoRefresh, canRefreshFireteam, refreshFireteamProgress]);

  const label = useMemo(() => {
    if (!autoRefresh) return "Fireteam refresh off";
    if (!canRefreshFireteam) return "Fireteam refresh unavailable";
    if (refreshing) return "Refreshing Fireteam data";
    if (!nextRefreshAt) return "Scheduling Fireteam refresh";
    const seconds = Math.max(0, Math.ceil((nextRefreshAt - now) / 1_000));
    return `Fireteam refresh in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }, [autoRefresh, canRefreshFireteam, nextRefreshAt, now, refreshing]);

  return <><CompletionPing notice={completionNotice} onDismiss={dismissCompletion} /><aside ref={timerRail} className={styles.fireteamRefreshRail}>
    <div className={`${styles.fireteamRefreshDock} ${timerPinned ? styles.fireteamRefreshDockPinned : ""}`}>
      <span className={styles.fireteamRefreshTimer} aria-live="polite"><Timer size={15} />{label}</span>
      <section className={styles.fireteamTrackedOrders}>
        <header>
          <span>Active in Destiny · {activeSeasonalOrders.length}</span>
          <Link to="/journey/season"><strong>Seasonal Hub Orders</strong><ArrowRight /></Link>
        </header>
        {activeSeasonalOrders.length
          ? activeSeasonalOrders.map((order) => <SeasonalHubOrder key={order.instanceId} order={order} />)
          : orders.isLoading
            ? <p>Loading active Hub orders…</p>
            : orders.isError
              ? <p>Hub orders are temporarily unavailable.</p>
              : <p>No active Seasonal Hub orders.</p>}
      </section>
    </div>
  </aside></>;
}

function SeasonalHubOrder({ order }: { order: QuestProgress }) {
  const activeObjective = order.objectives.find((objective) => !objective.complete) || order.objectives[0];
  return <Link className={styles.fireteamTrackedOrder} to={`/quests/${encodeURIComponent(order.instanceId)}`}>
    <div>{order.icon ? <img src={order.icon} alt="" /> : <Timer />}</div>
    <span>
      <strong>{order.name}</strong>
      <small>{activeObjective?.name || order.currentStep || order.itemType || "Seasonal Hub order"}</small>
      <i><b style={{ width: `${order.percent}%` }} /></i>
    </span>
    <em>{order.percent}%</em>
  </Link>;
}

function questComplete(quest: QuestProgress): boolean {
  return isQuestComplete(quest);
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
