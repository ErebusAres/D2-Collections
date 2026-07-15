import type {
  CharacterSummary,
  CollectionData,
  CompactManifest,
  GuardianSummary,
  QuestData,
  QuestObjective,
  QuestProgress
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
  observedDirectly: boolean
): "online" | "offline" | "unknown" {
  if (activity || (character?.minutesPlayedThisSession || 0) > 0) return "online";
  if (observedDirectly && character) return "offline";
  return "unknown";
}

export function activityName(profile: any, manifest: CompactManifest, characterId?: string): string | undefined {
  const transitory = profile?.profileTransitoryData?.data || profile?.profileTransitory?.data;
  const characterActivities = profile?.characterActivities?.data || {};
  const preferred = characterId ? characterActivities[characterId] : undefined;
  const otherActivities = Object.entries(characterActivities)
    .filter(([id]) => id !== characterId)
    .map(([, activity]) => activity as any);
  const components = [preferred, ...otherActivities].filter(Boolean);
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

export function normalizeGuardian(args: {
  profile: any;
  membershipId: string;
  membershipType: number;
  displayName: string;
  bungieName: string;
  requestedCharacterId?: string;
  rewardsPassRank: number;
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
      rewardsPassRank: args.rewardsPassRank
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

export function normalizeCollection(profile: any, manifest: CompactManifest, selectedClass: CharacterSummary["className"], xurSaleItemHashes = new Set<string>()): CollectionData {
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

export function normalizeQuests(profile: any, manifest: CompactManifest, characterId: string, pinnedIds = new Set<string>()): QuestData {
  const inventory = profile?.characterInventories?.data?.[characterId]?.items || [];
  const itemObjectives = profile?.itemComponents?.objectives?.data || {};
  const currentActivity = activityName(profile, manifest, characterId);
  const updatedAt = profile?.responseMintedTimestamp || new Date().toISOString();
  const quests: QuestProgress[] = inventory.flatMap((item: any) => {
    const hash = String(item.itemHash || "");
    const definition = definitionFor(manifest, hash);
    const typeName = String(definition?.itemTypeDisplayName || definition?.itemTypeAndTierDisplayName || "");
    if (Number(definition?.itemType) !== 12 && !/quest|mission|pursuit/i.test(typeName)) return [];
    const instanceId = String(item.itemInstanceId || hash);
    const objectives = objectiveRows(itemObjectives[instanceId], manifest);
    const stepPosition = questStepPosition(definition, hash);
    const activityHash = String(definition?.traitHashes?.[0] || definition?.activityHash || "");
    const activity = (manifest.activityDefinitions[activityHash] as any)?.displayProperties?.name || definition?.sourceData?.sourceName;
    const result: QuestProgress = {
      instanceId,
      itemHash: hash,
      name: definition?.displayProperties?.name || "Unknown quest",
      description: definition?.displayProperties?.description || "Bungie did not return a description for this quest.",
      icon: imageUrl(definition?.displayProperties?.icon),
      currentStep: definition?.displayProperties?.description || definition?.setData?.questStepSummary || "Current step",
      ...stepPosition,
      characterId,
      inGameTracked: Boolean(Number(item.state || 0) & 2),
      sitePinned: pinnedIds.has(instanceId),
      isExoticUnlock: Number(definition?.inventory?.tierType || 0) === 6 || /exotic/i.test(typeName),
      activityName: activity,
      rewards: (definition?.value?.itemValue || []).map((reward: any) => String(reward.itemHash || "")).filter(Boolean),
      objectives,
      percent: 0,
      updatedAt
    };
    result.percent = questPercent(result);
    return [result];
  });
  return { quests, recommendations: recommendQuests(quests, { pinnedIds, currentActivity }), currentActivity };
}
