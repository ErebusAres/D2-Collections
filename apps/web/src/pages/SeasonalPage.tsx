import type { JourneyProgressData, JourneyRecord, QuestData, QuestProgress } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, CheckCircle2, CircleGauge, Clock3, PackageOpen, Sparkles } from "lucide-react";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { JourneyNav } from "../components/journey/JourneyNav";
import { useGuardian } from "../context/GuardianContext";
import { isSeasonalPursuit, pursuitExpiryLabel, pursuitProgressLabel } from "../modules/journey/progressSummary";
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
  const quests = useQuery({
    queryKey: ["quests", selectedCharacterId, ""],
    queryFn: () => api<QuestData>(`/api/v1/me/quests?characterId=${encodeURIComponent(selectedCharacterId)}&pinned=`),
    enabled,
    refetchInterval: autoRefresh ? LIVE_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false
  });
  const data = journey.data?.data;
  const challenges = data?.seasonalChallenges || [];
  const allPursuits = quests.data?.data.quests || [];
  const hubOrders = allPursuits.filter((quest) => quest.category === "order");
  const seasonalPursuits = allPursuits.filter((quest) => quest.category !== "order" && isSeasonalPursuit(quest));
  const completedChallenges = challenges.filter((challenge) => challenge.complete).length;
  const challengeProgress = challenges.length
    ? Math.round(challenges.reduce((sum, challenge) => sum + challenge.percent, 0) / challenges.length)
    : undefined;
  const artifact = data?.artifact;
  const toggleJourney = (id: string) => {
    const next = new Set(tracked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPreference("journey.tracked", JSON.stringify([...next]));
  };
  const hasData = Boolean(journey.data || quests.data);

  return <AuthGate>
    <PageHeader
      eyebrow="Current season"
      title="Seasonal Hub"
      description="Review Artifact progress, seasonal challenges, and Hub orders for your selected character."
      actions={<Freshness observedAt={journey.data?.freshness.observedAt || quests.data?.freshness.observedAt} warning={journey.data?.warnings[0] || quests.data?.warnings[0]} />}
    />
    <JourneyNav />
    <QueryState loading={journey.isLoading || quests.isLoading} error={(journey.error || quests.error) as Error} hasData={hasData} onRetry={() => { void journey.refetch(); void quests.refetch(); }} />
    {hasData && <>
      <section className={styles.seasonHero}>
        <div><Sparkles /><span><small>Current seasonal progress</small><h2>{hubOrders[0]?.activityName || "Seasonal Hub"}</h2></span></div>
        <strong>{hubOrders.length}<small>Hub orders active</small></strong>
        <div className={styles.seasonProgress}>
          <span><small>Seasonal challenges</small><b>{challengeProgress === undefined ? "Not reported" : `${challengeProgress}%`}</b></span>
          <i aria-hidden="true"><span style={{ width: `${challengeProgress || 0}%` }} /></i>
          <p>{challenges.length ? `${completedChallenges} of ${challenges.length} challenges complete` : "No seasonal challenge records are currently exposed."}</p>
        </div>
      </section>

      <section className={styles.featureGrid}>
        <article><CircleGauge /><span><small>Artifact</small><strong>{artifact ? `+${artifact.powerBonus} Power` : "Not reported"}</strong><p>{artifact ? `${artifact.pointsSpent} of ${artifact.pointsAcquired} unlock points spent` : "Bungie returned no active Artifact progression."}</p></span></article>
        <article><PackageOpen /><span><small>Hub orders</small><strong>{hubOrders.length} active</strong><p>{summarizePursuits(hubOrders, "No Hub orders are currently held.")}</p></span></article>
        <article><CheckCircle2 /><span><small>Seasonal challenges</small><strong>{completedChallenges} / {challenges.length}</strong><p>{challenges.filter((challenge) => !challenge.complete && challenge.percent >= 75).length} close to completion</p></span></article>
      </section>

      <JourneySection title="Hub Orders" detail="Character pursuits identified by Bungie as orders." count={hubOrders.length}>
        {hubOrders.length
          ? hubOrders.map((quest) => <PursuitRow key={quest.instanceId} quest={quest} />)
          : <JourneyEmpty icon={<PackageOpen />} title="No active Hub orders" detail="Orders will appear here when they are present in the selected Guardian's Pursuits inventory." />}
      </JourneySection>

      <JourneySection title="Seasonal Challenges" detail="Account and character challenge records with live completion where Bungie exposes it." count={challenges.length}>
        {challenges.length
          ? challenges.map((challenge) => <ChallengeRow key={challenge.recordHash} challenge={challenge} tracked={tracked.has(challenge.recordHash)} onTrack={() => toggleJourney(challenge.recordHash)} />)
          : <JourneyEmpty icon={<Sparkles />} title="No seasonal challenge records" detail="The current manifest or profile did not return active Seasonal Challenge records. No substitute objectives are shown." />}
      </JourneySection>

      {seasonalPursuits.length > 0 && <JourneySection title="Related Pursuits" detail="Seasonal, episodic, Artifact, and Portal pursuits currently held by this Guardian." count={seasonalPursuits.length}>
        {seasonalPursuits.map((quest) => <PursuitRow key={quest.instanceId} quest={quest} />)}
      </JourneySection>}
    </>}
  </AuthGate>;
}

function JourneySection({ title, detail, count, children }: { title: string; detail: string; count: number; children: ReactNode }) {
  return <section className={styles.trackerSection}>
    <header><div><span>{title}</span><p>{detail}</p></div><strong>{count}</strong></header>
    <div className={styles.rows}>{children}</div>
  </section>;
}

function PursuitRow({ quest }: { quest: QuestProgress }) {
  const expiry = pursuitExpiryLabel(quest.expiresAt);
  return <Link to={`/quests/${encodeURIComponent(quest.instanceId)}`} className={styles.row}>
    <span className={styles.rowIcon}>{quest.icon ? <img src={quest.icon} alt="" /> : <PackageOpen />}</span>
    <div>
      <small>{quest.category === "order" ? "Hub order" : quest.itemType || "Seasonal pursuit"}{expiry ? ` · ${expiry}` : ""}</small>
      <h2>{quest.name}</h2>
      <p>{quest.currentStep || quest.description}</p>
      {quest.objectives.length > 0 && <i aria-hidden="true"><span style={{ width: `${quest.percent}%` }} /></i>}
    </div>
    <aside><strong>{pursuitProgressLabel(quest)}</strong>{quest.percent >= 100 ? <CheckCircle2 /> : <Clock3 />}</aside>
  </Link>;
}

function ChallengeRow({ challenge, tracked, onTrack }: { challenge: JourneyRecord; tracked: boolean; onTrack: () => void }) {
  return <article className={styles.row}>
    <span className={styles.rowIcon}>{challenge.icon ? <img src={challenge.icon} alt="" /> : <Sparkles />}</span>
    <div><small>{challenge.category || "Seasonal challenge"}</small><h2>{challenge.name}</h2><p>{challenge.description}</p><i aria-hidden="true"><span style={{ width: `${challenge.percent}%` }} /></i></div>
    <aside><strong>{challenge.percent}%</strong>{challenge.complete && <CheckCircle2 />}<button onClick={onTrack} disabled={challenge.complete} aria-label={`${tracked ? "Untrack" : "Track"} ${challenge.name}`}><Bookmark fill={tracked ? "currentColor" : "none"} /></button></aside>
  </article>;
}

function JourneyEmpty({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <div className={styles.compactEmpty}>{icon}<div><h2>{title}</h2><p>{detail}</p></div></div>;
}

function summarizePursuits(quests: QuestProgress[], fallback: string): string {
  return quests.length ? quests.slice(0, 2).map((quest) => quest.name).join(" · ") : fallback;
}

function parseTracked(value?: string): Set<string> {
  try { const parsed = JSON.parse(value || "[]"); return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []); }
  catch { return new Set(); }
}
