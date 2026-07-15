import type { RewardsPassData, RewardsPassReward, RewardsPassRewardState } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleHelp, ExternalLink, LockKeyhole, Sparkles, Ticket } from "lucide-react";
import { api } from "../api/client";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/Page";
import { useGuardian } from "../state/GuardianContext";
import pageStyles from "./Pages.module.css";
import styles from "./RewardsPage.module.css";

const OFFICIAL_REWARDS_URL = "https://www.bungie.net/7/en/Seasons/Progress";

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
  const xpAvailable = progress?.state === "available" && progress.nextLevelAt !== undefined && progress.progressToNextLevel !== undefined && progress.percent !== undefined;

  return <AuthGate>
    <PageHeader eyebrow="Account-wide progression" title="Rewards Pass" description="Live rank, XP, reward definitions, and per-character reward state from Bungie's profile and manifest data." actions={<Freshness observedAt={result.data?.freshness.observedAt} warning={result.data?.warnings[0]} />} />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(data)} onRetry={() => void result.refetch()} />
    {data && <>
      <section className={styles.rewardsHero} style={data.backgroundImage ? { "--rewards-background": `url(${data.backgroundImage})` } as React.CSSProperties : undefined}>
        <div className={styles.rewardsRank}><Ticket /><span>Current rank</span><strong>{progress?.state === "unavailable" && !data.rank ? "—" : data.rank}</strong></div>
        <div className={`${styles.rewardsProgress} ${xpAvailable ? "" : styles.rewardsProgressUnavailable}`}><header><div><span>{xpAvailable ? "Next rank" : "XP status"}</span><strong>{xpAvailable ? data.rank + 1 : "Unavailable"}</strong></div><b>{xpAvailable ? `${progress.percent}%` : "—"}</b></header><i><span style={{ width: `${xpAvailable ? progress.percent : 0}%` }} /></i><p>{xpAvailable ? `${progress.progressToNextLevel!.toLocaleString()} / ${progress.nextLevelAt!.toLocaleString()} XP · ${progress.currentProgress?.toLocaleString() || "0"} total progression` : progress?.reason || "Bungie did not return a usable XP threshold."}</p></div>
        <a href={OFFICIAL_REWARDS_URL} target="_blank" rel="noreferrer"><ExternalLink /><span>Open official tracker</span><strong>View and claim rewards</strong></a>
      </section>
      <section className={styles.rewardCatalog}>
        <header><div>{data.icon ? <img src={data.icon} alt="" /> : <Sparkles />}<span><small>Manifest {data.manifestVersion}</small><strong>{data.name}</strong></span></div><p>{data.rewards.length} visible reward entries</p></header>
        {data.rewardDataState === "available" ? <div className={styles.rewardGrid}>{data.rewards.map((reward) => <RewardCard key={`${reward.rewardItemIndex}-${reward.itemHash}`} reward={reward} />)}</div> : <div className={styles.rewardCatalogUnavailable}><CircleHelp /><strong>Reward catalog unavailable</strong><p>{data.rewardDataReason || "Bungie did not provide reward definitions for the current pass."}</p></div>}
      </section>
      <section className={styles.rewardSources}><div><span>Rank and XP</span><strong>{data.sources.rankAndXp}</strong></div><div><span>Reward catalog</span><strong>{data.sources.rewards}</strong></div><div><span>Claiming</span><strong>Not exposed to third-party apps</strong></div></section>
      <section className={pageStyles.transitoryNotice}><LockKeyhole /><div><strong>Claiming stays with Bungie</strong><p>Guardian Nexus displays Bungie's live reward state but does not submit claims because the public third-party API does not expose a Rewards Pass claim action.</p></div></section>
    </>}
  </AuthGate>;
}

function RewardCard({ reward }: { reward: RewardsPassReward }) {
  return <article className={`${styles.rewardCard} ${rewardStateClass(reward.state)}`}>
    <header><span>Rank {reward.requiredLevel || "—"}</span><b>{reward.track}</b></header>
    <div className={styles.rewardItemArt}>{reward.icon ? <img src={reward.icon} alt="" loading="lazy" /> : <span>Image unavailable</span>}</div>
    <main><strong>{reward.name}</strong>{reward.quantity > 1 && <b>×{reward.quantity.toLocaleString()}</b>}<small>{reward.acquisition === "claim-required" ? "Manual claim" : reward.acquisition === "instant" ? "Granted automatically" : "Acquisition unavailable"}</small></main>
    <footer>{rewardStateIcon(reward.state)}<span>{rewardStateLabel(reward.state)}</span></footer>
  </article>;
}

function rewardStateClass(state: RewardsPassRewardState): string {
  if (state === "claimed") return styles.rewardClaimed!;
  if (state === "available") return styles.rewardAvailable!;
  if (state === "earned") return styles.rewardEarned!;
  if (state === "locked") return styles.rewardLocked!;
  return styles.rewardUnavailable!;
}

function rewardStateIcon(state: RewardsPassRewardState) {
  if (state === "claimed") return <CheckCircle2 />;
  if (state === "available" || state === "earned") return <Sparkles />;
  if (state === "locked") return <LockKeyhole />;
  return <CircleHelp />;
}

function rewardStateLabel(state: RewardsPassRewardState): string {
  if (state === "claimed") return "Claimed";
  if (state === "available") return "Available to claim";
  if (state === "earned") return "Earned · claim restricted";
  if (state === "locked") return "Locked";
  return "State unavailable";
}
