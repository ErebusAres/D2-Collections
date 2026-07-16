import type { RewardsPassData, RewardsPassReward } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CircleHelp, ExternalLink, Gauge, Gift, ShieldCheck, Sparkles, Ticket } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api/client";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { rewardLevelProgress } from "../modules/rewards/rewardsProgress";
import { useGuardian } from "../context/GuardianContext";
import { RewardLevelColumn, type RewardLevel } from "../components/rewards/RewardLevelColumn";
import styles from "./RewardsPage.module.css";

const OFFICIAL_REWARDS_URL = "https://www.bungie.net/7/en/Seasons/Progress";
const LEVELS_PER_PAGE = 10;

export function RewardsPage() {
  const { session, selectedCharacterId, autoRefresh } = useGuardian();
  const result = useQuery({
    queryKey: ["rewards", selectedCharacterId],
    queryFn: () => api<RewardsPassData>(`/api/v1/me/rewards?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled: Boolean(session?.authenticated && selectedCharacterId),
    refetchInterval: autoRefresh ? 60_000 : false,
    refetchIntervalInBackground: false
  });
  const data = result.data?.data;
  const progress = data?.progress;
  const levelProgress = rewardLevelProgress(progress);
  const rewardLevels = useMemo(() => groupRewardsByLevel(data?.rewards || []), [data?.rewards]);
  const pageCount = Math.max(1, Math.ceil(rewardLevels.length / LEVELS_PER_PAGE));
  const claimableCount = data?.rewards.filter((reward) => reward.state === "available").length || 0;
  const claimedCount = data?.rewards.filter((reward) => reward.state === "claimed").length || 0;
  const lockedCount = data?.rewards.filter((reward) => reward.state === "locked").length || 0;
  const [rewardPage, setRewardPage] = useState(0);
  useEffect(() => {
    if (!data || !rewardLevels.length) return;
    const currentIndex = rewardLevels.findIndex((entry) => entry.level >= Math.max(1, data.rank));
    setRewardPage(Math.max(0, Math.floor((currentIndex < 0 ? rewardLevels.length - 1 : currentIndex) / LEVELS_PER_PAGE)));
  }, [data?.passHash, data?.rank, rewardLevels]);
  const visibleLevels = rewardLevels.slice(rewardPage * LEVELS_PER_PAGE, (rewardPage + 1) * LEVELS_PER_PAGE);

  return <AuthGate>
    <PageHeader eyebrow="Account-wide progression" title="Rewards Pass" description="Live rank, XP, reward definitions, and per-character reward state from Bungie's profile and manifest data." actions={<Freshness observedAt={result.data?.freshness.observedAt} warning={result.data?.warnings[0]} />} />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(data)} onRetry={() => void result.refetch()} />
    {data && <>
      <section className={styles.rewardsHero} style={data.backgroundImage ? { "--rewards-background": `url(${data.backgroundImage})` } as React.CSSProperties : undefined}>
        <div className={styles.rewardsRank}><Ticket /><span>Current rank</span><strong>{progress?.state === "unavailable" && !data.rank ? "—" : data.rank}</strong></div>
        <div className={`${styles.rewardsProgress} ${levelProgress ? "" : styles.rewardsProgressUnavailable}`}><header><div><span>{levelProgress ? "Next rank" : "XP status"}</span><strong>{levelProgress ? data.rank + 1 : "Unavailable"}</strong></div><b>{levelProgress ? <><strong>{levelProgress.percent}%</strong><small>of level</small></> : "—"}</b></header><i><span style={{ width: `${levelProgress?.percent || 0}%` }} /></i><p>{levelProgress ? `${levelProgress.current.toLocaleString()} / ${levelProgress.required.toLocaleString()} XP this level${progress?.currentProgress !== undefined ? ` · ${progress.currentProgress.toLocaleString()} total progression` : ""}` : progress?.reason || "Bungie did not return a usable XP threshold."}</p></div>
        <a href={OFFICIAL_REWARDS_URL} target="_blank" rel="noreferrer"><ExternalLink /><span>Open official tracker</span><strong>View and claim rewards</strong></a>
      </section>
      <section className={styles.rewardCatalog}>
        <header><div>{data.icon ? <img src={data.icon} alt="" /> : <Sparkles />}<span><small>Current pass · Manifest {data.manifestVersion}</small><strong>{data.name}</strong></span></div><p>{data.rewards.length} live rewards across {rewardLevels.length} ranks</p></header>
        {data.rewardDataState === "available" ? <>
          <div className={styles.rewardPager}>
            <button type="button" onClick={() => setRewardPage((page) => Math.max(0, page - 1))} disabled={rewardPage === 0} aria-label="Previous reward ranks"><ChevronLeft /></button>
            <div><span>Reward ranks</span><strong>{visibleLevels[0]?.level || "—"}–{visibleLevels.at(-1)?.level || "—"}</strong></div>
            <button type="button" onClick={() => setRewardPage((page) => Math.min(pageCount - 1, page + 1))} disabled={rewardPage >= pageCount - 1} aria-label="Next reward ranks"><ChevronRight /></button>
          </div>
          <div className={styles.rewardTrackWindow}><div className={styles.rewardLevelGrid}>{visibleLevels.map((entry) => <RewardLevelColumn key={entry.level} entry={entry} currentRank={data.rank} />)}</div></div>
          <nav className={styles.rewardPages} aria-label="Reward rank pages">{Array.from({ length: pageCount }, (_, index) => <button key={index} type="button" className={index === rewardPage ? styles.rewardPageActive : ""} onClick={() => setRewardPage(index)} aria-current={index === rewardPage ? "page" : undefined} aria-label={`Show reward ranks ${index * LEVELS_PER_PAGE + 1} through ${Math.min((index + 1) * LEVELS_PER_PAGE, rewardLevels.at(-1)?.level || (index + 1) * LEVELS_PER_PAGE)}`}>{index + 1}</button>)}</nav>
        </> : <div className={styles.rewardCatalogUnavailable}><CircleHelp /><strong>Reward catalog unavailable</strong><p>{data.rewardDataReason || "Bungie did not provide reward definitions for the current pass."}</p></div>}
      </section>
      <section className={styles.rewardInsights} aria-label="Rewards Pass status">
        <article><Gauge /><div><span>Live progression</span><strong>{levelProgress ? `Rank ${data.rank} · ${levelProgress.percent}% complete` : `Rank ${data.rank}`}</strong><p>{levelProgress ? `${levelProgress.required - levelProgress.current} XP until rank ${data.rank + 1}` : progress?.reason || "Next-rank XP is unavailable from Bungie."}</p></div></article>
        <article><Gift /><div><span>Reward status</span><strong>{claimableCount ? `${claimableCount} ready to claim` : "No unclaimed rewards detected"}</strong><p>{claimedCount} claimed · {lockedCount} locked · updated from your live profile</p></div></article>
        <a href={OFFICIAL_REWARDS_URL} target="_blank" rel="noreferrer"><ShieldCheck /><div><span>Secure claiming</span><strong>{claimableCount ? "Continue to Bungie.net" : "Open the official tracker"}</strong><p>Bungie's public API reports eligibility but does not provide a third-party claim action.</p></div><ExternalLink /></a>
      </section>
    </>}
  </AuthGate>;
}

function groupRewardsByLevel(rewards: RewardsPassReward[]): RewardLevel[] {
  const levels = new Map<number, RewardsPassReward[]>();
  for (const reward of rewards) {
    const level = Math.max(0, reward.requiredLevel);
    levels.set(level, [...(levels.get(level) || []), reward]);
  }
  return [...levels.entries()]
    .sort(([left], [right]) => left - right)
    .map(([level, levelRewards]) => ({ level, rewards: levelRewards.sort((left, right) => left.track.localeCompare(right.track) || left.rewardItemIndex - right.rewardItemIndex) }));
}
