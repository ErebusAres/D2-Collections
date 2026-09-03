import type { QuestData, QuestProgress } from "@guardian-nexus/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Timer } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CompletionPing, useCompletionPings } from "../components/common/CompletionPing";
import { ObjectiveRequirementText } from "../components/quests/ObjectiveRequirementText";
import { useGuardian } from "../context/GuardianContext";
import { useFireteamQuery } from "../services/fireteam/useFireteamQuery";
import { completionTransition, isQuestComplete } from "../modules/tracking/completionTracking";
import { LIVE_REFRESH_INTERVAL_MS } from "../services/liveRefresh";
import { api } from "../services/api/client";
import { FireteamPage } from "./FireteamPage";
import styles from "./Pages.module.css";

const EMPTY_QUESTS: QuestProgress[] = [];

export function FireteamRoute() {
  return <div className={styles.fireteamRoute}>
    <FireteamRefreshCountdown />
    <div className={styles.fireteamPageContent}><FireteamPage /></div>
  </div>;
}

function FireteamRefreshCountdown() {
  const { session, selectedCharacterId, autoRefresh } = useGuardian();
  const queryClient = useQueryClient();
  const membershipId = session?.guardian?.membershipId || "";
  const result = useFireteamQuery(membershipId, selectedCharacterId, Boolean(session?.authenticated));
  const data = result.data?.data;
  const ordersResult = useQuery({
    queryKey: ["quests", selectedCharacterId, ""],
    queryFn: () => api<QuestData>(`/api/v1/me/quests?characterId=${encodeURIComponent(selectedCharacterId)}&pinned=`),
    enabled: Boolean(session?.authenticated && selectedCharacterId),
    staleTime: 60_000,
    refetchInterval: false
  });
  const allOrders = ordersResult.data?.data.quests || EMPTY_QUESTS;
  const orders = useMemo(
    () => allOrders.filter((quest) => quest.category === "order" && !isQuestComplete(quest)),
    [allOrders]
  );
  const [now, setNow] = useState(() => Date.now());
  const [timerPinned, setTimerPinned] = useState(false);
  const timerRail = useRef<HTMLElement | null>(null);
  const previousSnapshotVersion = useRef<number | undefined>(undefined);
  const completionState = useRef<Map<string, boolean> | null>(null);
  const completionContext = useRef("");
  const { notice: completionNotice, announce: announceCompletion, dismiss: dismissCompletion, clear: clearCompletions } = useCompletionPings();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!autoRefresh || !data?.sharingEnabled) return;
    const timer = window.setInterval(() => void result.refetch(), 60e3);
    return () => window.clearInterval(timer);
  }, [autoRefresh, data?.sharingEnabled, result.refetch]);

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

  useEffect(() => {
    const context = `${membershipId}:${selectedCharacterId}`;
    if (completionContext.current !== context) {
      completionContext.current = context;
      completionState.current = null;
      clearCompletions();
    }
    const candidates = allOrders.filter((quest) => quest.category === "order").map((quest) => ({
      id: quest.instanceId,
      name: quest.name,
      kind: "order" as const,
      complete: isQuestComplete(quest),
      trackedInGuardianNexus: quest.sitePinned
    }));
    const transition = completionTransition(completionState.current, candidates);
    completionState.current = transition.state;
    announceCompletion(transition.newlyCompleted);
  }, [allOrders, announceCompletion, clearCompletions, membershipId, selectedCharacterId]);

  useEffect(() => {
    const nextVersion = Number(data?.snapshotVersion || 0);
    const previousVersion = previousSnapshotVersion.current;
    previousSnapshotVersion.current = nextVersion;
    if (previousVersion === undefined || nextVersion <= previousVersion) return;
    void Promise.allSettled([
      queryClient.refetchQueries({ queryKey: ["fireteam-recent-items", selectedCharacterId], exact: true, type: "active" }),
      queryClient.refetchQueries({ queryKey: ["fireteam-activity", membershipId, selectedCharacterId], exact: true, type: "active" }),
      queryClient.refetchQueries({ queryKey: ["quests", selectedCharacterId, ""], exact: true, type: "active" })
    ]);
  }, [data?.snapshotVersion, membershipId, queryClient, selectedCharacterId]);

  const label = useMemo(() => {
    if (!autoRefresh) return "Fireteam refresh off";
    if (!session?.authenticated || !selectedCharacterId) return "Fireteam refresh unavailable";
    if (!data?.sharingEnabled) return "Share to enable Fireteam sync";
    if (Number(data?.snapshotVersion || 0) <= 0) return "Preparing Fireteam";
    const retryMs = Date.parse(data?.refreshRetryAt || "");
    if (data?.refreshState === "delayed" && Number.isFinite(retryMs) && retryMs > now) {
      const retrySeconds = Math.max(0, Math.ceil((retryMs - now) / 1_000));
      return `Fireteam retry in ${Math.floor(retrySeconds / 60)}:${String(retrySeconds % 60).padStart(2, "0")}`;
    }
    if (data?.refreshState === "delayed") return "Fireteam refresh delayed";
    if (data?.refreshState === "refreshing") return "Refreshing Fireteam";
    const dueMs = Date.parse(data?.pageRefreshDueAt || "");
    if (!Number.isFinite(dueMs)) return "Preparing Fireteam";
    if (dueMs <= now) return "Refreshing Fireteam";
    const remainingMs = Math.min(LIVE_REFRESH_INTERVAL_MS, dueMs - now);
    const seconds = Math.max(0, Math.ceil(remainingMs / 1_000));
    return `Fireteam refresh in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }, [autoRefresh, data?.pageRefreshDueAt, data?.refreshRetryAt, data?.refreshState, data?.sharingEnabled, data?.snapshotVersion, now, selectedCharacterId, session?.authenticated]);

  return <><CompletionPing notice={completionNotice} onDismiss={dismissCompletion} /><aside ref={timerRail} className={styles.fireteamRefreshRail}>
    <div className={`${styles.fireteamRefreshDock} ${timerPinned ? styles.fireteamRefreshDockPinned : ""}`}>
      <span className={styles.fireteamRefreshTimer} aria-live="polite"><Timer size={15} />{label}</span>
      <section className={styles.fireteamTrackedOrders}>
        <header>
          <span>Active Orders · {orders.length}</span>
          <Link to="/journey/season"><strong>Seasonal Hub Orders</strong><ArrowRight /></Link>
        </header>
        {orders.length
          ? orders.map((order) => <SeasonalHubOrder key={order.instanceId} order={order} />)
          : ordersResult.isLoading
            ? <p>Loading active Hub orders…</p>
            : ordersResult.error
              ? <p>Seasonal Hub orders are unavailable. <button type="button" onClick={() => void ordersResult.refetch()}>Retry</button></p>
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
