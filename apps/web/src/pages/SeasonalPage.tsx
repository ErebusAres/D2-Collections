import type { JourneyProgressData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, CheckCircle2, Crown, Gift, Shield, Sparkles, Swords } from "lucide-react";
import { useMemo } from "react";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { JourneyNav } from "../components/journey/JourneyNav";
import { useGuardian } from "../context/GuardianContext";
import { api } from "../services/api/client";
import { LIVE_REFRESH_INTERVAL_MS } from "../services/liveRefresh";
import styles from "./JourneyTrackers.module.css";

export function SeasonalPage() {
  const { session, selectedCharacterId, autoRefresh, preferences, setPreference } = useGuardian();
  const tracked = useMemo(() => parseTracked(preferences["journey.tracked"]), [preferences]);
  const enabled = Boolean(session?.authenticated && selectedCharacterId);
  const journey = useQuery({
    queryKey: ["journey-progress", selectedCharacterId],
    queryFn: () => api<JourneyProgressData>(`/api/v1/me/journey?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled,
    refetchInterval: autoRefresh ? LIVE_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false
  });
  const objectives = journey.data?.data.weeklyChallenges || [];
  const alerts = objectives.filter((challenge) => /vanguard|alert|raid|dungeon|crucible/i.test(`${challenge.name} ${challenge.description}`));
  const conquests = objectives.filter((challenge) => /conquest/i.test(`${challenge.name} ${challenge.description}`));
  const seasonalTitle = journey.data?.data.titles.find((title) => /conqueror/i.test(`${title.title} ${title.name}`));
  const completedObjectives = objectives.filter((challenge) => challenge.objective.complete).length;
  const objectiveProgress = objectives.length ? Math.round(objectives.reduce((sum, challenge) => sum + challenge.objective.percent, 0) / objectives.length) : 0;
  const toggleJourney = (id: string) => {
    const next = new Set(tracked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPreference("journey.tracked", JSON.stringify([...next]));
  };

  return <AuthGate>
    <PageHeader eyebrow="Journey · Portal Ops" title="Seasonal Hub" description="Daily and weekly objectives, Vanguard Alerts, Conquests, weekly rewards, and Seasonal Title progress." actions={<Freshness observedAt={journey.data?.freshness.observedAt} warning={journey.data?.warnings[0]} />} />
    <JourneyNav />
    <QueryState loading={journey.isLoading} error={journey.error as Error} hasData={Boolean(journey.data)} onRetry={() => void journey.refetch()} />
    {journey.data && <>
      <section className={styles.seasonHero}>
        <div><Sparkles /><span><small>Seasonal Hub overview</small><h2>Weekly Progress</h2></span></div>
        <strong>{completedObjectives}<small>Objectives complete</small></strong>
        <div className={styles.seasonProgress}><span><small>Weekly objective progress</small><b>{objectives.length ? `${objectiveProgress}%` : "Unavailable"}</b></span><i><span style={{ width: `${objectiveProgress}%` }} /></i><p>{completedObjectives} of {objectives.length} objectives complete</p></div>
      </section>
      <section className={styles.featureGrid}>
        <article><CheckCircle2 /><span><small>Challenges Hub</small><strong>{objectives.length} objectives</strong><p>{completedObjectives} completed this week</p></span></article>
        <article><Gift /><span><small>Weekly Reward Track</small><strong>{completedObjectives} progress earned</strong><p>Driven by completed Seasonal Hub objectives</p></span></article>
        <article><Shield /><span><small>Vanguard Alerts</small><strong>{alerts.length} available</strong><p>{alerts.filter((challenge) => challenge.objective.complete).length} completed</p></span></article>
        <article><Swords /><span><small>Conquests</small><strong>{conquests.length} available</strong><p>{conquests.filter((challenge) => challenge.objective.complete).length} completed</p></span></article>
        <article><Crown /><span><small>Seasonal Title</small><strong>{seasonalTitle?.title || "Conqueror"}</strong><p>{seasonalTitle ? `${seasonalTitle.percent}% complete` : "No title progress returned"}</p></span></article>
      </section>
      <section className={styles.rows}>
        {objectives.map((challenge) => <article key={challenge.id} className={styles.row}>
          <span className={styles.rowIcon}>{challenge.icon ? <img src={challenge.icon} alt="" /> : <Shield />}</span>
          <div><small>{conquests.includes(challenge) ? "Conquest" : alerts.includes(challenge) ? "Vanguard Alert" : "Weekly objective"}</small><h2>{challenge.name}</h2><p>{challenge.description}</p><i><span style={{ width: `${challenge.objective.percent}%` }} /></i></div>
          <aside><strong>{challenge.objective.percent}%</strong>{challenge.objective.complete && <CheckCircle2 />}<button onClick={() => toggleJourney(challenge.id)} disabled={challenge.objective.complete} aria-label={`${tracked.has(challenge.id) ? "Untrack" : "Track"} ${challenge.name}`}><Bookmark fill={tracked.has(challenge.id) ? "currentColor" : "none"} /></button></aside>
        </article>)}
        {seasonalTitle && <article className={styles.row}>
          <span className={styles.rowIcon}>{seasonalTitle.icon ? <img src={seasonalTitle.icon} alt="" /> : <Crown />}</span>
          <div><small>Seasonal Title</small><h2>{seasonalTitle.title}</h2><p>{seasonalTitle.description}</p><i><span style={{ width: `${seasonalTitle.percent}%` }} /></i></div>
          <aside><strong>{seasonalTitle.percent}%</strong>{seasonalTitle.complete && <CheckCircle2 />}<button onClick={() => toggleJourney(seasonalTitle.recordHash)} disabled={seasonalTitle.complete} aria-label={`${tracked.has(seasonalTitle.recordHash) ? "Untrack" : "Track"} ${seasonalTitle.title}`}><Bookmark fill={tracked.has(seasonalTitle.recordHash) ? "currentColor" : "none"} /></button></aside>
        </article>}
        {!objectives.length && !seasonalTitle && <div className={styles.empty}><Sparkles /><h2>No active Seasonal Hub objectives</h2><p>No current objectives, alerts, Conquests, or Seasonal Title progress were returned for this character.</p></div>}
      </section>
    </>}
  </AuthGate>;
}

function parseTracked(value?: string): Set<string> {
  try { const parsed = JSON.parse(value || "[]"); return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []); }
  catch { return new Set(); }
}
