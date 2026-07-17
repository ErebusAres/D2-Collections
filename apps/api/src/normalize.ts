import type {
  CharacterSummary,
  CollectionData,
  CompactManifest,
  GuardianSummary,
  QuestData,
  QuestObjective,
  QuestProgress,
  QuestStepProgress,
  RewardsPassProgress
} from "@guardian-nexus/contracts";
import { className, imageUrl, mergeCollection, objectivePercent, questPercent, questStepPosition, recommendQuests } from "@guardian-nexus/domain";

const raceNames: Record<number, string> = { 0: "Human", 1: "Awoken", 2: "Exo" };

export function charactersFromProfile(profile: any): CharacterSummary[] {
  return Object.values(profile?.characters?.data || {}).map((character: any) => ({
    characterId: String(character.characterId || ""),
    className: className(character.classType),
    raceName: raceNames[Number(character.raceType)] || "Unknown",
    emblemPath: imageUrl(character.emblemPath),
    emblemBackgroundPath: imageUrl(character.emblemBackgroundPath),
    power: Number(character.light || 0),
    dateLastPlayed: character.dateLastPlayed || "",
    minutesPlayedThisSession: Number(character.minutesPlayedThisSession || 0)
  })).sort((a, b) => Date.parse(b.dateLastPlayed || "0") - Date.parse(a.dateLastPlayed || "0"));
}

export function selectedCharacter(characters: CharacterSummary[], requested?: string): CharacterSummary | undefined {
  return characters.find((character) => character.characterId === requested) || characters[0];
}

export function guardianOnlineState(
  character: Pick<CharacterSummary, "minutesPlayedThisSession"> | undefined,
  activity: string | undefined,
  observedDirectly: boolean,
  observedInParty = false
): "online" | "offline" | "unknown" {
  if (activity || observedInParty || Number(character?.minutesPlayedThisSession || 0) > 0) return "online";
  if (observedDirectly && character) return "offline";
  return "unknown";
}

export function activityName(profile: any, manifest: CompactManifest, characterId?: string): string | undefined {
  const transitory = profile?.profileTransitoryData?.data || profile?.profileTransitory?.data;
  const characterActivities = profile?.characterActivities?.data || {};
  const preferred = characterId ? characterActivities[characterId] : undefined;
  const components = characterId
    ? [preferred].filter(Boolean)
    : Object.values(characterActivities);
  const hashes = [
    transitory?.currentActivity?.activityHash,
    ...components.map((activity: any) => activity?.currentActivityHash),
    ...components.map((activity: any) => activity?.currentPlaylistActivityHash)
  ].map(String).filter((hash) => hash && hash !== "0");
  for (const hash of [...new Set(hashes)]) {
    const definition = manifest.activityDefinitions[hash] as any;
    const name = String(definition?.displayProperties?.name || definition?.originalDisplayProperties?.name || "").trim();
    if (name) return name;
  }
  return undefined;
}

export function guardianLocation(
  profile: any,
  manifest: CompactManifest,
  characterId: string | undefined,
  onlineState: "online" | "offline" | "unknown"
): string | undefined {
  if (onlineState === "offline") return undefined;
  const resolved = activityName(profile, manifest, characterId);
  if (resolved) return resolved;
  if (onlineState !== "online") return undefined;

  const activity = characterId ? profile?.characterActivities?.data?.[characterId] : undefined;
  if (activity && Number(activity.currentActivityHash || 0) === 0 && Number(activity.currentPlaylistActivityHash || 0) === 0) return "Orbit";
  return "Online · location unavailable";
}

export function normalizeGuardian(args: {
  profile: any;
  membershipId: string;
  membershipType: number;
  displayName: string;
  bungieName: string;
  requestedCharacterId?: string;
  rewardsPass: { rank: number; progress: RewardsPassProgress };
  manifest: CompactManifest;
}): GuardianSummary {
  const characters = charactersFromProfile(args.profile);
  const selected = selectedCharacter(characters, args.requestedCharacterId);
  const profileData = args.profile?.profile?.data || {};
  const currentActivity = activityName(args.profile, args.manifest, selected?.characterId);
  return {
    membershipId: args.membershipId,
    membershipType: args.membershipType,
    displayName: args.displayName,
    bungieName: args.bungieName,
    selectedCharacterId: selected?.characterId || "",
    characters,
    stats: {
      power: selected?.power || 0,
      guardianRank: Number(profileData.currentGuardianRank || profileData.renewedGuardianRank || profileData.lifetimeHighestGuardianRank || 0),
      rewardsPassRank: args.rewardsPass.rank,
      rewardsPassProgress: args.rewardsPass.progress,
      mailboxCount: (args.profile?.characterInventories?.data?.[selected?.characterId || ""]?.items || [])
        .filter((item: any) => String(item?.bucketHash || "") === "215593132").length
    },
    currentActivity,
    isInGame: Boolean(selected?.minutesPlayedThisSession && currentActivity)
  };
}

function collectibleStates(profile: any): Map<string, number> {
  const rows = new Map<string, number>();
  const apply = (component: any) => Object.entries(component?.collectibles || {}).forEach(([hash, row]: [string, any]) => rows.set(hash, Number(row?.state || 0)));
  apply(profile?.profileCollectibles?.data);
  Object.values(profile?.characterCollectibles?.data || {}).forEach(apply);
  return rows;
}

function recordSets(profile: any): { completed: Set<string>; visible: Set<string> } {
  const completed = new Set<string>();
  const visible = new Set<string>();
  const apply = (component: any) => Object.entries(component?.records || {}).forEach(([hash, row]: [string, any]) => {
    const state = Number(row?.state || 0);
    const objectives = row?.objectives || [];
    if (!(state & 16) && !(state & 8)) visible.add(hash);
    if ((state & 1) || (objectives.length > 0 && objectives.every((objective: any) => objective.complete))) completed.add(hash);
  });
  apply(profile?.profileRecords?.data);
  Object.values(profile?.characterRecords?.data || {}).forEach(apply);
  return { completed, visible };
}

export function normalizeCollection(profile: any, manifest: CompactManifest, selectedClass?: CharacterSummary["className"], xurSaleItemHashes = new Set<string>()): CollectionData {
  const states = collectibleStates(profile);
  const records = recordSets(profile);
  const entries = mergeCollection(manifest, {
    ownedCollectibleHashes: new Set([...states].filter(([, state]) => (state & 1) === 0).map(([hash]) => hash)),
    completedRecordHashes: records.completed,
    visibleRecordHashes: records.visible,
    xurSaleItemHashes
  }, selectedClass);
  return {
    manifestVersion: manifest.version,
    entries,
    totals: {
      owned: entries.filter((entry) => entry.owned).length,
      available: entries.length,
      catalystsAvailable: entries.filter((entry) => entry.kind === "weapon" && entry.catalyst !== "unavailable").length,
      catalystsOwned: entries.filter((entry) => entry.kind === "weapon" && (entry.catalyst === "obtained" || entry.catalyst === "complete")).length,
      catalystsComplete: entries.filter((entry) => entry.kind === "weapon" && entry.catalyst === "complete").length,
      xurSelling: entries.filter((entry) => entry.xurSelling).length
    },
    xur: { state: "unavailable", checkedAt: new Date().toISOString() }
  };
}

function definitionFor(manifest: CompactManifest, itemHash: string): any {
  return manifest.itemDefinitions[itemHash] || manifest.items.find((item) => item.itemHash === itemHash) || {};
}

function objectiveRows(component: any, manifest: CompactManifest): QuestObjective[] {
  return (component?.objectives || []).map((objective: any) => {
    const hash = String(objective.objectiveHash || "");
    const definition = manifest.objectiveDefinitions[hash] as any;
    const progress = Number(objective.progress || 0);
    const completionValue = Number(objective.completionValue || definition?.completionValue || 0);
    return {
      objectiveHash: hash,
      name: definition?.progressDescription || definition?.displayProperties?.name || "Objective",
      progress,
      completionValue,
      complete: Boolean(objective.complete),
      percent: objectivePercent(progress, completionValue, Boolean(objective.complete))
    };
  });
}

function questSteps(definition: any, currentHash: string, currentObjectives: QuestObjective[], manifest: CompactManifest): QuestStepProgress[] {
  const itemList = Array.isArray(definition?.setData?.itemList) ? [...definition.setData.itemList] : [];
  const ordered = itemList.sort((a: any, b: any) => Number(a?.trackingValue || 0) - Number(b?.trackingValue || 0));
  const currentIndex = ordered.findIndex((entry: any) => String(entry?.itemHash || "") === currentHash);
  if (currentIndex < 0) return [{
    itemHash: currentHash, stepNumber: 1, name: stepRequirement(definition, 1), description: stepDescription(definition), status: "current",
    objectives: currentObjectives, percent: questPercent({ objectives: currentObjectives }), progressKnown: currentObjectives.length > 0
  }];
  return ordered.map((entry: any, index: number) => {
    const itemHash = String(entry?.itemHash || "");
    const stepDefinition = definitionFor(manifest, itemHash);
    const status: QuestStepProgress["status"] = index < currentIndex ? "completed" : index === currentIndex ? "current" : "future";
    const liveObjectives = status === "current" ? currentObjectives : [];
    const objectives = liveObjectives.length ? liveObjectives : staticStepObjectives(stepDefinition, manifest, status);
    const percent = status === "completed" ? 100 : status === "future" ? 0 : questPercent({ objectives });
    return {
      itemHash, stepNumber: index + 1, name: stepRequirement(stepDefinition, index + 1), description: stepDescription(stepDefinition), status,
      objectives, percent, progressKnown: status !== "current" || liveObjectives.length > 0
    };
  });
}

function staticStepObjectives(definition: any, manifest: CompactManifest, status: QuestStepProgress["status"]): QuestObjective[] {
  return (definition?.objectives?.objectiveHashes || []).map((value: unknown) => {
    const objectiveHash = String(value || "");
    const objective = manifest.objectiveDefinitions[objectiveHash] as any;
    const completionValue = Number(objective?.completionValue || 0);
    const complete = status === "completed";
    return {
      objectiveHash, name: objective?.progressDescription || objective?.displayProperties?.name || "Objective",
      progress: complete ? completionValue : 0, completionValue, complete, percent: complete ? 100 : 0
    };
  });
}

function stepRequirement(definition: any, stepNumber: number): string {
  const description = String(definition?.displayProperties?.description || "").split(/\r?\n/).map((value) => value.trim()).find(Boolean);
  return description || String(definition?.setData?.questStepSummary || definition?.displayProperties?.name || `Step ${stepNumber}`);
}
function stepDescription(definition: any): string { return String(definition?.setData?.questStepSummary || definition?.displayProperties?.description || "Bungie does not expose additional instructions for this step."); }

export function normalizeQuests(profile: any, manifest: CompactManifest, characterId: string, pinnedIds = new Set<string>()): QuestData {
  const inventory = profile?.characterInventories?.data?.[characterId]?.items || [];
  const itemObjectives = profile?.itemComponents?.objectives?.data || {};
  const currentActivity = activityName(profile, manifest, characterId);
  const updatedAt = profile?.responseMintedTimestamp || new Date().toISOString();
  const quests: QuestProgress[] = inventory.flatMap((item: any) => {
    const hash = String(item.itemHash || "");
    const definition = definitionFor(manifest, hash);
    const typeName = String(definition?.itemTypeDisplayName || definition?.itemTypeAndTierDisplayName || "");
    if (Number(definition?.itemType) !== 12 && !/quest|mission|pursuit|bounty|order/i.test(typeName)) return [];
    const instanceId = String(item.itemInstanceId || hash);
    const objectives = objectiveRows(itemObjectives[instanceId], manifest);
    const stepPosition = questStepPosition(definition, hash);
    const steps = questSteps(definition, hash, objectives, manifest);
    const activityHash = String(definition?.traitHashes?.[0] || definition?.activityHash || "");
    const activity = (manifest.activityDefinitions[activityHash] as any)?.displayProperties?.name || definition?.sourceData?.sourceName;
    const result: QuestProgress = {
      instanceId,
      itemHash: hash,
      name: definition?.displayProperties?.name || "Unknown quest",
      description: definition?.displayProperties?.description || "Bungie did not return a description for this quest.",
      flavorText: definition?.flavorText || undefined,
      itemType: definition?.itemTypeDisplayName || definition?.itemTypeAndTierDisplayName || undefined,
      rarity: definition?.inventory?.tierTypeName || undefined,
      icon: imageUrl(definition?.displayProperties?.icon),
      currentStep: definition?.displayProperties?.description || definition?.setData?.questStepSummary || "Current step",
      ...stepPosition,
      characterId,
      inGameTracked: Boolean(Number(item.state || 0) & 2),
      sitePinned: pinnedIds.has(instanceId),
      isExoticUnlock: Number(definition?.inventory?.tierType || 0) === 6 || /exotic/i.test(typeName),
      activityName: activity,
      rewards: (definition?.value?.itemValue || []).map((reward: any) => {
        const rewardHash = String(reward.itemHash || "");
        const rewardDefinition = definitionFor(manifest, rewardHash);
        const properties = rewardDefinition?.displayProperties || {};
        return {
          itemHash: rewardHash,
          name: String(properties?.name || "Bungie reward definition unavailable"),
          description: String(properties?.description || ""),
          icon: imageUrl(properties?.icon),
          quantity: Math.max(1, Number(reward?.quantity || 1)),
          definitionAvailable: Boolean(properties?.name)
        };
      }).filter((reward: any) => Boolean(reward.itemHash)),
      objectives,
      steps,
      percent: 0,
      expiresAt: item.expirationDate || undefined,
      updatedAt,
      category: /bounty/i.test(typeName) ? "bounty" : /order/i.test(typeName) ? "order" : "quest"
    };
    result.percent = questPercent(result);
    return [result];
  });
  return { quests, recommendations: recommendQuests(quests, { pinnedIds, currentActivity }), currentActivity };
}
