import type { RewardsPassProgress } from "@guardian-nexus/contracts";

export interface RewardLevelProgress {
  current: number;
  required: number;
  percent: number;
}

export function rewardLevelProgress(progress?: RewardsPassProgress): RewardLevelProgress | null {
  const current = Number(progress?.progressToNextLevel);
  const required = Number(progress?.nextLevelAt);
  if (!Number.isFinite(current) || !Number.isFinite(required) || required <= 0) return null;
  const calculated = Math.round((Math.max(0, current) / required) * 100);
  const supplied = Number(progress?.percent);
  return {
    current: Math.max(0, current),
    required,
    percent: Math.max(0, Math.min(100, Number.isFinite(supplied) ? Math.round(supplied) : calculated))
  };
}
