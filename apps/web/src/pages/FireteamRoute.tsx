import type { FireteamSharingMode, QuestData, QuestProgress } from "@guardian-nexus/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Timer } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, mutationHeaders, queuedApi } from "../services/api/client";
import { pinsKey, useGuardian } from "../context/GuardianContext";
import { LIVE_REFRESH_INTERVAL_MS } from "../services/liveRefresh";
import { parseTrackedBuilds } from "../modules/buildAdvisor/buildTracking";
import { CompletionPing, useCompletionPings } from "../components/common/CompletionPing";
import { ObjectiveRequirementText } from "../components/quests/ObjectiveRequirementText";
import { completionTransition, isQuestComplete } from "../modules/tracking/completionTracking";
import { useFireteamQuery } from "../modules/fireteam/useFireteamQuery";
import { FireteamPage } from "./FireteamPage";
import styles from "./Pages.module.css";

const FIRETEAM_REFRESH_DEADLINE_PREFIX = "guardian-nexus:fireteam-page-refresh-deadline:v2:";

export function FireteamRoute() {
  return <div className={styles.fireteamRoute}>
    <FireteamRefreshCountdown />
    <div className={styles.fireteamPageContent}><FireteamPage /></div>
  </div>;
}

function FireteamRefreshCountdown() {
  const { session, selectedCharacterId, autoRefresh, preferences } = useGuardian();
  const queryClient = useQueryClient();
  const membershipId = session?.guardian?.membershipId || "";
  const result = useFireteamQuery(membershipId, selectedCharacterId, Boolean(session?.authenticated));
  const orders = useQuery({
    queryKey: ["quests", selectedCharacterId, ""],
    queryFn: () => api<QuestData>(`/api/v1/me/quests?characterId=${encodeURIComponent(selectedCharacterId)}&pinned=`),
    enabled: Boolean(session?.authenticated && selectedCharacterId),
    refetchInterval: false,
    refetchIntervalInBackground: false
  });
  const data = result.data?.data;
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
  const shareRefreshRunning = useRef(false);
  const completionState = useRef<Map<string, boolean> | null>(null);
  const completionContext = useRef("");
  const { notice: completionNotice, announce: announceCompletion, dismiss: dismissCompletion, clear: clearCompletions } = useCompletionPings();
  const timerRail = useRef<HTMLElement | null>(null);
  const canRefreshProgress = Boolean(session?.authenticated && selectedCharacterId);
  const refreshDeadlineKey = membershipId && selectedCharacterId ? `${FIRETEAM_REFRESH_DEADLINE_PREFIX}${membershipId}:${selectedCharacterId}` : "";
  const shouldRenewTemporaryShare = Boolean(data?.sharingEnabled && mode === "temporary");
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

  const refreshFireteamPage = useCallback(async () => {
    if (refreshRunning.current || !selectedCharacterId) return;
    refreshRunning.current = true;
    setRefreshing(true);
    const attempt = async (work: () => Promise<unknown>) => {
      try { await work(); } catch { /* Each section retains its last successful data. */ }
    };
    try {
      // The roster read starts at the displayed deadline. The remaining page
      // sections follow sequentially so a slower write cannot delay the live
      // member update or create a simultaneous request burst.
      await attempt(() => result.refetch());
      // One pursuit snapshot supplies both priority 1 (quests) and priority 2
      // (Seasonal Hub orders). Do not duplicate the Bungie request.
      await attempt(() => queryClient.refetchQueries({ queryKey: ["quests", selectedCharacterId, ""], exact: true, type: "active" }));
      // Persistent shares are rebuilt by the five-minute Worker cron. Only
      // temporary shares need a browser renewal to extend their 15-minute lease.
      if (shouldRenewTemporaryShare && !shareRefreshRunning.current) {
        shareRefreshRunning.current = true;
        await attempt(() => queuedApi("/api/v1/fireteam/share", {
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
        }, { priority: 100 }).finally(() => { shareRefreshRunning.current = false; }));
      }
      // One coordinator refreshes the full Fireteam page sequentially. This
      // keeps the visible five-minute countdown identical to the actual read
      // cadence without sending a burst of Guardian requests.
      await attempt(() => queryClient.refetchQueries({ queryKey: ["recent-items", selectedCharacterId], exact: true, type: "active" }));
      await attempt(() => queryClient.refetchQueries({ queryKey: ["fireteam-activity", membershipId, selectedCharacterId], exact: true, type: "active" }));
    } finally {
      refreshRunning.current = false;
      setRefreshing(false);
    }
  }, [buildTracked, collectionTracked, guardianRankTracked, hiddenKeysSignature, journeyTracked, membershipId, mode, queryClient, result.refetch, selectedCharacterId, session?.csrfToken, shouldRenewTemporaryShare, storageKey]);

  useEffect(() => {
    if (!autoRefresh || !canRefreshProgress) {
      setNextRefreshAt(null);
      return;
    }
    let timer = 0;
    const schedule = (deadline: number) => {
      if (refreshDeadlineKey) {
        try { localStorage.setItem(refreshDeadlineKey, String(deadline)); } catch { /* The in-memory deadline still works. */ }
      }
      setNextRefreshAt(deadline);
      const delay = Math.max(0, deadline - Date.now());
      timer = window.setTimeout(async () => {
        const nextDeadline = Date.now() + LIVE_REFRESH_INTERVAL_MS;
        schedule(nextDeadline);
        await refreshFireteamPage();
      }, delay);
    };
    const storedDeadline = readRefreshDeadline(refreshDeadlineKey);
    schedule(storedDeadline || Date.now() + LIVE_REFRESH_INTERVAL_MS);
    const syncDeadline = (event: StorageEvent) => {
      if (event.key !== refreshDeadlineKey || !event.newValue) return;
      const deadline = Number(event.newValue);
      if (!Number.isFinite(deadline) || deadline <= Date.now()) return;
      window.clearTimeout(timer);
      schedule(deadline);
    };
    window.addEventListener("storage", syncDeadline);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("storage", syncDeadline);
    };
  }, [autoRefresh, canRefreshProgress, refreshDeadlineKey, refreshFireteamPage]);

  const label = useMemo(() => {
    if (!autoRefresh) return "Fireteam page refresh off";
    if (!session?.authenticated || !selectedCharacterId) return "Fireteam page refresh unavailable";
    if (refreshing) return "Refreshing Fireteam page";
    if (nextRefreshAt === null) return "Scheduling Fireteam page refresh";
    const seconds = Math.max(0, Math.ceil((nextRefreshAt - now) / 1_000));
    return `Fireteam page refresh in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }, [autoRefresh, nextRefreshAt, now, refreshing, selectedCharacterId, session?.authenticated]);

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
      <small><ObjectiveRequirementText value={activeObjective?.name || order.currentStep || order.itemType || "Seasonal Hub order"} /></small>
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

function readRefreshDeadline(storageKey: string): number | undefined {
  if (!storageKey) return undefined;
  try {
    const value = Number(localStorage.getItem(storageKey) || 0);
    if (!Number.isFinite(value) || value <= 0) return undefined;
    return Math.min(value, Date.now() + LIVE_REFRESH_INTERVAL_MS);
  } catch { return undefined; }
}
