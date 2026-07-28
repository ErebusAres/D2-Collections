import type { JourneyProgressData, QuestData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, CheckCircle2, Gift, Sparkles } from "lucide-react";
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
  const quests = useQuery({
    queryKey: ["quests", selectedCharacterId, ""],
    queryFn: () => api<QuestData>(`/api/v1/me/quests?characterId=${encodeURIComponent(selectedCharacterId)}&pinned=`),
    enabled,
    refetchInterval: autoRefresh ? LIVE_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false
  });
  const journey = useQuery({
    queryKey: ["journey-progress", selectedCharacterId],
    queryFn: () => api<JourneyProgressData>(`/api/v1/me/journey?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled,
    refetchInterval: autoRefresh ? LIVE_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false
  });
  const seasonalPursuits = (quests.data?.data.quests || []).filter((quest) => /season|episode|artifact/i.test(`${quest.itemType || ""} ${quest.name} ${quest.description}`));
  const challenges = journey.data?.data.seasonalChallenges || [];
  const completedChallenges = challenges.filter((challenge) => challenge.complete).length;
  const challengeProgress = challenges.length ? Math.round(challenges.reduce((sum, challenge) => sum + challenge.percent, 0) / challenges.length) : 0;
  const artifact = journey.data?.data.artifact;
  const toggle = (id: string) => {
    const next = new Set(tracked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPreference("journey.tracked", JSON.stringify([...next]));
  };

  return <AuthGate>
    <PageHeader eyebrow="Journey · Current progression" title="Seasonal Hub" description="Seasonal challenges, pursuits, artifact progression, and current objectives." actions={<Freshness observedAt={journey.data?.freshness.observedAt || quests.data?.freshness.observedAt} warning={journey.data?.warnings[0] || quests.data?.warnings[0]} />} />
    <JourneyNav />
    <QueryState loading={quests.isLoading || journey.isLoading} error={(quests.error || journey.error) as Error} hasData={Boolean(quests.data || journey.data)} onRetry={() => { void quests.refetch(); void journey.refetch(); }} />
    {(journey.data || quests.data) && <>
      <section className={styles.seasonHero}>
        <div><Sparkles /><span><small>Current season</small><h2>Seasonal Progress</h2></span></div>
        <strong>{completedChallenges}<small>Challenges complete</small></strong>
        <div className={styles.seasonProgress}><span><small>Seasonal challenge progress</small><b>{challenges.length ? `${challengeProgress}%` : "Unavailable"}</b></span><i><span style={{ width: `${challengeProgress}%` }} /></i><p>{challenges.length ? `${completedChallenges} of ${challenges.length} seasonal challenges complete` : "No seasonal challenges were returned by Bungie."}</p></div>
      </section>
      <section className={styles.featureGrid}>
        <article><CheckCircle2 /><span><small>Seasonal challenges</small><strong>{completedChallenges} / {challenges.length} complete</strong><p>{challenges.filter((challenge) => !challenge.complete && challenge.percent >= 75).length} close to completion</p></span></article>
        <article><Gift /><span><small>Seasonal pursuits</small><strong>{seasonalPursuits.length} active</strong><p>{seasonalPursuits.length ? seasonalPursuits.slice(0, 2).map((quest) => quest.name).join(" · ") : "No seasonal pursuits are active."}</p></span></article>
        <article><Sparkles /><span><small>Artifact</small><strong>{artifact ? `${artifact.pointsAcquired} unlock points · +${artifact.powerBonus} Power` : "Unavailable"}</strong><p>{artifact ? `${artifact.pointsSpent} artifact points spent` : "Artifact progression was not returned."}</p></span></article>
      </section>
      {challenges.length > 0 && <section className={styles.rows}>{challenges.map((challenge) => <article key={challenge.recordHash} className={styles.row}><span className={styles.rowIcon}>{challenge.icon ? <img src={challenge.icon} alt="" /> : <Sparkles />}</span><div><small>{challenge.category}</small><h2>{challenge.name}</h2><p>{challenge.description}</p><i><span style={{ width: `${challenge.percent}%` }} /></i></div><aside><strong>{challenge.percent}%</strong><button onClick={() => toggle(challenge.recordHash)} disabled={challenge.complete} aria-label={`${tracked.has(challenge.recordHash) ? "Untrack" : "Track"} ${challenge.name}`}><Bookmark fill={tracked.has(challenge.recordHash) ? "currentColor" : "none"} /></button></aside></article>)}</section>}
    </>}
  </AuthGate>;
}

function parseTracked(value?: string): Set<string> {
  try { const parsed = JSON.parse(value || "[]"); return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []); }
  catch { return new Set(); }
}
