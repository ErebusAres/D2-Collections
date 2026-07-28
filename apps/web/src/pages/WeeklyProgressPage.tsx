import type { QuestData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { JourneyNav } from "../components/journey/JourneyNav";
import { useGuardian } from "../context/GuardianContext";
import { api } from "../services/api/client";
import { LIVE_REFRESH_INTERVAL_MS } from "../services/liveRefresh";
import styles from "./JourneyTrackers.module.css";

export function WeeklyProgressPage() {
  const { session, selectedCharacterId, autoRefresh } = useGuardian();
  const result = useQuery({
    queryKey: ["quests", selectedCharacterId, ""],
    queryFn: () => api<QuestData>(`/api/v1/me/quests?characterId=${encodeURIComponent(selectedCharacterId)}&pinned=`),
    enabled: Boolean(session?.authenticated && selectedCharacterId),
    refetchInterval: autoRefresh ? LIVE_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false
  });
  const weekly = (result.data?.data.quests || []).filter((quest) => /weekly/i.test(`${quest.itemType || ""} ${quest.name} ${quest.description}`));
  return <AuthGate>
    <PageHeader eyebrow="Journey · Reset checklist" title="Weekly Progress" description="Weekly pursuits currently visible in your Bungie profile." actions={<Freshness observedAt={result.data?.freshness.observedAt} warning={result.data?.warnings[0]} />} />
    <JourneyNav />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(result.data)} onRetry={() => void result.refetch()} />
    {result.data && <>
      <section className={styles.metrics}>
        <span><small>Known weekly</small><strong>{weekly.length}</strong></span>
        <span><small>Complete</small><strong>{weekly.filter((quest) => quest.percent >= 100).length}</strong></span>
        <span><small>Near completion</small><strong>{weekly.filter((quest) => quest.percent >= 75 && quest.percent < 100).length}</strong></span>
        <span><small>Weekly reset</small><strong>Tuesday</strong></span>
      </section>
      <section className={styles.rows}>
        {weekly.length ? weekly.map((quest) => <Link key={quest.instanceId} to={`/quests/${encodeURIComponent(quest.instanceId)}`} className={styles.row}>
          <span className={styles.rowIcon}>{quest.icon ? <img src={quest.icon} alt="" /> : <CalendarDays />}</span>
          <div><small>{quest.activityName || quest.itemType || "Weekly pursuit"}</small><h2>{quest.name}</h2><p>{quest.currentStep}</p><i><span style={{ width: `${quest.percent}%` }} /></i></div>
          <aside><strong>{quest.percent}%</strong>{quest.percent >= 100 ? <CheckCircle2 /> : <Clock3 />}</aside>
        </Link>) : <div className={styles.empty}><CalendarDays /><h2>No weekly pursuits detected</h2><p>Featured activities and milestones need a separate Bungie milestone feed; they are not inferred from unrelated profile values.</p></div>}
      </section>
    </>}
  </AuthGate>;
}
