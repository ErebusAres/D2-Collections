import type { GuardianRankCategory, GuardianRankData, GuardianRankManifest, GuardianRankQuest, GuardianRankQuestObjective, GuardianRankTierState } from "@guardian-nexus/contracts";
import { imageUrl } from "@guardian-nexus/domain";

export function normalizeGuardianRanks(profile: any, manifest: GuardianRankManifest, characterId: string): GuardianRankData {
  const profileData = profile?.profile?.data || {};
  const currentRank = nonNegative(profileData.renewedGuardianRank)
    || nonNegative(profileData.currentGuardianRank)
    || nonNegative(profileData.lifetimeHighestGuardianRank);
  const highestAchievedRank = nonNegative(profileData.currentGuardianRank) || currentRank;
  const renewedRank = nonNegative(profileData.renewedGuardianRank) || currentRank;
  const lifetimeHighestRank = nonNegative(profileData.lifetimeHighestGuardianRank) || highestAchievedRank;
  const tracked = new Set([
    String(profile?.profileRecords?.data?.trackedRecordHash || ""),
    String(profile?.characterRecords?.data?.[characterId]?.trackedRecordHash || "")
  ].filter(Boolean));

  const ranks = manifest.ranks.map((rank) => {
    const rankNode = manifest.nodes[rank.presentationNodeHash];
    const categoryHashes = rankNode?.childNodeHashes?.length ? rankNode.childNodeHashes : rankNode ? [rankNode.hash] : [];
    const categories = categoryHashes.map((nodeHash) => categoryFor(nodeHash, profile, manifest, characterId, tracked)).filter((category) => category.total > 0);
    const total = categories.reduce((sum, category) => sum + category.total, 0);
    const completed = categories.reduce((sum, category) => sum + category.completed, 0);
    return {
      rankHash: rank.hash,
      rankNumber: rank.rankNumber,
      name: rank.name,
      description: rank.description,
      icon: imageUrl(rank.icon),
      foregroundImage: imageUrl(rank.foregroundImage),
      overlayImage: imageUrl(rank.overlayImage),
      state: tierState(rank.rankNumber, currentRank),
      completed,
      total,
      categories
    };
  });
  const lastDefinedRank = manifest.ranks.reduce((highest, rank) => rank.rankNumber > highest.rankNumber ? rank : highest, manifest.ranks[0] || {
    hash: "",
    rankNumber: 0,
    name: "",
    description: "",
    icon: "",
    foregroundImage: "",
    overlayImage: "",
    presentationNodeHash: ""
  });
  const maximumRank = lastDefinedRank.rankNumber
    ? Math.max(nonNegative(manifest.maximumRank), lastDefinedRank.rankNumber + 1)
    : nonNegative(manifest.maximumRank);
  const currentTier = ranks.find((rank) => rank.rankNumber === currentRank);
  const suggestedRank = currentTier?.rankNumber
    ?? ranks.find((rank) => rank.rankNumber === currentRank + 1)?.rankNumber
    ?? [...ranks].reverse().find((rank) => rank.rankNumber <= currentRank)?.rankNumber
    ?? ranks[0]?.rankNumber
    ?? currentRank;

  return {
    currentRank,
    renewedRank,
    highestAchievedRank,
    lifetimeHighestRank,
    maximumRank,
    suggestedRank,
    ranks,
    sources: {
      ranks: "DestinyProfileComponent and DestinyGuardianRankDefinition",
      objectives: "DestinyPresentationNodeDefinition, DestinyRecordDefinition, and profile records (component 900)"
    }
  };
}

function categoryFor(nodeHash: string, profile: any, manifest: GuardianRankManifest, characterId: string, tracked: Set<string>): GuardianRankCategory {
  const node = manifest.nodes[nodeHash];
  const recordHashes = recordHashesBelow(nodeHash, manifest);
  const quests = recordHashes.flatMap((recordHash) => {
    const record = manifest.records[recordHash];
    return record ? [questFor(recordHash, profile, manifest, characterId, tracked)] : [];
  });
  return {
    nodeHash,
    name: node?.name || "Rank objectives",
    description: node?.description || "",
    icon: imageUrl(node?.icon || ""),
    seasonal: Boolean(node?.seasonal),
    completed: quests.filter((quest) => quest.state === "completed").length,
    total: quests.length,
    quests
  };
}

function recordHashesBelow(nodeHash: string, manifest: GuardianRankManifest): string[] {
  const output: string[] = [];
  const seenNodes = new Set<string>();
  const seenRecords = new Set<string>();
  const pending = [nodeHash];
  while (pending.length) {
    const current = pending.shift()!;
    if (seenNodes.has(current)) continue;
    seenNodes.add(current);
    const node = manifest.nodes[current];
    if (!node) continue;
    pending.push(...node.childNodeHashes);
    for (const recordHash of node.recordHashes) {
      if (seenRecords.has(recordHash)) continue;
      seenRecords.add(recordHash);
      output.push(recordHash);
    }
  }
  return output;
}

function questFor(recordHash: string, profile: any, manifest: GuardianRankManifest, characterId: string, tracked: Set<string>): GuardianRankQuest {
  const definition = manifest.records[recordHash]!;
  const live = liveRecord(profile, recordHash, characterId, definition.scope);
  const stateFlags = live ? nonNegative(live.state) : undefined;
  const liveObjectives = new Map((live?.objectives || []).map((objective: any) => [String(objective?.objectiveHash || ""), objective]));
  const recordComplete = Boolean((stateFlags || 0) & 1) || (liveObjectives.size > 0 && [...liveObjectives.values()].every((objective: any) => Boolean(objective?.complete)));
  const objectives = definition.objectiveHashes.flatMap((objectiveHash) => {
    const objectiveDefinition = manifest.objectives[objectiveHash];
    if (!objectiveDefinition) return [];
    return [objectiveFor(objectiveHash, objectiveDefinition, liveObjectives.get(objectiveHash), recordComplete)];
  });
  const completed = recordComplete || (objectives.length > 0 && objectives.every((objective) => objective.complete));
  const progressed = objectives.some((objective) => objective.progressAvailable && objective.progress > 0);
  return {
    recordHash,
    name: definition.name || objectives[0]?.name || "Guardian Rank objective",
    description: definition.description,
    icon: imageUrl(definition.icon),
    state: completed ? "completed" : progressed ? "in-progress" : live ? "not-started" : "unavailable",
    ...(stateFlags !== undefined ? { stateFlags } : {}),
    trackedInDestiny: tracked.has(recordHash),
    objectives
  };
}

function objectiveFor(objectiveHash: string, definition: GuardianRankManifest["objectives"][string], live: any, recordComplete: boolean): GuardianRankQuestObjective {
  const completionValue = Math.max(0, nonNegative(live?.completionValue ?? definition.completionValue));
  const complete = recordComplete || Boolean(live?.complete);
  const rawProgress = nonNegative(live?.progress);
  const progress = complete && completionValue > 0 ? Math.max(rawProgress, completionValue) : rawProgress;
  const progressAvailable = Boolean(live) || complete;
  const percent = completionValue > 0 ? Math.min(100, Math.floor((progress / completionValue) * 100)) : complete ? 100 : 0;
  return {
    objectiveHash,
    name: definition.name || "Objective progress",
    progress,
    completionValue,
    percent,
    complete,
    progressAvailable
  };
}

function liveRecord(profile: any, recordHash: string, characterId: string, scope: number): any | undefined {
  const profileRow = profile?.profileRecords?.data?.records?.[recordHash];
  const characterRow = profile?.characterRecords?.data?.[characterId]?.records?.[recordHash];
  return scope === 1 ? characterRow || profileRow : profileRow || characterRow;
}

function tierState(rank: number, currentRank: number): GuardianRankTierState {
  if (rank < currentRank) return "previous";
  if (rank === currentRank) return "current";
  if (rank === currentRank + 1) return "next";
  return "future";
}

function nonNegative(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}
