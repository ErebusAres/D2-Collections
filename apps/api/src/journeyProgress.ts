import type { CompactManifest, FireteamTrackedItem, JourneyObjective, JourneyProgressData, JourneyProgressManifest, JourneyRecord, JourneyWeeklyChallenge } from "@guardian-nexus/contracts";
import { imageUrl } from "@guardian-nexus/domain";

export function normalizeJourneyProgress(profile: any, manifest: JourneyProgressManifest, activities: CompactManifest, characterId: string): JourneyProgressData {
  const profileRecords = profile?.profileRecords?.data || {};
  const accountRows = profileRecords.records || {};
  const characterRows = profile?.characterRecords?.data?.[characterId]?.records || {};
  const tracked = new Set([
    String(profileRecords.trackedRecordHash || ""),
    String(profile?.characterRecords?.data?.[characterId]?.trackedRecordHash || "")
  ].filter(Boolean));
  const records = Object.values(manifest.records).flatMap((definition) => {
    const live = definition.scope === 1 ? characterRows[definition.hash] || accountRows[definition.hash] : accountRows[definition.hash] || characterRows[definition.hash];
    if (live && (number(live.state) & 16)) return [];
    return [recordFor(definition, live, manifest, tracked)];
  });
  const titles = records.filter((record) => Boolean(record.title)).map((record) => ({
    recordHash: record.recordHash,
    name: record.name,
    title: record.title!,
    description: record.description,
    icon: record.icon,
    complete: record.complete,
    tracked: record.tracked,
    percent: record.percent,
    objectives: record.objectives
  })).sort(progressSort);
  const seasonalChallenges = records.filter((record) => /seasonal challenge/i.test(record.type)).sort(progressSort);
  const triumphs = records.filter((record) => !record.title && !/seasonal challenge/i.test(record.type)).sort(progressSort);
  const activityRows = profile?.characterActivities?.data?.[characterId]?.availableActivities || [];
  const weeklyRows: JourneyWeeklyChallenge[] = activityRows.flatMap((activity: any) => (activity?.challenges || []).map((challenge: any, index: number) => {
    const activityHash = String(activity?.activityHash || "");
    const definition = activities.activityDefinitions[activityHash] as any;
    const objectiveHash = String(challenge?.objectiveHash || "");
    const objectiveDefinition = activities.objectiveDefinitions[objectiveHash] as any;
    return {
      id: `${activityHash}:${objectiveHash || index}`,
      activityHash,
      name: String(definition?.displayProperties?.name || "Weekly activity"),
      description: String(definition?.displayProperties?.description || ""),
      icon: imageUrl(definition?.displayProperties?.icon || ""),
      objective: objectiveFor(objectiveHash, objectiveDefinition, challenge)
    };
  })).filter((challenge: JourneyWeeklyChallenge) => challenge.objective.completionValue > 0 || challenge.objective.progress > 0 || challenge.objective.complete);
  const weeklyChallenges = dedupeWeeklyChallenges(weeklyRows)
    .sort((left, right) => Number(left.objective.complete) - Number(right.objective.complete) || right.objective.percent - left.objective.percent || left.name.localeCompare(right.name));
  const currentActivities = activityRows.flatMap((activity: any) => {
    const activityHash = String(activity?.activityHash || "");
    const definition = activities.activityDefinitions[activityHash] as any;
    const name = String(definition?.displayProperties?.name || "").trim();
    const description = String(definition?.displayProperties?.description || "").trim();
    if (!name || !isCurrentIntelligenceActivity(`${name} ${description}`)) return [];
    return [{
      activityHash,
      name,
      description,
      icon: imageUrl(definition?.displayProperties?.icon || "")
    }];
  }).filter((activity: any, index: number, rows: any[]) =>
    rows.findIndex((candidate) => candidate.activityHash === activity.activityHash) === index);
  const progression = profile?.characterProgressions?.data?.[characterId];
  const artifactRow = progression?.seasonalArtifact;
  const pointProgression = artifactRow?.pointProgression || {};
  const powerProgression = artifactRow?.powerBonusProgression || {};
  const artifact = artifactRow ? {
    artifactHash: String(artifactRow.artifactHash || ""),
    pointsAcquired: number(artifactRow.pointsAcquired ?? pointProgression.level),
    pointsSpent: number(artifactRow.pointsUsed),
    powerBonus: number(powerProgression.level),
    powerProgress: number(powerProgression.progressToNextLevel),
    powerNextLevelAt: number(powerProgression.nextLevelAt)
  } : undefined;
  return {
    triumphScore: {
      active: number(profileRecords.score?.activeScore ?? profileRecords.activeScore),
      lifetime: number(profileRecords.score?.lifetimeScore ?? profileRecords.lifetimeScore),
      legacy: number(profileRecords.score?.legacyScore ?? profileRecords.legacyScore)
    },
    titles,
    triumphs,
    seasonalChallenges,
    weeklyChallenges,
    currentActivities,
    ...(artifact ? { artifact } : {}),
    manifestVersion: manifest.version
  };
}

function isCurrentIntelligenceActivity(value: string): boolean {
  return /iron banner|trials of osiris|\b(solo|fireteam|arena|pinnacle|vanguard|crucible|gambit) ops\b|nightfall|grandmaster|pantheon|vanguard alert/i.test(value);
}

function dedupeWeeklyChallenges(rows: JourneyWeeklyChallenge[]): JourneyWeeklyChallenge[] {
  const unique = new Map<string, JourneyWeeklyChallenge>();
  for (const row of rows) {
    const key = `${row.name.trim().toLocaleLowerCase()}:${row.objective.objectiveHash}`;
    const current = unique.get(key);
    if (!current || row.objective.percent > current.objective.percent) unique.set(key, row);
  }
  return [...unique.values()];
}

export function trackedItemsFromJourney(data: JourneyProgressData, trackedIds: Set<string>, updatedAt: string, includeCompleted = false, previouslyTracked = new Set<string>()): FireteamTrackedItem[] {
  const records = [
    ...data.titles.map((record) => ({ ...record, kind: "title" as const, context: "Title & Seal", description: record.description })),
    ...data.triumphs.map((record) => ({ ...record, kind: "triumph" as const, context: record.category })),
    ...data.seasonalChallenges.map((record) => ({ ...record, kind: "seasonal" as const, context: "Seasonal Challenge" }))
  ];
  const recordItems = records.filter((record) => (trackedIds.has(record.recordHash) || previouslyTracked.has(`${record.kind}:${record.recordHash}`)) && (includeCompleted || !record.complete)).map((record) => ({
    id: record.recordHash,
    definitionHash: record.recordHash,
    kind: record.kind,
    name: record.kind === "title" ? record.title : record.name,
    description: record.description,
    icon: record.icon,
    context: record.context,
    trackedInDestiny: record.tracked,
    trackedInGuardianNexus: trackedIds.has(record.recordHash),
    objectives: record.objectives.map((objective) => ({ ...objective, progressAvailable: true })),
    percent: record.percent,
    updatedAt
  }));
  const weeklyItems = data.weeklyChallenges.filter((challenge) => (trackedIds.has(challenge.id) || previouslyTracked.has(`weekly:${challenge.id}`)) && (includeCompleted || !challenge.objective.complete)).map((challenge) => ({
    id: challenge.id,
    definitionHash: challenge.objective.objectiveHash,
    kind: "weekly" as const,
    name: challenge.name,
    description: challenge.description,
    icon: challenge.icon,
    context: "Weekly Challenge",
    trackedInDestiny: false,
    trackedInGuardianNexus: trackedIds.has(challenge.id),
    objectives: [{ ...challenge.objective, progressAvailable: true }],
    percent: challenge.objective.percent,
    updatedAt
  }));
  return [...recordItems, ...weeklyItems];
}

export function trackedJourneyItemsFromProfile(
  profile: any,
  manifest: JourneyProgressManifest,
  activities: CompactManifest | undefined,
  characterId: string,
  trackedIds: Set<string>,
  updatedAt: string,
  includeCompleted = false,
  previouslyTracked = new Set<string>()
): FireteamTrackedItem[] {
  const previousRecordIds = [...previouslyTracked].flatMap((key) => /^(?:title|triumph|seasonal):(.+)$/.exec(key)?.[1] || []);
  const recordIds = [...new Set([...trackedIds, ...previousRecordIds])].filter((id) => Boolean(manifest.records[id]));
  const profileRecords = profile?.profileRecords?.data || {};
  const accountRows = profileRecords.records || {};
  const characterRows = profile?.characterRecords?.data?.[characterId]?.records || {};
  const destinyTracked = new Set([
    String(profileRecords.trackedRecordHash || ""),
    String(profile?.characterRecords?.data?.[characterId]?.trackedRecordHash || "")
  ].filter(Boolean));
  const recordItems = recordIds.flatMap((id) => {
    const definition = manifest.records[id]!;
    const live = definition.scope === 1 ? characterRows[id] || accountRows[id] : accountRows[id] || characterRows[id];
    if (live && (number(live.state) & 16)) return [];
    const record = recordFor(definition, live, manifest, destinyTracked);
    const kind = record.title ? "title" as const : /seasonal challenge/i.test(record.type) ? "seasonal" as const : "triumph" as const;
    if (!trackedIds.has(id) && !previouslyTracked.has(`${kind}:${id}`)) return [];
    if (!includeCompleted && record.complete) return [];
    return [{
      id,
      definitionHash: id,
      kind,
      name: kind === "title" ? record.title! : record.name,
      description: record.description,
      icon: record.icon,
      context: kind === "title" ? "Title & Seal" : kind === "seasonal" ? "Seasonal Challenge" : record.category,
      trackedInDestiny: record.tracked,
      trackedInGuardianNexus: trackedIds.has(id),
      objectives: record.objectives.map((objective) => ({ ...objective, progressAvailable: true })),
      percent: record.percent,
      updatedAt
    }];
  });

  const previousWeeklyIds = [...previouslyTracked].flatMap((key) => /^weekly:(.+)$/.exec(key)?.[1] || []);
  const weeklyIds = new Set([...trackedIds, ...previousWeeklyIds].filter((id) => id.includes(":")));
  if (!weeklyIds.size) return recordItems;
  const activityRows = profile?.characterActivities?.data?.[characterId]?.availableActivities || [];
  const weeklyRows = activityRows.flatMap((activity: any) => (activity?.challenges || []).flatMap((challenge: any, index: number) => {
    const activityHash = String(activity?.activityHash || "");
    const objectiveHash = String(challenge?.objectiveHash || "");
    const id = `${activityHash}:${objectiveHash || index}`;
    if (!weeklyIds.has(id)) return [];
    const definition = activities?.activityDefinitions?.[activityHash] as any;
    const objectiveDefinition = activities?.objectiveDefinitions?.[objectiveHash] as any;
    return [{
      id,
      activityHash,
      name: String(definition?.displayProperties?.name || "Weekly activity"),
      description: String(definition?.displayProperties?.description || ""),
      icon: imageUrl(definition?.displayProperties?.icon || ""),
      objective: objectiveFor(objectiveHash, objectiveDefinition, challenge)
    } satisfies JourneyWeeklyChallenge];
  }));
  const weeklyItems = dedupeWeeklyChallenges(weeklyRows).flatMap((challenge) => {
    if (!trackedIds.has(challenge.id) && !previouslyTracked.has(`weekly:${challenge.id}`)) return [];
    if (!includeCompleted && challenge.objective.complete) return [];
    return [{
      id: challenge.id,
      definitionHash: challenge.objective.objectiveHash,
      kind: "weekly" as const,
      name: challenge.name,
      description: challenge.description,
      icon: challenge.icon,
      context: "Weekly Challenge",
      trackedInDestiny: false,
      trackedInGuardianNexus: trackedIds.has(challenge.id),
      objectives: [{ ...challenge.objective, progressAvailable: true }],
      percent: challenge.objective.percent,
      updatedAt
    }];
  });
  return [...recordItems, ...weeklyItems];
}

function recordFor(definition: JourneyProgressManifest["records"][string], live: any, manifest: JourneyProgressManifest, tracked: Set<string>): JourneyRecord {
  const completeByState = Boolean(number(live?.state) & 1);
  const liveObjectives = new Map((live?.objectives || []).map((objective: any) => [String(objective?.objectiveHash || ""), objective]));
  const objectives = definition.objectiveHashes.flatMap((hash) => {
    const objectiveDefinition = manifest.objectives[hash];
    return objectiveDefinition ? [objectiveFor(hash, objectiveDefinition, liveObjectives.get(hash), completeByState)] : [];
  });
  const complete = completeByState || Boolean(objectives.length && objectives.every((objective) => objective.complete));
  const percent = complete ? 100 : objectives.length ? Math.round(objectives.reduce((sum, objective) => sum + objective.percent, 0) / objectives.length) : 0;
  const parent = definition.parentNodeHashes.map((hash) => manifest.nodes[hash]).find((node) => node?.name);
  return {
    recordHash: definition.hash,
    name: definition.name,
    description: definition.description,
    icon: imageUrl(definition.icon || parent?.icon || ""),
    type: definition.type,
    category: parent?.name || definition.type,
    ...(definition.title ? { title: definition.title } : {}),
    complete,
    tracked: tracked.has(definition.hash),
    percent,
    score: definition.score,
    objectives
  };
}

function objectiveFor(hash: string, definition: any, live: any, recordComplete = false): JourneyObjective {
  const completionValue = Math.max(0, number(live?.completionValue ?? definition?.completionValue));
  const complete = recordComplete || Boolean(live?.complete);
  const raw = number(live?.progress);
  const progress = complete && completionValue > 0 ? Math.max(raw, completionValue) : raw;
  return {
    objectiveHash: hash,
    name: String(definition?.name || definition?.progressDescription || definition?.displayProperties?.name || "Objective"),
    progress,
    completionValue,
    percent: completionValue > 0 ? Math.min(100, Math.floor(progress / completionValue * 100)) : complete ? 100 : 0,
    complete
  };
}

function progressSort(left: { tracked: boolean; complete: boolean; percent: number; name: string }, right: typeof left): number {
  return Number(right.tracked) - Number(left.tracked) || Number(left.complete) - Number(right.complete) || right.percent - left.percent || left.name.localeCompare(right.name);
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}
