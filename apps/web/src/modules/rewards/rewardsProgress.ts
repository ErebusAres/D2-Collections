import type { RewardsPassProgress, RewardsPassReward } from "@guardian-nexus/contracts";

export interface RewardLevelProgress {
  mode: "reward-rank" | "bright-engram";
  current: number;
  required: number;
  percent: number;
  levelCurrent: number;
  levelRequired: number;
  segments?: number[];
  completedSegments?: number;
  totalSegments?: number;
}

export function rewardLevelProgress(progress?: RewardsPassProgress): RewardLevelProgress | null {
  const current = Number(progress?.progressToNextLevel);
  const required = Number(progress?.nextLevelAt);
  if (!Number.isFinite(current) || !Number.isFinite(required) || required <= 0) return null;
  const safeCurrent = Math.max(0, current);
  const levelPercent = Math.max(0, Math.min(100, safeCurrent >= required ? 100 : Math.floor((safeCurrent / required) * 100)));
  if (progress?.progressionMode === "bright-engram") {
    const cycleSize = Math.max(1, Math.round(Number(progress.segmentsPerRank || progress.levelsPerBrightEngram) || 5));
    const scaledProgress = Math.min(cycleSize, (safeCurrent / required) * cycleSize);
    return {
      mode: "bright-engram",
      current: safeCurrent,
      required,
      percent: levelPercent,
      levelCurrent: safeCurrent,
      levelRequired: required,
      segments: Array.from({ length: cycleSize }, (_, index) => Math.max(0, Math.min(100, Math.floor((scaledProgress - index) * 100)))),
      completedSegments: Math.max(0, Math.min(cycleSize, Math.floor(scaledProgress))),
      totalSegments: cycleSize
    };
  }
  return {
    mode: "reward-rank",
    current: safeCurrent,
    required,
    percent: levelPercent,
    levelCurrent: safeCurrent,
    levelRequired: required
  };
}

export function hasClaimableReward(rewards: RewardsPassReward[] | undefined): boolean {
  return rewards?.some((reward) => reward.state === "available") || false;
}
