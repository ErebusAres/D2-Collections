import type { QuestProgress } from "@guardian-nexus/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Timer } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CompletionPing, useCompletionPings } from "../components/common/CompletionPing";
import { ObjectiveRequirementText } from "../components/quests/ObjectiveRequirementText";
import { useGuardian } from "../context/GuardianContext";
import { useFireteamQuery } from "../modules/fireteam/useFireteamQuery";
import { completionTransition, isQuestComplete } from "../modules/tracking/completionTracking";
import { LIVE_REFRESH_INTERVAL_MS } from "../services/liveRefresh";
import { FireteamPage } from "./FireteamPage";
import styles from "./Pages.module.css";

const SNAPSHOT_READ_RETRY_MS = 5_000;

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
  const self = data?.members.find((member) => member.isSelf);
  const orders = useMemo(
    () => (self?.quests || []).filter((quest) => quest.category === "order" && !isQuestComplete(quest)),
    [self?.quests]
  );
  const [now, setNow] = useState(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const [timerPinned, setTimerPinned] = useState(false);
  const timerRail = useRef<HTMLElement | null>(null);
  const completionState = useRef<Map<string, boolean> | null>(null);
  const completionContext = useRef("");
  const { notice: completionNotice, announce: announceCompletion, dismiss: dismissCompletion, clear: clearCompletions } = useCompletionPings();

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

  useEffect(() => {
    const context = `${membershipId}:${selectedCharacterId}`;
    if (completionContext.current !== context) {
      completionContext.current = context;
      completionState.current = null;
      clearCompletions();
    }
    const candidates = (self?.quests || []).filter((quest) => quest.category === "order").map((quest) => ({
      id: quest.instanceId,
      name: quest.name,
      kind: "order" as const,
      complete: isQuestComplete(quest),
      trackedInGuardianNexus: quest.sitePinned
    }));
    const transition = completionTransition(completionState.current, candidates);
    completionState.current = transition.state;
    announceCompletion(transition.newlyCompleted);
  }, [announceCompletion, clearCompletions, membershipId, selectedCharacterId, self?.quests]);

  useEffect(() => {
    if (!autoRefresh || !session?.authenticated || !selectedCharacterId) {
      setRefreshing(false);
      return;
    }
    if (result.isLoading || !result.data) return;
    const previousVersion = Number(data?.snapshotVersion || 0);
    const committedDueMs = Date.parse(data?.pageRefreshDueAt || "");
    const retryMs = Date.parse(data?.refreshRetryAt || "");
    const dueMs = data?.refreshState === "delayed" && Number.isFinite(retryMs) ? retryMs : committedDueMs;
    const waitingForFirstSnapshot = previousVersion <= 0 || !Number.isFinite(dueMs);
    let stopped = false;
    let timer = 0;
    const readCommittedSnapshot = async () => {
      setRefreshing(true);
      try {
        const response = await result.refetch();
        const nextVersion = Number(response.data?.data.snapshotVersion || 0);
        if (nextVersion > previousVersion) {
          await Promise.allSettled([
            queryClient.refetchQueries({ queryKey: ["fireteam-recent-items", selectedCharacterId], exact: true, type: "active" }),
            queryClient.refetchQueries({ queryKey: ["fireteam-activity", membershipId, selectedCharacterId], exact: true, type: "active" })
          ]);
          if (!stopped) setRefreshing(false);
          return;
        }
        if (stopped) return;
      } catch { /* Keep the last committed Fireteam snapshot visible. */ }
      if (!stopped) timer = window.setTimeout(() => void readCommittedSnapshot(), SNAPSHOT_READ_RETRY_MS);
    };
    const delay = waitingForFirstSnapshot ? 0 : Math.max(0, dueMs - Date.now());
    setRefreshing(delay === 0);
    timer = window.setTimeout(() => void readCommittedSnapshot(), delay);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [autoRefresh, data?.pageRefreshDueAt, data?.refreshRetryAt, data?.refreshState, data?.snapshotVersion, membershipId, queryClient, result.isLoading, result.refetch, selectedCharacterId, session?.authenticated]);

  const label = useMemo(() => {
    if (!autoRefresh) return "Fireteam refresh off";
    if (!session?.authenticated || !selectedCharacterId) return "Fireteam refresh unavailable";
    if (Number(data?.snapshotVersion || 0) <= 0) return "Preparing Fireteam snapshot";
    const retryMs = Date.parse(data?.refreshRetryAt || "");
    if (data?.refreshState === "delayed" && Number.isFinite(retryMs) && retryMs > now) {
      const retrySeconds = Math.max(0, Math.ceil((retryMs - now) / 1_000));
      return `Fireteam retry in ${Math.floor(retrySeconds / 60)}:${String(retrySeconds % 60).padStart(2, "0")}`;
    }
    if (refreshing || data?.refreshState === "refreshing" || data?.refreshState === "delayed") return "Refreshing Fireteam";
    const dueMs = Date.parse(data?.pageRefreshDueAt || "");
    if (!Number.isFinite(dueMs)) return "Preparing Fireteam snapshot";
    const remainingMs = Math.min(LIVE_REFRESH_INTERVAL_MS, dueMs - now);
    const seconds = Math.max(0, Math.ceil(remainingMs / 1_000));
    return `Fireteam refresh in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }, [autoRefresh, data?.pageRefreshDueAt, data?.refreshRetryAt, data?.refreshState, data?.snapshotVersion, now, refreshing, selectedCharacterId, session?.authenticated]);

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
          : result.isLoading
            ? <p>Loading active Hub orders…</p>
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
