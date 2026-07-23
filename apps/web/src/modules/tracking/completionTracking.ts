import type { GuardianRankData, GuardianRankQuest, QuestProgress } from "@guardian-nexus/contracts";

export interface TrackedCompletionCandidate {
  id: string;
  name: string;
  kind: "quest" | "bounty" | "order" | "guardian-rank";
  complete: boolean;
  trackedInGuardianNexus: boolean;
}

export interface CompletionTransition {
  state: Map<string, boolean>;
  newlyCompleted: TrackedCompletionCandidate[];
}

export function questCompletionCandidates(quests: QuestProgress[], sitePinned: ReadonlySet<string>): TrackedCompletionCandidate[] {
  return quests
    .filter((quest) => quest.inGameTracked || sitePinned.has(quest.instanceId))
    .map((quest) => ({
      id: quest.instanceId,
      name: quest.name,
      kind: quest.category || "quest",
      complete: isQuestComplete(quest),
      trackedInGuardianNexus: sitePinned.has(quest.instanceId)
    }));
}

export function guardianRankCompletionCandidates(data: GuardianRankData, siteTracked: ReadonlySet<string>): TrackedCompletionCandidate[] {
  const candidates = new Map<string, TrackedCompletionCandidate>();
  for (const rank of data.ranks) {
    for (const category of rank.categories) {
      for (const quest of category.quests) {
        if (!quest.trackedInDestiny && !siteTracked.has(quest.recordHash)) continue;
        candidates.set(quest.recordHash, {
          id: quest.recordHash,
          name: quest.name,
          kind: "guardian-rank",
          complete: isGuardianRankQuestComplete(quest),
          trackedInGuardianNexus: siteTracked.has(quest.recordHash)
        });
      }
    }
  }
  return [...candidates.values()];
}

export function completionTransition(previous: ReadonlyMap<string, boolean> | null, candidates: TrackedCompletionCandidate[]): CompletionTransition {
  const state = new Map(candidates.map((candidate) => [candidate.id, candidate.complete]));
  const newlyCompleted = previous
    ? candidates.filter((candidate) => candidate.complete && previous.get(candidate.id) === false)
    : [];
  return { state, newlyCompleted };
}

export function isQuestComplete(quest: QuestProgress): boolean {
  return quest.percent >= 100 || allObjectivesComplete(quest.objectives);
}

export function isGuardianRankQuestComplete(quest: GuardianRankQuest): boolean {
  return quest.state === "completed" || allObjectivesComplete(quest.objectives);
}

function allObjectivesComplete(objectives: Array<{ complete: boolean; percent: number }>): boolean {
  return objectives.length > 0 && objectives.every((objective) => objective.complete || objective.percent >= 100);
}
