import type { JourneyProgressData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, CalendarDays, CheckCircle2, Clock3 } from "lucide-react";
import { useMemo } from "react";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { JourneyNav } from "../components/journey/JourneyNav";
import { useGuardian } from "../context/GuardianContext";
import { api } from "../services/api/client";
import { LIVE_REFRESH_INTERVAL_MS } from "../services/liveRefresh";
import styles from "./JourneyTrackers.module.css";

export function WeeklyProgressPage() {
  const { session, selectedCharacterId, autoRefresh, preferences, setPreference } = useGuardian();
  const tracked = useMemo(() => parseTracked(preferences["journey.tracked"]), [preferences]);
  const result = useQuery({
    queryKey: ["journey-progress", selectedCharacterId],
    queryFn: () => api<JourneyProgressData>(`/api/v1/me/journey?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled: Boolean(session?.authenticated && selectedCharacterId),
    refetchInterval: autoRefresh ? LIVE_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false
  });
  const weekly = result.data?.data.weeklyChallenges || [];
  const toggle = (id: string) => {
    const next = new Set(tracked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPreference("journey.tracked", JSON.stringify([...next]));
  };
  return <AuthGate>
    <PageHeader eyebrow="Journey · Reset checklist" title="Weekly Progress" description="Weekly challenge progress returned for your selected character." actions={<Freshness observedAt={result.data?.freshness.observedAt} warning={result.data?.warnings[0]} />} />
    <JourneyNav />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(result.data)} onRetry={() => void result.refetch()} />
    {result.data && <>
      <section className={styles.metrics}>
        <span><small>Weekly challenges</small><strong>{weekly.length}</strong></span>
        <span><small>Complete</small><strong>{weekly.filter((challenge) => challenge.objective.complete).length}</strong></span>
        <span><small>Near completion</small><strong>{weekly.filter((challenge) => challenge.objective.percent >= 75 && !challenge.objective.complete).length}</strong></span>
        <span><small>Tracked here</small><strong>{weekly.filter((challenge) => tracked.has(challenge.id)).length}</strong></span>
      </section>
      <section className={styles.rows}>
        {weekly.length ? weekly.map((challenge) => <article key={challenge.id} className={styles.row}>
          <span className={styles.rowIcon}>{challenge.icon ? <img src={challenge.icon} alt="" /> : <CalendarDays />}</span>
          <div><small>Weekly challenge</small><h2>{challenge.name}</h2><p>{challenge.objective.name || challenge.description}</p><i><span style={{ width: `${challenge.objective.percent}%` }} /></i></div>
          <aside><strong>{challenge.objective.percent}%</strong>{challenge.objective.complete ? <CheckCircle2 /> : <Clock3 />}<button onClick={() => toggle(challenge.id)} disabled={challenge.objective.complete} aria-label={`${tracked.has(challenge.id) ? "Untrack" : "Track"} ${challenge.name}`}><Bookmark fill={tracked.has(challenge.id) ? "currentColor" : "none"} /></button></aside>
        </article>) : <div className={styles.empty}><CalendarDays /><h2>No weekly challenges detected</h2><p>Bungie returned no active challenge rows for this character.</p></div>}
      </section>
    </>}
  </AuthGate>;
}

function parseTracked(value?: string): Set<string> {
  try { const parsed = JSON.parse(value || "[]"); return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []); }
  catch { return new Set(); }
}
