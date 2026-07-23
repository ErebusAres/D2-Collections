import type { FireteamTrackedItem, GuardianRankData, GuardianRankTier, QuestProgress } from "@guardian-nexus/contracts";

export function trackedItemsFromQuests(quests: QuestProgress[]): FireteamTrackedItem[] {
  return quests.filter((quest) => (quest.inGameTracked || quest.sitePinned) && !questComplete(quest)).map((quest) => ({
    id: quest.instanceId,
    definitionHash: quest.itemHash,
    kind: quest.category || "quest",
    name: quest.name,
    description: quest.currentStep || quest.description,
    icon: quest.icon,
    context: quest.activityName ? `${kindLabel(quest.category || "quest")} · ${quest.activityName}` : kindLabel(quest.category || "quest"),
    trackedInDestiny: quest.inGameTracked,
    trackedInGuardianNexus: quest.sitePinned,
    objectives: quest.objectives.map((objective) => ({ ...objective, progressAvailable: true })),
    percent: boundedPercent(quest.percent),
    updatedAt: quest.updatedAt
  }));
}

export function trackedItemsFromGuardianRanks(data: GuardianRankData, siteTracked: ReadonlySet<string>, updatedAt: string): FireteamTrackedItem[] {
  const chosen = new Map<string, { item: FireteamTrackedItem; priority: number }>();
  for (const rank of data.ranks) {
    for (const category of rank.categories) {
      for (const quest of category.quests) {
        const trackedInGuardianNexus = siteTracked.has(quest.recordHash);
        if (!quest.trackedInDestiny && !trackedInGuardianNexus) continue;
        if (guardianRankQuestComplete(quest)) continue;
        const candidate = {
          item: {
            id: quest.recordHash,
            definitionHash: quest.recordHash,
            kind: "guardian-rank" as const,
            name: quest.name,
            description: quest.description,
            icon: quest.icon,
            context: `Guardian Rank · ${category.name} · ${rankContext(rank, data.maximumRank)}`,
            trackedInDestiny: quest.trackedInDestiny,
            trackedInGuardianNexus,
            objectives: quest.objectives,
            percent: guardianRankPercent(quest),
            updatedAt
          },
          priority: rankPriority(rank)
        };
        const existing = chosen.get(quest.recordHash);
        if (!existing || candidate.priority < existing.priority) chosen.set(quest.recordHash, candidate);
      }
    }
  }
  return [...chosen.values()].map((entry) => entry.item);
}

export function mergeTrackedItems(...groups: FireteamTrackedItem[][]): FireteamTrackedItem[] {
  const items = new Map<string, FireteamTrackedItem>();
  for (const item of groups.flat()) items.set(`${item.kind}:${item.id}`, item);
  return [...items.values()];
}

function guardianRankPercent(quest: GuardianRankTier["categories"][number]["quests"][number]): number {
  if (quest.objectives.length) return boundedPercent(Math.round(quest.objectives.reduce((sum, objective) => sum + objective.percent, 0) / quest.objectives.length));
  return quest.state === "completed" ? 100 : 0;
}

function questComplete(quest: QuestProgress): boolean {
  return quest.percent >= 100 || (quest.objectives.length > 0 && quest.objectives.every((objective) => objective.complete || objective.percent >= 100));
}

function guardianRankQuestComplete(quest: GuardianRankTier["categories"][number]["quests"][number]): boolean {
  return quest.state === "completed" || (quest.objectives.length > 0 && quest.objectives.every((objective) => objective.complete || objective.percent >= 100));
}

function rankContext(rank: GuardianRankTier, maximumRank: number): string {
  return rank.rankNumber < maximumRank ? `Progress to rank ${rank.rankNumber + 1}` : `Rank ${rank.rankNumber}`;
}

function rankPriority(rank: GuardianRankTier): number {
  if (rank.state === "current") return 0;
  if (rank.state === "next") return 1;
  if (rank.state === "previous") return 2;
  return 3;
}

function kindLabel(kind: QuestProgress["category"]): string {
  if (kind === "bounty") return "Bounty";
  if (kind === "order") return "Order";
  return "Quest";
}

function boundedPercent(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
}
