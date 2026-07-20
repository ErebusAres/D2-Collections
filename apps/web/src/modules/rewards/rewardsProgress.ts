import type { RewardsPassProgress, RewardsPassReward } from "@guardian-nexus/contracts";

export interface RewardLevelProgress {
  mode: "reward-rank" | "bright-engram";
  current: number;
  required: number;
  percent: number;
  levelCurrent: number;
  levelRequired: number;
  segments?: number[];
}

export function rewardLevelProgress(progress?: RewardsPassProgress): RewardLevelProgress | null {
  const current = Number(progress?.progressToNextLevel);
  const required = Number(progress?.nextLevelAt);
  if (!Number.isFinite(current) || !Number.isFinite(required) || required <= 0) return null;
  const calculated = Math.round((Math.max(0, current) / required) * 100);
  const supplied = Number(progress?.percent);
  const levelPercent = Math.max(0, Math.min(100, Number.isFinite(supplied) ? Math.round(supplied) : calculated));
  if (progress?.progressionMode === "bright-engram") {
    const cycleSize = Math.max(1, Math.round(Number(progress.levelsPerBrightEngram) || 5));
    const completedLevels = Math.max(0, Math.round(Number(progress.activeLevel) || 0)) % cycleSize;
    const cycleCurrent = completedLevels * required + Math.max(0, current);
    const cycleRequired = cycleSize * required;
    return {
      mode: "bright-engram",
      current: cycleCurrent,
      required: cycleRequired,
      percent: Math.max(0, Math.min(100, Math.round((cycleCurrent / cycleRequired) * 100))),
      levelCurrent: Math.max(0, current),
      levelRequired: required,
      segments: Array.from({ length: cycleSize }, (_, index) => index < completedLevels ? 100 : index === completedLevels ? levelPercent : 0)
    };
  }
  return {
    mode: "reward-rank",
    current: Math.max(0, current),
    required,
    percent: levelPercent,
    levelCurrent: Math.max(0, current),
    levelRequired: required
  };
}

export function hasClaimableReward(rewards: RewardsPassReward[] | undefined): boolean {
  return rewards?.some((reward) => reward.state === "available") || false;
}
