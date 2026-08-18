import type {
  CharacterSummary,
  CollectionData,
  ActivityNameManifest,
  CompactManifest,
  GuardianSummary,
  QuestData,
  QuestObjective,
  QuestProgress,
  QuestStepProgress,
  PvpProgression,
  RewardsPassProgress,
  XurCurrencyBalance,
  XurOffer
} from "@guardian-nexus/contracts";
import { className, imageUrl, mergeCollection, objectivePercent, questPercent, questStepPosition, recommendQuests } from "@guardian-nexus/domain";
import { questStepGuide } from "./questStepGuide";

const raceNames: Record<number, string> = { 0: "Human", 1: "Awoken", 2: "Exo" };
export const QUEST_BUCKET_HASH = "1345459588";
export const STRANGE_COIN_ITEM_HASH = "800069450";
const STRANGE_COIN_ICON = imageUrl("/common/destiny2_content/icons/1fa5806bb6ec16b5f8cdeb4b36d4bb01.jpg");

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
  // Party membership is the strongest available live signal. Character
  // activity components can remain populated after sign-out, so never let a
  // cached activity override an observed zero-minute session.
  if (observedInParty) return "online";
  if (character && Number(character.minutesPlayedThisSession || 0) > 0) return "online";
  if (observedDirectly && character) return "offline";
  if (activity && !observedDirectly) return "unknown";
  return "unknown";
}

type ActivityLookup = CompactManifest | ActivityNameManifest;

export function activityName(profile: any, manifest: ActivityLookup, characterId?: string): string | undefined {
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
    const definition = "activityDefinitions" in manifest ? manifest.activityDefinitions[hash] as any : undefined;
    const name = String(("names" in manifest ? manifest.names[hash] : undefined) || definition?.displayProperties?.name || definition?.originalDisplayProperties?.name || "").trim();
    if (name) return name;
  }
  return undefined;
}

export function guardianLocation(
  profile: any,
  manifest: ActivityLookup,
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
  crucibleRank?: PvpProgression;
  manifest: ActivityLookup;
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
      crucibleRank: args.crucibleRank,
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

function recordSets(profile: any, manifest: CompactManifest): { completed: Set<string>; visible: Set<string>; objectives: Map<string, QuestObjective[]>; tracked: Set<string> } {
  const completed = new Set<string>();
  const visible = new Set<string>();
  const objectives = new Map<string, QuestObjective[]>();
  const tracked = new Set<string>();
  const apply = (component: any) => {
    const trackedRecordHash = String(component?.trackedRecordHash || "");
    if (trackedRecordHash && trackedRecordHash !== "0") tracked.add(trackedRecordHash);
    Object.entries(component?.records || {}).forEach(([hash, row]: [string, any]) => {
      const state = Number(row?.state || 0);
      const progress = [...(row?.objectives || []), ...(row?.intervalObjectives || [])];
      if (!(state & 16) && !(state & 8)) visible.add(hash);
      if ((state & 1) || (progress.length > 0 && progress.every((objective: any) => objective.complete))) completed.add(hash);
      if (progress.length) objectives.set(hash, mergeObjectiveRows(objectives.get(hash) || [], objectiveRows({ objectives: progress }, manifest)));
    });
  };
  apply(profile?.profileRecords?.data);
  Object.values(profile?.characterRecords?.data || {}).forEach(apply);
  return { completed, visible, objectives, tracked };
}

function mergeObjectiveRows(current: QuestObjective[], incoming: QuestObjective[]): QuestObjective[] {
  const rows = new Map(current.map((objective) => [objective.objectiveHash, objective]));
  for (const objective of incoming) {
    const existing = rows.get(objective.objectiveHash);
    if (!existing || objective.complete || objective.progress > existing.progress) rows.set(objective.objectiveHash, objective);
  }
  return [...rows.values()];
}

function ownedItemHashes(profile: any): Set<string> {
  const hashes = new Set<string>();
  const apply = (component: any) => (component?.items || []).forEach((item: any) => {
    const hash = String(item?.itemHash || "");
    if (hash && hash !== "0") hashes.add(hash);
  });
  apply(profile?.profileInventory?.data);
  Object.values(profile?.characterInventories?.data || {}).forEach(apply);
  Object.values(profile?.characterEquipment?.data || {}).forEach(apply);
  return hashes;
}

export function xurStrangeCoinBalance(profile: any, offers: XurOffer[] = []): XurCurrencyBalance | undefined {
  const inventoryComponents = [
    profile?.profileInventory?.data,
    ...Object.values(profile?.characterInventories?.data || {})
  ];
  if (!inventoryComponents.some((component: any) => Array.isArray(component?.items))) return undefined;

  const storefrontCurrency = offers
    .flatMap((offer) => offer.costs)
    .find((cost) => /^strange coins?$/i.test(cost.name.trim()));
  const itemHash = storefrontCurrency?.itemHash || STRANGE_COIN_ITEM_HASH;
  const quantity = inventoryComponents.reduce((total, component: any) => total + (component?.items || [])
    .filter((item: any) => String(item?.itemHash || "") === itemHash)
    .reduce((subtotal: number, item: any) => subtotal + Math.max(0, Number(item?.quantity || 0)), 0), 0);

  return {
    itemHash,
    name: storefrontCurrency?.name || "Strange Coin",
    icon: storefrontCurrency?.icon || STRANGE_COIN_ICON,
    quantity
  };
}

export function addXurCollectionStates(profile: any, manifest: CompactManifest, offers: XurOffer[]): XurOffer[] {
  const collection = normalizeCollection(profile, manifest);
  const collectibleState = collectibleStates(profile);
  const physicalItems = ownedItemHashes(profile);
  const hasCollectionData = Boolean(profile?.profileCollectibles?.data || Object.keys(profile?.characterCollectibles?.data || {}).length);
  const byHash = new Map(collection.entries.map((entry) => [entry.itemHash, entry]));
  const byIdentity = new Map(collection.entries.map((entry) => [collectionIdentity(entry.name, entry.className), entry]));

  return offers.map((offer) => {
    if (offer.category === "other") return { ...offer, collectionState: "not-applicable" };
    if (offer.category === "exotic-catalyst") {
      const itemName = offer.name.replace(/\s+catalyst\s*$/i, "").trim();
      const entry = byIdentity.get(collectionIdentity(itemName));
      if (!entry || entry.catalyst === "unavailable") return { ...offer, collectionState: "unknown" };
      return { ...offer, collectionState: entry.catalyst === "obtained" || entry.catalyst === "complete" ? "owned" : "missing" };
    }

    const collectionEntry = byHash.get(offer.itemHash)
      || byIdentity.get(collectionIdentity(offer.name, offer.className));
    if (collectionEntry) return { ...offer, collectionState: collectionEntry.owned ? "owned" : "missing" };
    if (physicalItems.has(offer.itemHash)) return { ...offer, collectionState: "owned" };
    if (offer.collectibleHash && hasCollectionData) {
      const state = collectibleState.get(offer.collectibleHash);
      return { ...offer, collectionState: state !== undefined && (state & 1) === 0 ? "owned" : "missing" };
    }
    return { ...offer, collectionState: "unknown" };
  });
}

function collectionIdentity(name: string, className?: string): string {
  return `${name.trim().toLocaleLowerCase()}|${className || ""}`;
}

export function normalizeCollection(profile: any, manifest: CompactManifest, selectedClass?: CharacterSummary["className"], xurSaleItemHashes = new Set<string>()): CollectionData {
  const states = collectibleStates(profile);
  const records = recordSets(profile, manifest);
  const entries = mergeCollection(manifest, {
    ownedCollectibleHashes: new Set([...states].filter(([, state]) => (state & 1) === 0).map(([hash]) => hash)),
    completedRecordHashes: records.completed,
    visibleRecordHashes: records.visible,
    recordObjectives: records.objectives,
    destinyTrackedRecordHashes: records.tracked,
    ownedItemHashes: ownedItemHashes(profile),
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

function questSteps(definition: any, currentHash: string, currentObjectives: QuestObjective[], manifest: CompactManifest, questName: string, activityName?: string): QuestStepProgress[] {
  const itemList = Array.isArray(definition?.setData?.itemList) ? [...definition.setData.itemList] : [];
  const ordered = itemList.sort((a: any, b: any) => Number(a?.trackingValue || 0) - Number(b?.trackingValue || 0));
  const currentIndex = ordered.findIndex((entry: any) => String(entry?.itemHash || "") === currentHash);
  if (currentIndex < 0) {
    const name = stepRequirement(definition, 1);
    const description = stepDescription(definition);
    return [{
      itemHash: currentHash, stepNumber: 1, name, description, status: "current",
      objectives: currentObjectives, percent: questPercent({ objectives: currentObjectives }), progressKnown: currentObjectives.length > 0,
      guide: questStepGuide({ questName, stepName: name, description, activityName, objectives: currentObjectives })
    }];
  }
  return ordered.map((entry: any, index: number) => {
    const itemHash = String(entry?.itemHash || "");
    const stepDefinition = definitionFor(manifest, itemHash);
    const status: QuestStepProgress["status"] = index < currentIndex ? "completed" : index === currentIndex ? "current" : "future";
    const liveObjectives = status === "current" ? currentObjectives : [];
    const objectives = liveObjectives.length ? liveObjectives : staticStepObjectives(stepDefinition, manifest, status);
    const percent = status === "completed" ? 100 : status === "future" ? 0 : questPercent({ objectives });
    const name = stepRequirement(stepDefinition, index + 1);
    const description = stepDescription(stepDefinition);
    return {
      itemHash, stepNumber: index + 1, name, description, status,
      objectives, percent, progressKnown: status !== "current" || liveObjectives.length > 0,
      guide: questStepGuide({ questName, stepName: name, description, activityName, objectives })
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
  const inventory = questInventoryItems(profile, characterId);
  const itemObjectives = profile?.itemComponents?.objectives?.data || {};
  const uninstancedObjectives = profile?.characterUninstancedItemComponents?.[characterId]?.objectives?.data || {};
  const currentActivity = activityName(profile, manifest, characterId);
  const updatedAt = profile?.responseMintedTimestamp || new Date().toISOString();
  const quests: QuestProgress[] = inventory.flatMap((item: any) => {
    const hash = String(item.itemHash || "");
    const definition = definitionFor(manifest, hash);
    const typeName = String(definition?.itemTypeDisplayName || definition?.itemTypeAndTierDisplayName || "");
    if (String(item?.bucketHash || "") !== QUEST_BUCKET_HASH && Number(definition?.itemType) !== 12 && !/quest|mission|pursuit|bounty|order/i.test(typeName)) return [];
    const instanceId = String(item.itemInstanceId || hash);
    // Bungie keys ordinary item objectives by instance ID, but many quest and
    // pursuit objectives are returned in the character-scoped uninstanced map
    // and keyed by the quest definition hash.
    const objectives = objectiveRows(
      itemObjectives[instanceId] || uninstancedObjectives[hash] || itemObjectives[hash],
      manifest
    );
    const stepPosition = questStepPosition(definition, hash);
    const activityHash = String(definition?.traitHashes?.[0] || definition?.activityHash || "");
    const activity = (manifest.activityDefinitions[activityHash] as any)?.displayProperties?.name || definition?.sourceData?.sourceName;
    const questName = definition?.displayProperties?.name || "Unknown quest";
    const steps = questSteps(definition, hash, objectives, manifest, questName, activity);
    const result: QuestProgress = {
      instanceId,
      itemHash: hash,
      name: questName,
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
      guide: steps.find((step) => step.status === "current")?.guide,
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

export function applyQuestPins(data: QuestData, pinnedIds: Set<string>): QuestData {
  const quests = data.quests.map((quest) => ({ ...quest, sitePinned: pinnedIds.has(quest.instanceId) }));
  return { ...data, quests, recommendations: recommendQuests(quests, { pinnedIds, currentActivity: data.currentActivity }) };
}

export function questInventoryItems(profile: any, characterId: string): any[] {
  const characterItems = Array.isArray(profile?.characterInventories?.data?.[characterId]?.items)
    ? profile.characterInventories.data[characterId].items
    : [];
  const characterHashes = new Set(characterItems.map((item: any) => String(item?.itemHash || "")).filter(Boolean));
  const profileItems = Array.isArray(profile?.profileInventory?.data?.items) ? profile.profileInventory.data.items : [];
  const accountItems = new Map<string, any>();
  for (const item of profileItems) {
    const hash = String(item?.itemHash || "");
    if (!hash || characterHashes.has(hash)) continue;
    const existing = accountItems.get(hash);
    // Account inventory can contain duplicate definitions. Preserve the live
    // tracked instance instead of allowing an arbitrary untracked duplicate
    // returned first by Bungie to mask it.
    if (!existing || (!(Number(existing.state || 0) & 2) && (Number(item.state || 0) & 2))) {
      accountItems.set(hash, item);
    }
  }
  return [...characterItems, ...accountItems.values()];
}
