import type { JourneyProgressData, QuestData, QuestProgress } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, CalendarDays, CheckCircle2, Clock3, Crosshair } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { JourneyNav } from "../components/journey/JourneyNav";
import { useGuardian } from "../context/GuardianContext";
import { bountyCadence, pursuitExpiryLabel, pursuitProgressLabel } from "../modules/journey/progressSummary";
import { api } from "../services/api/client";
import { LIVE_REFRESH_INTERVAL_MS } from "../services/liveRefresh";
import styles from "./JourneyTrackers.module.css";

export function WeeklyProgressPage() {
  const { session, selectedCharacterId, autoRefresh, preferences, setPreference } = useGuardian();
  const tracked = useMemo(() => parseTracked(preferences["journey.tracked"]), [preferences]);
  const enabled = Boolean(session?.authenticated && selectedCharacterId);
  const result = useQuery({
    queryKey: ["journey-progress", selectedCharacterId],
    queryFn: () => api<JourneyProgressData>(`/api/v1/me/journey?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled,
    refetchInterval: autoRefresh ? LIVE_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false
  });
  const quests = useQuery({
    queryKey: ["quests", selectedCharacterId, ""],
    queryFn: () => api<QuestData>(`/api/v1/me/quests?characterId=${encodeURIComponent(selectedCharacterId)}&pinned=`),
    enabled,
    refetchInterval: autoRefresh ? LIVE_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false
  });
  const weekly = result.data?.data.weeklyChallenges || [];
  const weeklyPursuits = (quests.data?.data.quests || []).filter((quest) => bountyCadence(quest) === "weekly");
  const completed = weekly.filter((challenge) => challenge.objective.complete).length + weeklyPursuits.filter((quest) => quest.percent >= 100).length;
  const total = weekly.length + weeklyPursuits.length;
  const toggle = (id: string) => {
    const next = new Set(tracked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPreference("journey.tracked", JSON.stringify([...next]));
  };
  const hasData = Boolean(result.data || quests.data);

  return <AuthGate>
    <PageHeader eyebrow="Journey · Reset checklist" title="Weekly Progress" description="Weekly activity challenges and time-limited pursuits for your selected Guardian." actions={<Freshness observedAt={result.data?.freshness.observedAt || quests.data?.freshness.observedAt} warning={result.data?.warnings[0] || quests.data?.warnings[0]} />} />
    <JourneyNav />
    <QueryState loading={result.isLoading || quests.isLoading} error={(result.error || quests.error) as Error} hasData={hasData} onRetry={() => { void result.refetch(); void quests.refetch(); }} />
    {hasData && <>
      <section className={styles.metrics}>
        <span><small>Weekly items</small><strong>{total}</strong></span>
        <span><small>Activity challenges</small><strong>{weekly.length}</strong></span>
        <span><small>Weekly pursuits</small><strong>{weeklyPursuits.length}</strong></span>
        <span><small>Complete</small><strong>{completed}</strong></span>
        <span><small>Near completion</small><strong>{weekly.filter((challenge) => challenge.objective.percent >= 75 && !challenge.objective.complete).length + weeklyPursuits.filter((quest) => quest.percent >= 75 && quest.percent < 100).length}</strong></span>
      </section>

      <section className={styles.trackerSection}>
        <header><div><span>Activity Challenges</span><p>Challenge counters returned with your character's currently available activities.</p></div><strong>{weekly.length}</strong></header>
        <div className={styles.rows}>
          {weekly.length ? weekly.map((challenge) => <article key={challenge.id} className={styles.row}>
            <span className={styles.rowIcon}>{challenge.icon ? <img src={challenge.icon} alt="" /> : <CalendarDays />}</span>
            <div><small>Weekly activity challenge</small><h2>{challenge.name}</h2><p>{challenge.objective.name || challenge.description}</p><i aria-hidden="true"><span style={{ width: `${challenge.objective.percent}%` }} /></i></div>
            <aside><strong>{objectiveValue(challenge.objective)}</strong>{challenge.objective.complete ? <CheckCircle2 /> : <Clock3 />}<button onClick={() => toggle(challenge.id)} disabled={challenge.objective.complete} aria-label={`${tracked.has(challenge.id) ? "Untrack" : "Track"} ${challenge.name}`}><Bookmark fill={tracked.has(challenge.id) ? "currentColor" : "none"} /></button></aside>
          </article>) : <div className={styles.compactEmpty}><CalendarDays /><div><h2>No activity challenges returned</h2><p>Bungie did not expose an active weekly challenge counter for this character.</p></div></div>}
        </div>
      </section>

      <section className={styles.trackerSection}>
        <header><div><span>Weekly Pursuits</span><p>Weekly bounties and orders from the selected Guardian's Pursuits inventory.</p></div><strong>{weeklyPursuits.length}</strong></header>
        <div className={styles.rows}>
          {weeklyPursuits.length ? weeklyPursuits.map((quest) => <WeeklyPursuitRow key={quest.instanceId} quest={quest} />) : <div className={styles.compactEmpty}><Crosshair /><div><h2>No weekly pursuits held</h2><p>Weekly bounties and orders will appear here after they are acquired.</p></div></div>}
        </div>
      </section>
    </>}
  </AuthGate>;
}

function WeeklyPursuitRow({ quest }: { quest: QuestProgress }) {
  const expiry = pursuitExpiryLabel(quest.expiresAt);
  return <Link to={`/quests/${encodeURIComponent(quest.instanceId)}`} className={styles.row}>
    <span className={styles.rowIcon}>{quest.icon ? <img src={quest.icon} alt="" /> : <Crosshair />}</span>
    <div><small>{quest.category === "order" ? "Weekly order" : "Weekly bounty"}{expiry ? ` · ${expiry}` : ""}</small><h2>{quest.name}</h2><p>{quest.currentStep || quest.description}</p>{quest.objectives.length > 0 && <i aria-hidden="true"><span style={{ width: `${quest.percent}%` }} /></i>}</div>
    <aside><strong>{pursuitProgressLabel(quest)}</strong>{quest.percent >= 100 ? <CheckCircle2 /> : <Clock3 />}</aside>
  </Link>;
}

function objectiveValue(objective: JourneyProgressData["weeklyChallenges"][number]["objective"]): string {
  if (objective.complete) return "Complete";
  return objective.completionValue > 0 ? `${objective.progress.toLocaleString()} / ${objective.completionValue.toLocaleString()}` : `${objective.percent}%`;
}

function parseTracked(value?: string): Set<string> {
  try { const parsed = JSON.parse(value || "[]"); return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []); }
  catch { return new Set(); }
}
