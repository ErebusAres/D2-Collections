import type { RewardsPassReward, RewardsPassRewardState } from "@guardian-nexus/contracts";
import { CheckCircle2, CircleHelp, ExternalLink, LockKeyhole, Sparkles } from "lucide-react";
import styles from "../../pages/RewardsPage.module.css";

const OFFICIAL_REWARDS_URL = "https://www.bungie.net/7/en/Seasons/Progress";

export interface RewardLevel {
  level: number;
  rewards: RewardsPassReward[];
}

export function RewardLevelColumn({ entry, currentRank }: { entry: RewardLevel; currentRank: number }) {
  const reached = entry.level <= currentRank;
  const current = entry.level === currentRank;
  return <article className={`${styles.rewardLevel} ${reached ? styles.rewardLevelReached : ""} ${current ? styles.rewardLevelCurrent : ""}`} aria-current={current ? "step" : undefined}>
    <header><span>Rank</span><strong>{entry.level}</strong>{reached && <CheckCircle2 />}</header>
    <div>{entry.rewards.map((reward) => <RewardCard key={`${reward.rewardItemIndex}-${reward.itemHash}`} reward={reward} />)}</div>
  </article>;
}

function RewardCard({ reward }: { reward: RewardsPassReward }) {
  return <article className={`${styles.rewardCard} ${rewardStateClass(reward.state)}`}>
    <header><span>{reward.track}</span></header>
    <div className={styles.rewardItemArt}>{reward.icon ? <img src={reward.icon} alt="" loading="lazy" /> : <span>Image unavailable</span>}{reward.quantity > 1 && <b>×{reward.quantity.toLocaleString()}</b>}</div>
    <main><strong title={reward.name}>{reward.name}</strong><small>{reward.acquisition === "claim-required" ? "Manual claim" : reward.acquisition === "instant" ? "Granted automatically" : "Acquisition unavailable"}</small></main>
    <footer>{rewardStateIcon(reward.state)}<span>{rewardStateLabel(reward.state)}</span></footer>
    {reward.state === "available" && <a href={OFFICIAL_REWARDS_URL} target="_blank" rel="noreferrer">Claim on Bungie <ExternalLink /></a>}
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
