import type { GuardianRankData, QuestProgress, RewardsPassData } from "@guardian-nexus/contracts";
import { rewardLevelProgress } from "../rewards/rewardsProgress";

export function questKind(quest: QuestProgress): "campaign" | "exotic" | "featured" | "other" {
  const searchable = `${quest.itemType || ""} ${quest.name} ${quest.activityName || ""}`.toLowerCase();
  if (quest.isExoticUnlock || /exotic/.test(searchable)) return "exotic";
  if (/campaign|story|mission/.test(searchable)) return "campaign";
  if (quest.inGameTracked || quest.sitePinned || quest.activityName) return "featured";
  return "other";
}

export function bountyCadence(quest: QuestProgress): "daily" | "weekly" | "seasonal" | "other" {
  const searchable = `${quest.itemType || ""} ${quest.name} ${quest.description}`.toLowerCase();
  if (/weekly/.test(searchable)) return "weekly";
  if (/season|episode/.test(searchable)) return "seasonal";
  if (/daily/.test(searchable) || quest.expiresAt) return "daily";
  return "other";
}

export function bountyVendor(quest: QuestProgress): string {
  if (quest.activityName) return quest.activityName;
  const type = String(quest.itemType || "").replace(/\b(daily|weekly|seasonal|repeatable|bounty)\b/gi, "").trim();
  return type || "Other";
}

export function isSeasonalPursuit(quest: QuestProgress): boolean {
  if (quest.category === "order") return true;
  const searchable = `${quest.itemType || ""} ${quest.name} ${quest.description} ${quest.activityName || ""}`.toLowerCase();
  return /season|episode|artifact|hub order|portal/.test(searchable);
}

export function pursuitProgressLabel(quest: QuestProgress): string {
  const objective = quest.objectives.find((entry) => !entry.complete) || quest.objectives[0];
  if (!objective) return quest.percent > 0 ? `${quest.percent}%` : "No counter";
  if (objective.completionValue > 0) return `${objective.progress.toLocaleString()} / ${objective.completionValue.toLocaleString()}`;
  return objective.complete ? "Complete" : `${objective.percent}%`;
}

export function pursuitExpiryLabel(expiresAt?: string, now = Date.now()): string | undefined {
  if (!expiresAt) return undefined;
  const expires = new Date(expiresAt).getTime();
  if (!Number.isFinite(expires)) return undefined;
  const remaining = expires - now;
  if (remaining <= 0) return "Expired";
  const hours = Math.floor(remaining / 3_600_000);
  if (hours >= 24) return `${Math.ceil(hours / 24)}d left`;
  if (hours >= 1) return `${hours}h left`;
  return `${Math.max(1, Math.ceil(remaining / 60_000))}m left`;
}

export function questPercent(quests: QuestProgress[]): number {
  return quests.length ? Math.round(quests.reduce((total, quest) => total + Math.max(0, Math.min(100, quest.percent)), 0) / quests.length) : 0;
}

export function guardianRankPercent(data?: GuardianRankData): number {
  const rank = data?.ranks.find((entry) => entry.rankNumber === data.currentRank);
  return rank?.total ? Math.round((rank.completed / rank.total) * 100) : data && data.currentRank >= data.maximumRank ? 100 : 0;
}

export function rewardsPercent(data?: RewardsPassData): number {
  return rewardLevelProgress(data?.progress)?.percent ?? 0;
}
