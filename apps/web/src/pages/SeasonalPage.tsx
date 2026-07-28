import type { JourneyProgressData, QuestData, RewardsPassData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, ExternalLink, Gift, Gauge, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { JourneyNav } from "../components/journey/JourneyNav";
import { useGuardian } from "../context/GuardianContext";
import { rewardLevelProgress } from "../modules/rewards/rewardsProgress";
import { api } from "../services/api/client";
import { LIVE_REFRESH_INTERVAL_MS } from "../services/liveRefresh";
import styles from "./JourneyTrackers.module.css";

export function SeasonalPage() {
  const { session, selectedCharacterId, autoRefresh, preferences, setPreference } = useGuardian();
  const tracked = useMemo(() => parseTracked(preferences["journey.tracked"]), [preferences]);
  const enabled = Boolean(session?.authenticated && selectedCharacterId);
  const rewards = useQuery({
    queryKey: ["rewards", selectedCharacterId],
    queryFn: () => api<RewardsPassData>(`/api/v1/me/rewards?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled,
    refetchInterval: autoRefresh ? 60_000 : false,
    refetchIntervalInBackground: false
  });
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
  const data = rewards.data?.data;
  const level = rewardLevelProgress(data?.progress);
  const claimable = data?.rewards.filter((reward) => reward.state === "available").length || 0;
  const seasonalPursuits = (quests.data?.data.quests || []).filter((quest) => /season|episode|artifact/i.test(`${quest.itemType || ""} ${quest.name} ${quest.description}`));
  const challenges = journey.data?.data.seasonalChallenges || [];
  const toggle = (id: string) => { const next = new Set(tracked); if (next.has(id)) next.delete(id); else next.add(id); setPreference("journey.tracked", JSON.stringify([...next])); };

  return <AuthGate>
    <PageHeader eyebrow="Journey · Current progression" title="Seasonal Hub" description="Current Rewards Pass and seasonal pursuits returned by Bungie." actions={<Freshness observedAt={rewards.data?.freshness.observedAt || quests.data?.freshness.observedAt} warning={rewards.data?.warnings[0] || quests.data?.warnings[0]} />} />
    <JourneyNav />
    <QueryState loading={rewards.isLoading || quests.isLoading || journey.isLoading} error={(rewards.error || quests.error || journey.error) as Error} hasData={Boolean(rewards.data || quests.data || journey.data)} onRetry={() => { void rewards.refetch(); void quests.refetch(); void journey.refetch(); }} />
    {(rewards.data || quests.data) && <>
      <section className={styles.seasonHero} style={data?.backgroundImage ? { "--season-image": `url(${data.backgroundImage})` } as React.CSSProperties : undefined}>
        <div><Sparkles /><span><small>Current Rewards Pass</small><h2>{data?.name || "Seasonal progression"}</h2></span></div>
        <strong>{data?.rank ?? "—"}<small>Rank</small></strong>
        <div className={styles.seasonProgress}><span><small>Progress to next rank</small><b>{level ? `${level.percent}%` : "Unavailable"}</b></span><i><span style={{ width: `${level?.percent || 0}%` }} /></i><p>{level ? `${level.current.toLocaleString()} / ${level.required.toLocaleString()} XP` : data?.progress.reason || "Bungie did not return a usable XP threshold."}</p></div>
      </section>
      <section className={styles.featureGrid}>
        <Link to="/rewards"><Gauge /><span><small>Full progression</small><strong>Rewards Pass</strong><p>{claimable ? `${claimable} reward${claimable === 1 ? "" : "s"} ready to claim` : "View rank rewards and XP progress"}</p></span><ExternalLink /></Link>
        <article><Gift /><span><small>Seasonal pursuits</small><strong>{seasonalPursuits.length} active</strong><p>{seasonalPursuits.length ? seasonalPursuits.slice(0, 2).map((quest) => quest.name).join(" · ") : "No seasonal-category pursuits were returned."}</p></span></article>
        <article><Sparkles /><span><small>Artifact</small><strong>{journey.data?.data.artifact ? `${journey.data.data.artifact.pointsAcquired} unlock points · +${journey.data.data.artifact.powerBonus} Power` : "Unavailable"}</strong><p>{challenges.length} seasonal challenges currently returned</p></span></article>
      </section>
      {challenges.length > 0 && <section className={styles.rows}>{challenges.map((challenge) => <article key={challenge.recordHash} className={styles.row}><span className={styles.rowIcon}>{challenge.icon ? <img src={challenge.icon} alt="" /> : <Sparkles />}</span><div><small>{challenge.category}</small><h2>{challenge.name}</h2><p>{challenge.description}</p><i><span style={{ width: `${challenge.percent}%` }} /></i></div><aside><strong>{challenge.percent}%</strong><button onClick={() => toggle(challenge.recordHash)} disabled={challenge.complete} aria-label={`${tracked.has(challenge.recordHash) ? "Untrack" : "Track"} ${challenge.name}`}><Bookmark fill={tracked.has(challenge.recordHash) ? "currentColor" : "none"} /></button></aside></article>)}</section>}
    </>}
  </AuthGate>;
}

function parseTracked(value?: string): Set<string> {
  try { const parsed = JSON.parse(value || "[]"); return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []); }
  catch { return new Set(); }
}
