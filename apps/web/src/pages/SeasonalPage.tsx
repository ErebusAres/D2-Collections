import type { QuestData, RewardsPassData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Gift, Gauge, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { JourneyNav } from "../components/journey/JourneyNav";
import { useGuardian } from "../context/GuardianContext";
import { rewardLevelProgress } from "../modules/rewards/rewardsProgress";
import { api } from "../services/api/client";
import { LIVE_REFRESH_INTERVAL_MS } from "../services/liveRefresh";
import styles from "./JourneyTrackers.module.css";

export function SeasonalPage() {
  const { session, selectedCharacterId, autoRefresh } = useGuardian();
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
  const data = rewards.data?.data;
  const level = rewardLevelProgress(data?.progress);
  const claimable = data?.rewards.filter((reward) => reward.state === "available").length || 0;
  const seasonalPursuits = (quests.data?.data.quests || []).filter((quest) => /season|episode|artifact/i.test(`${quest.itemType || ""} ${quest.name} ${quest.description}`));

  return <AuthGate>
    <PageHeader eyebrow="Journey · Current progression" title="Seasonal Hub" description="Current Rewards Pass and seasonal pursuits returned by Bungie." actions={<Freshness observedAt={rewards.data?.freshness.observedAt || quests.data?.freshness.observedAt} warning={rewards.data?.warnings[0] || quests.data?.warnings[0]} />} />
    <JourneyNav />
    <QueryState loading={rewards.isLoading || quests.isLoading} error={(rewards.error || quests.error) as Error} hasData={Boolean(rewards.data || quests.data)} onRetry={() => { void rewards.refetch(); void quests.refetch(); }} />
    {(rewards.data || quests.data) && <>
      <section className={styles.seasonHero} style={data?.backgroundImage ? { "--season-image": `url(${data.backgroundImage})` } as React.CSSProperties : undefined}>
        <div><Sparkles /><span><small>Current Rewards Pass</small><h2>{data?.name || "Seasonal progression"}</h2></span></div>
        <strong>{data?.rank ?? "—"}<small>Rank</small></strong>
        <div className={styles.seasonProgress}><span><small>Progress to next rank</small><b>{level ? `${level.percent}%` : "Unavailable"}</b></span><i><span style={{ width: `${level?.percent || 0}%` }} /></i><p>{level ? `${level.current.toLocaleString()} / ${level.required.toLocaleString()} XP` : data?.progress.reason || "Bungie did not return a usable XP threshold."}</p></div>
      </section>
      <section className={styles.featureGrid}>
        <Link to="/rewards"><Gauge /><span><small>Full progression</small><strong>Rewards Pass</strong><p>{claimable ? `${claimable} reward${claimable === 1 ? "" : "s"} ready to claim` : "View rank rewards and XP progress"}</p></span><ExternalLink /></Link>
        <article><Gift /><span><small>Seasonal pursuits</small><strong>{seasonalPursuits.length} active</strong><p>{seasonalPursuits.length ? seasonalPursuits.slice(0, 2).map((quest) => quest.name).join(" · ") : "No seasonal-category pursuits were returned."}</p></span></article>
        <article><Sparkles /><span><small>Artifact and challenges</small><strong>Awaiting live normalization</strong><p>Guardian Nexus does not yet expose trustworthy artifact or seasonal-challenge objectives.</p></span></article>
      </section>
    </>}
  </AuthGate>;
}
