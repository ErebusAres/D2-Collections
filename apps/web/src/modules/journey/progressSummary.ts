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
