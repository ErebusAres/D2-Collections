import type {
  ArmorItem,
  BuildAdvisorArmorEvaluation,
  BuildAdvisorAssemblyStatus,
  BuildAdvisorCategory,
  BuildAdvisorCollectionItem,
  BuildAdvisorData,
  BuildAdvisorEquipPlan,
  BuildAdvisorFocus,
  BuildAdvisorInventoryAnalysis,
  BuildAdvisorMissingItemGuide,
  BuildAdvisorOwnedItem,
  BuildAdvisorRecommendation,
  BuildAdvisorRollQuality,
  BuildAdvisorScoreFactor,
  BuildAdvisorSubclassValidation,
  BuildAdvisorWeaponEvaluation,
  BuildDocument,
  BuildEquipmentEntry,
  BuildGhostFocus,
  BuildGuardianClass,
  BuildNamedEntry,
  BuildStatName,
  CharacterSummary,
  CompactManifest,
  CompanionManifest,
  GearManifest,
  GuardianClass,
  ManifestItem
} from "@guardian-nexus/contracts";
import { imageUrl } from "@guardian-nexus/domain";
import { buildDocumentSchema } from "./builds";
import { normalizeGear } from "./gear";
import {
  BUILD_ADVISOR_CURATED_VERIFICATION,
  BUILD_ADVISOR_TEMPLATES,
  BUILD_ADVISOR_TEMPLATE_REVIEWED_AT,
  BUILD_ADVISOR_TEMPLATE_SET_VERSION,
  named,
  type BuildAdvisorTemplate,
  type BuildAdvisorWeaponRequirement
} from "./buildAdvisorTemplates";

const CLASS_BY_TYPE: Record<number, GuardianClass> = { 0: "Titan", 1: "Hunter", 2: "Warlock", 3: "Unknown" };
const BUILD_CLASS: Record<GuardianClass, BuildGuardianClass | undefined> = { Hunter: "hunter", Titan: "titan", Warlock: "warlock", Unknown: undefined };
const DAMAGE_BY_TYPE: Record<number, string> = { 1: "Kinetic", 2: "Arc", 3: "Solar", 4: "Void", 6: "Stasis", 7: "Strand" };
const PRIMARY_STAT_POWER_FLOOR = 20;
const STALE_AFTER_MS = 3 * 60_000;
const ARMOR_SLOTS = ["helmet", "arms", "chest", "legs", "classItem"] as const;
const ARMOR_SLOT_LABELS: Record<(typeof ARMOR_SLOTS)[number], string> = {
  helmet: "Helmet",
  arms: "Gauntlets",
  chest: "Chest Armor",
  legs: "Leg Armor",
  classItem: "Class Item"
};
const ARMOR_STAT_TO_BUILD: Record<keyof ArmorItem["currentStats"], BuildStatName> = {
  health: "Health",
  melee: "Melee",
  grenade: "Grenade",
  super: "Super",
  class: "Class",
  weapons: "Weapons"
};

export interface NormalizedBuildAdvisorInventory {
  items: BuildAdvisorOwnedItem[];
  collectionOnlyExotics: BuildAdvisorCollectionItem[];
  definitionByName: Map<string, BuildNamedEntry>;
  definitionCandidatesByName: Map<string, AdvisorDefinitionCandidate[]>;
  abilityDefinitionCount: number;
  manifestItemByName: Map<string, ManifestItem>;
  syncTimestamp: string;
  warnings: string[];
}

type AdvisorAbilityKind = "super" | "classAbility" | "movement" | "melee" | "grenade" | "transcendence" | "aspect" | "fragment";

interface AdvisorDefinitionCandidate {
  entry: BuildNamedEntry;
  classType?: BuildGuardianClass;
  subclass?: BuildAdvisorTemplate["subclass"];
  kind?: AdvisorAbilityKind;
}

interface TemplateSubclassValidation extends BuildAdvisorSubclassValidation {
  issues: string[];
}

interface ScoredTemplate {
  recommendation: BuildAdvisorRecommendation;
  template: BuildAdvisorTemplate;
  equippedMatchCount: number;
}

export function normalizeBuildAdvisorInventory(
  profile: any,
  companionManifest: CompanionManifest,
  collectionManifest: CompactManifest,
  characters: CharacterSummary[],
  gearManifest?: GearManifest
): NormalizedBuildAdvisorInventory {
  const definitions = companionManifest.itemDefinitions || {};
  const sockets = profile?.itemComponents?.sockets?.data || {};
  const reusablePlugs = profile?.itemComponents?.reusablePlugs?.data || {};
  const instances = profile?.itemComponents?.instances?.data || {};
  const itemStates = profile?.itemComponents?.state?.data || {};
  const characterClasses = new Map(characters.map((character) => [character.characterId, character.className]));
  const firstCharacter = characters[0];
  const normalizedGear = gearManifest && firstCharacter
    ? normalizeGear(profile, gearManifest, firstCharacter.characterId, firstCharacter.className, new Map(), String(profile?.responseMintedTimestamp || new Date().toISOString()))
    : undefined;
  const armorByInstance = new Map((normalizedGear?.items || []).map((item) => [item.instanceId, item]));
  const definitionByName = new Map<string, BuildNamedEntry>();
  const definitionScoreByName = new Map<string, number>();
  const definitionCandidatesByName = new Map<string, AdvisorDefinitionCandidate[]>();
  for (const [hash, value] of Object.entries(definitions) as Array<[string, any]>) {
    const name = String(value?.displayProperties?.name || "").trim();
    if (!name) continue;
    const entry: BuildNamedEntry = {
      name,
      hash,
      ...(value?.displayProperties?.icon ? { icon: imageUrl(value.displayProperties.icon) } : {}),
      ...(value?.itemTypeDisplayName ? { itemType: String(value.itemTypeDisplayName) } : {}),
      ...(value?.displayProperties?.description ? { description: String(value.displayProperties.description) } : {})
    };
    const key = normalizeName(name);
    const compatibility = abilityCompatibility(value);
    const candidates = definitionCandidatesByName.get(key) || [];
    candidates.push({ entry, ...compatibility });
    definitionCandidatesByName.set(key, candidates);
    const score = definitionPreference(entry, compatibility);
    if (score > (definitionScoreByName.get(key) ?? -1)) {
      definitionByName.set(key, entry);
      definitionScoreByName.set(key, score);
    }
  }
  const collectionByHash = new Map(collectionManifest.items.map((item) => [item.itemHash, item]));
  const manifestItemByName = representativeManifestItems(collectionManifest.items);
  const collectionByName = manifestItemByName;
  const rows: Array<{ item: any; location: BuildAdvisorOwnedItem["location"]; ownerCharacterId?: string; equipped: boolean }> = [];
  for (const item of profile?.profileInventory?.data?.items || []) rows.push({ item, location: "vault", equipped: false });
  for (const [ownerCharacterId, container] of Object.entries(profile?.characterInventories?.data || {}) as Array<[string, any]>) {
    for (const item of container?.items || []) rows.push({ item, location: "inventory", ownerCharacterId, equipped: false });
  }
  for (const [ownerCharacterId, container] of Object.entries(profile?.characterEquipment?.data || {}) as Array<[string, any]>) {
    for (const item of container?.items || []) rows.push({ item, location: "equipped", ownerCharacterId, equipped: true });
  }

  const seen = new Set<string>();
  const items: BuildAdvisorOwnedItem[] = [];
  for (const row of rows) {
    const instanceId = String(row.item?.itemInstanceId || "");
    const itemHash = hashOf(row.item?.itemHash);
    if (!instanceId || !itemHash || itemHash === "0" || seen.has(instanceId)) continue;
    seen.add(instanceId);
    const definition: any = definitions[itemHash];
    if (!definition || ![2, 3].includes(Number(definition.itemType))) continue;
    const properties = definition.displayProperties || {};
    const name = String(properties.name || collectionByHash.get(itemHash)?.name || "Unknown item");
    const compact = collectionByHash.get(itemHash) || collectionByName.get(normalizeName(name));
    const activePlugs = socketPlugHashes(sockets[instanceId]).map((hash) => plugEntry(hash, definitions)).filter(isDefined);
    const selectablePlugs = reusablePlugHashes(reusablePlugs[instanceId]).map((hash) => plugEntry(hash, definitions)).filter(isDefined);
    const className = compact?.className || classFromDefinition(definition) || (Number(definition.itemType) === 2 ? characterClasses.get(row.ownerCharacterId || "") : undefined);
    const damageType = String(compact?.damageType || definition.damageType || DAMAGE_BY_TYPE[Number(definition.defaultDamageType)] || "").trim() || undefined;
    const icon = imageUrl(properties.icon || compact?.icon);
    const armor = armorByInstance.get(instanceId);
    items.push({
      instanceId,
      itemHash,
      name,
      icon,
      itemType: String(definition.itemTypeDisplayName || compact?.itemType || (Number(definition.itemType) === 2 ? "Armor" : "Weapon")),
      rarity: String(definition.inventory?.tierTypeName || "Unknown"),
      slot: String(definition.equipmentSlot || compact?.slot || ""),
      ...(damageType ? { damageType } : {}),
      ...(className ? { className } : {}),
      location: row.location,
      ...(row.ownerCharacterId ? { ownerCharacterId: row.ownerCharacterId } : {}),
      ...(row.ownerCharacterId && characterClasses.get(row.ownerCharacterId) ? { ownerClassName: characterClasses.get(row.ownerCharacterId) } : {}),
      equipped: row.equipped,
      transferable: Number(row.item?.transferStatus || 0) === 0,
      power: Number(instances[instanceId]?.primaryStat?.value || row.item?.primaryStat?.value || 0),
      exotic: Number(definition.inventory?.tierType || 0) === 6 || /exotic/i.test(String(definition.inventory?.tierTypeName || "")),
      crafted: Boolean(Number(itemStates[instanceId]?.state || row.item?.state || 0) & 8),
      perks: uniqueNamedEntries(activePlugs),
      enhancedPerks: activePlugs.filter((plug) => /enhanced/i.test(plug.name)).map((plug) => plug.name),
      selectablePerks: uniqueNamedEntries(selectablePlugs),
      rollDataState: sockets[instanceId] || reusablePlugs[instanceId] ? "known" : "unknown",
      ...(armor ? {
        armorStats: Object.fromEntries(Object.entries(armor.currentStats).map(([key, value]) => [ARMOR_STAT_TO_BUILD[key as keyof ArmorItem["currentStats"]], value])),
        armorBaseTotal: armor.baseTotal,
        armorCurrentTotal: armor.currentTotal,
        armorTier: armor.gearTier,
        ...(armor.archetype ? { armorArchetype: armor.archetype } : {}),
        ...(armor.tunedStat ? { tunedStat: ARMOR_STAT_TO_BUILD[armor.tunedStat] } : {}),
        masterworked: armor.masterworked
      } : {})
    });
  }

  const physicalNames = new Set(items.map((item) => normalizeName(item.name)));
  const ownedCollectibles = ownedCollectibleHashes(profile);
  const collectionOnlyExotics = collectionManifest.items
    .filter((item) => Boolean(item.collectibleHash && ownedCollectibles.has(item.collectibleHash)))
    .filter((item) => !physicalNames.has(normalizeName(item.name)))
    .filter((item) => item.kind === "weapon" || item.kind === "armor")
    .map((item): BuildAdvisorCollectionItem => ({
      itemHash: item.itemHash,
      name: item.name,
      icon: imageUrl(item.icon),
      itemType: item.itemType,
      ...(item.className ? { className: item.className } : {})
    }))
    .filter((item, index, all) => all.findIndex((candidate) => normalizeName(candidate.name) === normalizeName(item.name)) === index)
    .sort((left, right) => left.name.localeCompare(right.name));

  const warnings: string[] = [];
  if (companionManifest.version === "unavailable") warnings.push("Item definitions are unavailable, so physical inventory cannot be evaluated.");
  if (!profile?.itemComponents?.instances?.data) warnings.push("Bungie did not return item instance data; item Power may be incomplete.");
  if (!profile?.itemComponents?.sockets?.data) warnings.push("Bungie did not return item socket data; legendary roll quality is unknown.");
  if (!profile?.itemComponents?.perks?.data) warnings.push("Bungie did not return item perk state data; active intrinsic effects may be incomplete.");
  if (!profile?.itemComponents?.reusablePlugs?.data) warnings.push("Selectable perk data is unavailable for some weapon instances.");
  if (!profile?.profileCollectibles?.data && !profile?.characterCollectibles?.data) warnings.push("Collections data is unavailable; collection-only exotics cannot be verified.");
  if (gearManifest?.version === "unavailable") warnings.push("Armor stat definitions are unavailable; armor pieces can be selected, but their stat fit cannot be evaluated.");
  return {
    items,
    collectionOnlyExotics,
    definitionByName,
    definitionCandidatesByName,
    abilityDefinitionCount: [...definitionCandidatesByName.values()].flat().filter((candidate) => candidate.kind).length,
    manifestItemByName,
    syncTimestamp: String(profile?.responseMintedTimestamp || new Date().toISOString()),
    warnings
  };
}

export function buildAdvisorRecommendations(
  inventory: NormalizedBuildAdvisorInventory,
  character: CharacterSummary,
  savedLoadoutCount = 0,
  templates: BuildAdvisorTemplate[] = BUILD_ADVISOR_TEMPLATES
): { recommendations: BuildAdvisorRecommendation[]; analysis: BuildAdvisorInventoryAnalysis } {
  const selectedClass = BUILD_CLASS[character.className];
  const evaluated = templates
    .filter((template) => template.enabled && template.classType === selectedClass)
    .map((template) => ({ template, validation: validateTemplateSubclass(template, inventory) }));
  const invalid = evaluated.filter(({ validation }) => validation.state === "validated" && validation.issues.length > 0);
  const scored = evaluated
    .filter(({ validation }) => validation.state === "unverified" || validation.issues.length === 0)
    .map(({ template, validation }) => scoreTemplate(template, inventory, character, validation))
    .sort((left, right) => right.recommendation.score - left.recommendation.score || left.recommendation.name.localeCompare(right.recommendation.name));
  const primary = scored.filter(({ recommendation }) => {
    if (recommendation.status === "not-viable") return false;
    if (recommendation.source.kind !== "published-build") return true;
    const physicalCoreOwned = "instanceId" in recommendation.coreExoticArmor;
    return physicalCoreOwned || recommendation.status !== "missing-several-core-items";
  });
  assignCategoryAwards(primary);

  const exoticArmorByClass: BuildAdvisorInventoryAnalysis["ownedExoticArmorByClass"] = {};
  for (const item of inventory.items.filter((entry) => entry.exotic && isArmor(entry))) {
    const className = item.className || item.ownerClassName || "Unknown";
    exoticArmorByClass[className] ||= [];
    exoticArmorByClass[className]!.push(item);
  }
  Object.values(exoticArmorByClass).forEach((items) => items?.sort(itemSort));
  const relevantLegendaryRolls = scored.flatMap((entry) => entry.recommendation.weapons)
    .filter((evaluation) => Boolean(evaluation.item && !evaluation.item.exotic))
    .filter((evaluation, index, all) => all.findIndex((candidate) => candidate.item?.instanceId === evaluation.item?.instanceId && candidate.requirementId === evaluation.requirementId) === index)
    .sort((left, right) => rollRank(right.quality) - rollRank(left.quality) || left.label.localeCompare(right.label));
  const missingHighImpactItems = [...new Set(scored.flatMap((entry) => entry.recommendation.missingItems))].slice(0, 12);

  return {
    recommendations: primary.map((entry) => entry.recommendation),
    analysis: {
      physicalItemCount: inventory.items.length,
      savedLoadoutCount,
      ownedExoticArmorByClass: exoticArmorByClass,
      ownedExoticWeapons: inventory.items.filter((entry) => entry.exotic && isWeapon(entry)).sort(itemSort),
      equippedExotics: inventory.items.filter((entry) => entry.exotic && entry.equipped).sort(itemSort),
      vaultExotics: inventory.items.filter((entry) => entry.exotic && entry.location === "vault").sort(itemSort),
      collectionOnlyExotics: inventory.collectionOnlyExotics,
      relevantLegendaryRolls,
      missingHighImpactItems,
      syncTimestamp: inventory.syncTimestamp,
      warnings: [
        ...inventory.warnings,
        ...invalid.map(({ template, validation }) => `${template.name} was omitted because its ${template.subclass} setup is incompatible: ${validation.issues.join("; ")}.`)
      ]
    }
  };
}

export function normalizeBuildAdvisorData(
  profile: any,
  companionManifest: CompanionManifest,
  collectionManifest: CompactManifest,
  characters: CharacterSummary[],
  character: CharacterSummary,
  now = Date.now(),
  gearManifest?: GearManifest,
  templates: BuildAdvisorTemplate[] = BUILD_ADVISOR_TEMPLATES
): BuildAdvisorData {
  const inventory = normalizeBuildAdvisorInventory(profile, companionManifest, collectionManifest, characters, gearManifest);
  const loadouts = profile?.characterLoadouts?.data?.[character.characterId]?.loadouts || [];
  const savedLoadoutCount = (loadouts as any[]).filter((loadout) => Array.isArray(loadout?.items) && loadout.items.length > 0).length;
  const result = buildAdvisorRecommendations(inventory, character, savedLoadoutCount, templates);
  const age = now - Date.parse(inventory.syncTimestamp);
  const state: BuildAdvisorData["state"] = inventory.warnings.some((warning) => /definitions are unavailable|physical inventory cannot/i.test(warning))
    ? "sync-required"
    : inventory.warnings.length
      ? "incomplete"
      : Number.isFinite(age) && age > STALE_AFTER_MS
        ? "may-be-stale"
        : "current";
  return {
    characterId: character.characterId,
    characterClass: character.className,
    characterPower: character.power,
    manifestVersion: companionManifest.version,
    templateSetVersion: BUILD_ADVISOR_TEMPLATE_SET_VERSION,
    templateReviewedAt: BUILD_ADVISOR_TEMPLATE_REVIEWED_AT,
    state,
    recommendations: result.recommendations,
    analysis: result.analysis
  };
}

function scoreTemplate(
  template: BuildAdvisorTemplate,
  inventory: NormalizedBuildAdvisorInventory,
  character: CharacterSummary,
  validation: ReturnType<typeof validateTemplateSubclass>
): ScoredTemplate {
  const matchingArmor = inventory.items
    .filter((item) => item.exotic && isArmor(item) && sameName(item.name, template.requiredExoticArmor))
    .filter((item) => !item.className || item.className === character.className)
    .sort((left, right) => armorCandidateScore(right, template) - armorCandidateScore(left, template)
      || right.power - left.power
      || itemEquipConvenience(right, character.characterId) - itemEquipConvenience(left, character.characterId)
      || left.instanceId.localeCompare(right.instanceId));
  const coreArmor = matchingArmor[0];
  const collectionArmor = inventory.collectionOnlyExotics.find((item) => sameName(item.name, template.requiredExoticArmor));
  const preferredExotic = template.preferredExoticWeapon
    ? inventory.items.filter((item) => item.exotic && isWeapon(item) && sameName(item.name, template.preferredExoticWeapon!)).sort((left, right) => right.power - left.power
      || itemEquipConvenience(right, character.characterId) - itemEquipConvenience(left, character.characterId)
      || left.instanceId.localeCompare(right.instanceId))[0]
    : undefined;
  const usedInstances = new Set<string>();
  const usedSlots = new Set<string>();
  let exoticWeaponUsed = false;
  const weapons = template.weapons.map((requirement) => {
    const evaluation = evaluateWeaponRequirement(requirement, inventory.items, character, usedInstances, usedSlots, exoticWeaponUsed);
    if (evaluation.item) {
      usedInstances.add(evaluation.item.instanceId);
      usedSlots.add(weaponBucket(evaluation.item));
      exoticWeaponUsed ||= evaluation.item.exotic;
    }
    return evaluation;
  });
  const armor = selectArmorLoadout(template, coreArmor, inventory.items, character);
  const ghostFocus = ghostFocusForTemplate(template, inventory);
  const missingItems = [
    ...(!coreArmor ? [template.requiredExoticArmor] : []),
    ...weapons.filter((weapon) => weapon.quality === "missing" || weapon.quality === "poor").map((weapon) => {
      const requirement = template.weapons.find((entry) => entry.id === weapon.requirementId);
      return requirement?.requiresExotic && template.preferredExoticWeapon ? template.preferredExoticWeapon : weapon.label;
    }),
    ...armor.filter((entry) => entry.quality === "missing").map((entry) => entry.label)
  ];
  const missingItemGuides = acquisitionGuides(template, coreArmor, collectionArmor, weapons, armor, ghostFocus, inventory, character);
  const substitutions = weapons
    .filter((weapon) => ["strong", "functional", "poor"].includes(weapon.substitution))
    .map((weapon) => `${weapon.label}: ${weapon.item?.name || "no usable item"}`);
  const status = assemblyStatus(Boolean(coreArmor), weapons);
  const coreScore = coreArmor ? 25 : collectionArmor ? 7 : 0;
  const armorScore = Math.round(armor.reduce((total, entry) => total + armorQualityFraction(entry.quality), 0) / ARMOR_SLOTS.length * 15);
  const weaponScore = Math.round(weapons.reduce((total, weapon) => total + qualityFraction(weapon.quality), 0) / Math.max(1, weapons.length) * 20);
  const rollScore = Math.round(weapons.reduce((total, weapon) => total + rollFraction(weapon.quality), 0) / Math.max(1, weapons.length) * 10);
  const utilityScore = Math.round((profileValue(template.survivability) + profileValue(template.addClear) + profileValue(template.abilityUptime)) / 9 * 15);
  const contextScore = Math.round((profileValue(template.solo) + profileValue(template.group) + (template.powerFriendly ? 3 : 1)) / 9 * 15);
  const readinessPoints = coreScore + armorScore + weaponScore + rollScore;
  const readinessScore = Math.max(0, Math.min(
    status === "missing-several-core-items" ? 59 : status === "not-viable" ? 0 : 100,
    Math.round(readinessPoints / 70 * 100)
  ));
  const viabilityScore = templateViabilityScore(template);
  const score = Math.round(viabilityScore * .45 + readinessScore * .55);
  const factors: BuildAdvisorScoreFactor[] = [
    factor("core", "Core exotic", coreScore, 25, coreArmor ? "Required exotic armor is a physical owned copy." : collectionArmor ? "Unlocked in Collections, but no physical copy was found." : "Required exotic armor was not found."),
    factor("armor-fit", "Armor loadout", armorScore, 15, armorSummary(armor)),
    factor("weapon-synergy", "Weapon synergy", weaponScore, 20, weaponSummary(weapons)),
    factor("owned-rolls", "Owned roll quality", rollScore, 10, rollSummary(weapons)),
    factor("combat-profile", "Combat profile", utilityScore, 15, `Survivability ${template.survivability}; add clear ${template.addClear}; ability uptime ${template.abilityUptime}.`),
    factor("activity-fit", "Activity fit", contextScore, 15, `Solo ${template.solo}; group ${template.group}; Power friendliness ${template.powerFriendly ? "high" : "medium"}.`)
  ];
  const notes = recommendationNotes(template, character, coreArmor, collectionArmor, preferredExotic, weapons, status, inventory.items);
  const reason = recommendationReason(template, status, weapons);
  const build = buildDocumentFromRecommendation(template, armor, weapons, ghostFocus, notes, inventory);
  const selectedExoticWeapon = weapons.find((weapon) => weapon.item?.exotic)?.item;
  const recommendation: BuildAdvisorRecommendation = {
    id: `advisor:${template.id}`,
    templateId: template.id,
    templateVersion: template.version,
    reviewedAt: template.reviewedAt,
    release: template.release,
    name: template.name,
    classType: template.classType,
    subclass: template.subclass,
    score,
    viabilityScore,
    readinessScore,
    status,
    categories: [],
    focuses: focusesForTemplate(template),
    coreExoticArmor: coreArmor || collectionArmor || {
      itemHash: "",
      name: template.requiredExoticArmor,
      icon: "",
      itemType: "Exotic Armor",
      className: character.className
    },
    ...(selectedExoticWeapon ? { exoticWeapon: selectedExoticWeapon } : {}),
    weapons,
    armor,
    ghostFocus,
    missingItems,
    missingItemGuides,
    substitutions,
    activities: template.activities,
    style: template.style,
    damageProfile: template.damageProfile,
    survivability: template.survivability,
    complexity: template.complexity,
    artifactDependency: template.artifactDependency,
    powerFriendly: template.powerFriendly,
    reason,
    gameplayLoop: template.gameplayLoop,
    damageRotation: template.damageRotation,
    limitations: template.weaknesses,
    upgrades: template.upgrades,
    notes,
    factors,
    source: template.source || {
      kind: "curated-template",
      label: "Guardian Nexus reviewed template"
    },
    verification: template.verification || (template.source?.kind === "published-build"
      ? {
          state: "current-community",
          sandbox: template.release,
          verifiedAt: template.reviewedAt,
          sources: []
        }
      : BUILD_ADVISOR_CURATED_VERIFICATION),
    subclassValidation: {
      state: validation.state,
      checkedCount: validation.checkedCount,
      message: validation.state === "validated"
        ? `${validation.checkedCount} subclass selections matched Bungie's ${template.classType} ${template.subclass} definitions.`
        : "Subclass definitions could not be checked against the current Bungie manifest."
    },
    equipPlan: equipPlanForSelection(armor, weapons, character.characterId, Boolean(coreArmor)),
    build
  };
  const equippedMatchCount = armor.filter((entry) => entry.item?.equipped).length + weapons.filter((weapon) => weapon.item?.equipped).length;
  return { recommendation, template, equippedMatchCount };
}

function templateViabilityScore(template: BuildAdvisorTemplate): number {
  const profiles = [
    template.damageProfile,
    template.bossDamage,
    template.addClear,
    template.survivability,
    template.abilityUptime,
    template.solo,
    template.group
  ];
  return Math.round(profiles.reduce((total, profile) => total + profileValue(profile), 0) / (profiles.length * 3) * 100);
}

function acquisitionGuides(
  template: BuildAdvisorTemplate,
  coreArmor: BuildAdvisorOwnedItem | undefined,
  collectionArmor: BuildAdvisorCollectionItem | undefined,
  weapons: BuildAdvisorWeaponEvaluation[],
  armor: BuildAdvisorArmorEvaluation[],
  ghostFocus: BuildGhostFocus,
  inventory: NormalizedBuildAdvisorInventory,
  character: CharacterSummary
): BuildAdvisorMissingItemGuide[] {
  const guides: BuildAdvisorMissingItemGuide[] = [];
  if (!coreArmor) {
    guides.push(specificItemGuide(template.requiredExoticArmor, "Exotic Armor", Boolean(collectionArmor), inventory));
  }
  for (const evaluation of weapons.filter((entry) => entry.quality === "missing" || entry.quality === "poor")) {
    const requirement = template.weapons.find((entry) => entry.id === evaluation.requirementId);
    if (!requirement) continue;
    const specificName = requirement.requiresExotic
      ? template.preferredExoticWeapon || requirement.preferredNames?.[0]
      : template.source?.kind === "published-build"
        ? requirement.preferredNames?.[0]
        : undefined;
    if (specificName) {
      const collectionUnlocked = inventory.collectionOnlyExotics.some((item) => sameName(item.name, specificName));
      guides.push(specificItemGuide(specificName, requirement.requiresExotic ? "Exotic Weapon" : "Weapon", collectionUnlocked, inventory));
    } else {
      guides.push(weaponRoleGuide(requirement, evaluation));
    }
  }
  for (const entry of armor.filter((item) => item.quality === "missing")) {
    guides.push(armorSlotGuide(entry, ghostFocus, character));
  }
  return [...new Map(guides.map((guide) => [guide.id, guide])).values()];
}

function specificItemGuide(
  name: string,
  fallbackItemType: string,
  collectionUnlocked: boolean,
  inventory: NormalizedBuildAdvisorInventory
): BuildAdvisorMissingItemGuide {
  const item = inventory.manifestItemByName.get(normalizeName(name));
  const publishedSource = cleanAcquisitionSource(item?.source || "");
  const acquisition = collectionUnlocked
    ? "Unlocked in Collections; no physical copy was found."
    : publishedSource || "No specific acquisition source is published in the current Bungie manifest.";
  const steps = [
    ...(collectionUnlocked
      ? [`Open Collections → Exotics and use Reacquire for ${name} if the action is available.`]
      : []),
    ...sourceSteps(name, publishedSource),
    "Refresh Build Advisor after the item reaches a character inventory or the Vault."
  ];
  return {
    id: `item:${normalizeName(name).replace(/\s+/g, "-")}`,
    name,
    kind: "specific-item",
    ...(item?.itemHash ? { itemHash: item.itemHash } : {}),
    ...(item?.icon ? { icon: imageUrl(item.icon) } : {}),
    itemType: item?.itemType || fallbackItemType,
    acquisition,
    source: collectionUnlocked ? "collections" : "bungie-manifest",
    steps
  };
}

function weaponRoleGuide(
  requirement: BuildAdvisorWeaponRequirement,
  evaluation: BuildAdvisorWeaponEvaluation
): BuildAdvisorMissingItemGuide {
  const slots = formatChoices(requirement.slots);
  const archetypes = formatChoices(requirement.archetypes);
  const requiredPerks = formatChoices(requirement.requiredPerks);
  const preferredPerks = formatChoices(requirement.preferredPerks);
  const acceptablePerks = formatChoices(requirement.acceptablePerks);
  const target = [slots, archetypes].filter(Boolean).join(" · ");
  const steps = [
    target ? `Target ${target}.` : `Target a weapon that fills the ${requirement.label.toLocaleLowerCase()} role.`,
    requiredPerks ? `Required perk: ${requiredPerks}.` : "",
    preferredPerks ? `Best perk targets: ${preferredPerks}.` : "",
    acceptablePerks ? `Usable fallback perks: ${acceptablePerks}.` : "",
    evaluation.item ? `Keep ${evaluation.item.name} as a temporary substitute while pursuing a better roll.` : "",
    "Use the in-game Collections source or the current activity/vendor loot preview to choose a farm, then refresh Build Advisor when a matching roll drops."
  ].filter(Boolean);
  return {
    id: `weapon-role:${requirement.id}`,
    name: evaluation.quality === "poor" ? `${requirement.label} upgrade` : requirement.label,
    kind: "weapon-role",
    itemType: archetypes || "Weapon",
    acquisition: evaluation.quality === "poor"
      ? "A usable weapon exists, but its roll misses this build's important perks."
      : "No owned weapon matches this loadout requirement.",
    source: "loadout-requirement",
    steps
  };
}

function armorSlotGuide(
  armor: BuildAdvisorArmorEvaluation,
  ghostFocus: BuildGhostFocus,
  character: CharacterSummary
): BuildAdvisorMissingItemGuide {
  return {
    id: `armor-slot:${armor.slot}`,
    name: armor.label,
    kind: "armor-slot",
    itemType: armor.label,
    acquisition: `No equippable ${character.className} ${armor.label.toLocaleLowerCase()} was found on the account.`,
    source: "loadout-requirement",
    steps: [
      `Equip ${ghostFocus.mod.name} on the Ghost before earning armor.`,
      `Earn a ${character.className} ${armor.label.toLocaleLowerCase()} from a current armor reward, engram, or vendor.`,
      `Prefer rolls that support ${ghostFocus.primaryStat}, then ${ghostFocus.secondaryStat}.`,
      "Refresh Build Advisor after the armor reaches a character inventory or the Vault."
    ]
  };
}

function sourceSteps(name: string, source: string): string[] {
  if (!source) {
    return [`Open ${name} in the in-game Collections screen and check its current source and account-specific requirements.`];
  }
  if (/exotic armor focusing/i.test(source)) {
    return [`Use the current Exotic Armor Focusing screen and select ${name} when its focusing requirements are met.`];
  }
  if (/exotic archive/i.test(source)) {
    return [`Visit the Exotic Archive in the Tower and find ${name} in its matching category.`];
  }
  if (/season pass|rewards pass/i.test(source)) {
    return [
      `Check the current Rewards Pass for ${name}.`,
      "If the pass that originally awarded it has expired, check the Exotic Archive in the Tower."
    ];
  }
  if (/exotic engrams|world drops/i.test(source)) {
    return [`Earn Exotic Engrams, then use the current decryption or focusing options when ${name} is eligible.`];
  }
  if (/xûr|xur/i.test(source)) {
    return [`Check Xûr's current inventory when he is available.`];
  }
  if (/raid|dungeon/i.test(source)) {
    return [`Run ${source}; check that activity's current Exotic drop rules and any available drop-rate boosts.`];
  }
  if (/quest|mission|campaign|lost sector|exploring|activities|equilibrium|fortress|renegades/i.test(source)) {
    return [`Complete ${source} and claim its associated reward.`];
  }
  return [`Follow the in-game Collections source: ${source}.`];
}

function cleanAcquisitionSource(source: string): string {
  return source.trim().replace(/^source:\s*/i, "").replace(/\.$/, "");
}

function formatChoices(values?: string[]): string {
  return (values || []).filter(Boolean).join(" / ");
}

function evaluateWeaponRequirement(
  requirement: BuildAdvisorWeaponRequirement,
  items: BuildAdvisorOwnedItem[],
  character: CharacterSummary,
  usedInstances: Set<string>,
  usedSlots: Set<string>,
  exoticWeaponUsed: boolean
): BuildAdvisorWeaponEvaluation {
  const candidates = items
    .filter(isWeapon)
    .filter((item) => !usedInstances.has(item.instanceId))
    .filter((item) => !usedSlots.has(weaponBucket(item)))
    .filter((item) => requirement.requiresExotic ? item.exotic : !item.exotic)
    .filter((item) => !item.exotic || !exoticWeaponUsed)
    .filter((item) => weaponIdentityMatches(item, requirement))
    .map((item) => ({ item, evaluation: evaluateRoll(item, requirement) }))
    .sort((left, right) => rollRank(right.evaluation.quality) - rollRank(left.evaluation.quality)
      || right.evaluation.matchedPerks.length - left.evaluation.matchedPerks.length
      || left.evaluation.missingPerks.length - right.evaluation.missingPerks.length
      || right.item.enhancedPerks.length - left.item.enhancedPerks.length
      || right.item.power - left.item.power
      || left.item.name.localeCompare(right.item.name)
      || itemEquipConvenience(right.item, character.characterId) - itemEquipConvenience(left.item, character.characterId)
      || left.item.instanceId.localeCompare(right.item.instanceId));
  const best = candidates[0];
  if (!best) return {
    requirementId: requirement.id,
    label: requirement.label,
    quality: "missing",
    substitution: "missing",
    matchedPerks: [],
    missingPerks: [...(requirement.requiredPerks || []), ...(requirement.preferredPerks || [])],
    notes: [`No owned weapon matched the ${requirement.label.toLocaleLowerCase()} requirement.`]
  };
  return best.evaluation;
}

function evaluateRoll(item: BuildAdvisorOwnedItem, requirement: BuildAdvisorWeaponRequirement): BuildAdvisorWeaponEvaluation {
  const perkNames = [...item.perks, ...item.selectablePerks].map((perk) => normalizeName(perk.name));
  const required = requirement.requiredPerks || [];
  const preferred = requirement.preferredPerks || [];
  const acceptable = requirement.acceptablePerks || [];
  const matchedRequired = required.filter((perk) => hasPerk(perkNames, perk));
  const matchedPreferred = preferred.filter((perk) => hasPerk(perkNames, perk));
  const matchedAcceptable = acceptable.filter((perk) => hasPerk(perkNames, perk));
  const exactName = requirement.preferredNames?.some((name) => sameName(name, item.name)) || false;
  let quality: BuildAdvisorRollQuality;
  if (item.exotic && exactName) quality = "perfect";
  else if (item.rollDataState === "unknown" && (required.length || preferred.length || acceptable.length)) quality = "unknown";
  else if (required.length && matchedRequired.length < required.length) quality = matchedAcceptable.length ? "functional" : "poor";
  else if (preferred.length && matchedPreferred.length === preferred.length) quality = "perfect";
  else if (matchedRequired.length === required.length && (matchedPreferred.length || !preferred.length)) quality = "strong";
  else if (matchedAcceptable.length || matchedRequired.length) quality = "functional";
  else if (required.length || preferred.length || acceptable.length) quality = "poor";
  else quality = "strong";
  const substitution = quality === "perfect" && exactName ? "exact"
    : quality === "perfect" || quality === "strong" ? "strong"
      : quality === "functional" || quality === "unknown" ? "functional"
        : "poor";
  const missingPerks = required.filter((perk) => !hasPerk(perkNames, perk));
  const notes = [
    item.rollDataState === "unknown" ? "Bungie did not provide socket data for this instance; its roll is unknown." : "",
    item.crafted ? `${item.name} is crafted${item.enhancedPerks.length ? ` with ${item.enhancedPerks.join(", ")}` : ""}.` : "",
    item.location === "vault" ? `${item.name} is in the Vault.` : "",
    item.ownerClassName && item.ownerCharacterId !== undefined && item.ownerClassName !== "Unknown" && item.location !== "vault" ? `${item.name} is on the ${item.ownerClassName}.` : "",
    missingPerks.length ? `Missing required perk: ${missingPerks.join(", ")}.` : ""
  ].filter(Boolean);
  return {
    requirementId: requirement.id,
    label: requirement.label,
    item,
    quality,
    substitution,
    matchedPerks: [...matchedRequired, ...matchedPreferred, ...matchedAcceptable],
    missingPerks,
    notes
  };
}

function buildDocumentFromRecommendation(
  template: BuildAdvisorTemplate,
  armor: BuildAdvisorArmorEvaluation[],
  weapons: BuildAdvisorWeaponEvaluation[],
  ghostFocus: BuildGhostFocus,
  notes: string[],
  inventory: NormalizedBuildAdvisorInventory
): BuildDocument {
  const resolved = (value: string, required = false, kind?: AdvisorAbilityKind) => resolveNamed(value, inventory, required, template.classType, template.subclass, kind);
  const document: BuildDocument = {
    title: template.name,
    originalCreatorName: template.source?.authorDisplayName || "Guardian Nexus Build Advisor",
    classType: template.classType,
    classIcon: `/icons/destiny/class-${template.classType}.svg`,
    subclass: template.subclass,
    tags: ["Build Advisor", template.classType, template.subclass],
    activityTags: template.activities,
    summary: template.summary,
    notes: [...notes, "", `Strengths: ${template.strengths.join("; ")}.`, `Limitations: ${template.weaknesses.join("; ")}.`].join("\n"),
    concepts: [named(template.role), named(template.style)],
    championCounters: [],
    links: [],
    subclassConfig: {
      super: resolved(template.abilities.super, true, "super"),
      classAbility: resolved(template.abilities.classAbility, true, "classAbility"),
      movement: resolved(template.abilities.movement, true, "movement"),
      melee: resolved(template.abilities.melee, true, "melee"),
      grenade: resolved(template.abilities.grenade, true, "grenade"),
      ...(template.subclass === "prismatic" ? { transcendence: resolved("Transcendence", true, "transcendence") } : {}),
      aspects: template.abilities.aspects.map((entry) => resolved(entry, true, "aspect")),
      fragments: template.abilities.fragments.map((entry) => resolved(entry, true, "fragment"))
    },
    equipment: {
      weapons: weapons.flatMap((weapon) => weapon.item ? [equipmentEntry(weapon.item, weapon)] : []),
      armor: armor.flatMap((entry) => entry.item ? [equipmentEntry(entry.item)] : []),
      armorSets: []
    },
    statPriorities: template.statPriorities,
    ghostFocus,
    armorMods: {
      helmet: (template.armorMods.helmet || []).map((entry) => resolved(entry)),
      arms: (template.armorMods.arms || []).map((entry) => resolved(entry)),
      chest: (template.armorMods.chest || []).map((entry) => resolved(entry)),
      legs: (template.armorMods.legs || []).map((entry) => resolved(entry)),
      classItem: (template.armorMods.classItem || []).map((entry) => resolved(entry))
    },
    artifacts: [],
    gameplayLoop: template.gameplayLoop.map((text) => ({ text })),
    cosmetics: { ornaments: [] },
    patch: template.release,
    outdated: false,
    changelog: [],
    status: "draft",
    visibility: "private"
  };
  return buildDocumentSchema.parse(document);
}

function equipmentEntry(item: BuildAdvisorOwnedItem, evaluation?: BuildAdvisorWeaponEvaluation): BuildEquipmentEntry {
  return {
    name: item.name,
    hash: item.itemHash,
    ...(item.icon ? { icon: item.icon } : {}),
    itemType: item.itemType,
    rarity: item.rarity,
    ...(item.damageType ? { damageType: item.damageType } : {}),
    slot: item.slot || item.itemType,
    exotic: item.exotic,
    ...(item.exotic ? { required: true } : {}),
    selectedPerks: item.perks.slice(0, 10),
    ...(evaluation ? { perks: `${evaluation.quality} owned roll${evaluation.matchedPerks.length ? ` · ${evaluation.matchedPerks.join(", ")}` : ""}` } : {})
  };
}

function resolveNamed(
  value: string,
  inventory: NormalizedBuildAdvisorInventory,
  required = false,
  classType?: BuildGuardianClass,
  subclass?: BuildAdvisorTemplate["subclass"],
  kind?: AdvisorAbilityKind
): BuildNamedEntry {
  const candidates = inventory.definitionCandidatesByName.get(normalizeName(value)) || [];
  const resolved = classType && subclass && kind
    ? candidates.find((candidate) => compatibleAbility(candidate, classType, subclass, kind))?.entry
    : inventory.definitionByName.get(normalizeName(value));
  return { ...(resolved || named(value)), name: value, ...(required ? { required: true } : {}) };
}

function validateTemplateSubclass(template: BuildAdvisorTemplate, inventory: NormalizedBuildAdvisorInventory): TemplateSubclassValidation {
  if (inventory.abilityDefinitionCount === 0) {
    return {
      state: "unverified",
      checkedCount: 0,
      issues: [],
      message: "Subclass definitions could not be checked against the current Bungie manifest."
    };
  }
  const selections: Array<{ name: string; kind: AdvisorAbilityKind }> = [
    { name: template.abilities.super, kind: "super" },
    { name: template.abilities.classAbility, kind: "classAbility" },
    { name: template.abilities.movement, kind: "movement" },
    { name: template.abilities.melee, kind: "melee" },
    { name: template.abilities.grenade, kind: "grenade" },
    ...template.abilities.aspects.map((name) => ({ name, kind: "aspect" as const })),
    ...template.abilities.fragments.map((name) => ({ name, kind: "fragment" as const })),
    ...(template.subclass === "prismatic" ? [{ name: "Transcendence", kind: "transcendence" as const }] : [])
  ];
  const issues = selections.flatMap(({ name, kind }) => {
    const candidates = inventory.definitionCandidatesByName.get(normalizeName(name)) || [];
    return candidates.some((candidate) => compatibleAbility(candidate, template.classType, template.subclass, kind))
      ? []
      : [`${kindLabel(kind)} “${name}”`];
  });
  if (template.abilities.aspects.length !== 2) issues.push(`aspect count ${template.abilities.aspects.length}; expected 2`);
  if (new Set(template.abilities.aspects.map(normalizeName)).size !== template.abilities.aspects.length) issues.push("duplicate aspects");
  if (new Set(template.abilities.fragments.map(normalizeName)).size !== template.abilities.fragments.length) issues.push("duplicate fragments");
  return {
    state: "validated",
    checkedCount: selections.length,
    issues,
    message: issues.length
      ? `${issues.length} subclass selections do not match the chosen class and subclass.`
      : `${selections.length} subclass selections matched Bungie's definitions.`
  };
}

function abilityCompatibility(definition: any): Omit<AdvisorDefinitionCandidate, "entry"> {
  const category = String(definition?.plug?.plugCategoryIdentifier || "").toLocaleLowerCase();
  const [owner, element, rawKind] = category.split(".");
  const classType = owner === "hunter" || owner === "titan" || owner === "warlock" ? owner : undefined;
  const subclass = element === "prism"
    ? "prismatic"
    : element === "arc" || element === "solar" || element === "void" || element === "strand" || element === "stasis"
      ? element
      : undefined;
  const kinds: Record<string, AdvisorAbilityKind | undefined> = {
    supers: "super",
    class_abilities: "classAbility",
    movement: "movement",
    melee: "melee",
    grenades: "grenade",
    transcendence: "transcendence",
    aspects: "aspect",
    totems: "aspect",
    fragments: "fragment",
    trinkets: "fragment"
  };
  const kind = kinds[rawKind || ""];
  return {
    ...(classType ? { classType } : {}),
    ...(subclass ? { subclass } : {}),
    ...(kind ? { kind } : {})
  };
}

function compatibleAbility(
  candidate: AdvisorDefinitionCandidate,
  classType: BuildGuardianClass,
  subclass: BuildAdvisorTemplate["subclass"],
  kind: AdvisorAbilityKind
): boolean {
  return candidate.kind === kind
    && candidate.subclass === subclass
    && (!candidate.classType || candidate.classType === classType);
}

function kindLabel(kind: AdvisorAbilityKind): string {
  return kind === "classAbility" ? "class ability" : kind;
}

function definitionPreference(entry: BuildNamedEntry, compatibility: Omit<AdvisorDefinitionCandidate, "entry"> = {}): number {
  return (compatibility.kind ? 100 : 0)
    + (entry.icon ? 5 : 0)
    + (entry.description ? 2 : 0)
    - (/deprecated|legacy/i.test(entry.description || "") ? 20 : 0);
}

function ghostFocusForTemplate(template: BuildAdvisorTemplate, inventory: NormalizedBuildAdvisorInventory): BuildGhostFocus {
  return {
    mod: resolveNamed(`${template.ghostFocus.archetype} Armorer`, inventory, true),
    primaryStat: template.ghostFocus.primaryStat,
    secondaryStat: template.ghostFocus.secondaryStat,
    notes: template.ghostFocus.notes
  };
}

function selectArmorLoadout(
  template: BuildAdvisorTemplate,
  coreArmor: BuildAdvisorOwnedItem | undefined,
  items: BuildAdvisorOwnedItem[],
  character: CharacterSummary
): BuildAdvisorArmorEvaluation[] {
  const used = new Set<string>();
  return ARMOR_SLOTS.map((slot) => {
    const coreSlot = coreArmor ? armorSlot(coreArmor) : undefined;
    const candidates = items
      .filter(isArmor)
      .filter((item) => armorSlot(item) === slot)
      .filter((item) => !item.className || item.className === character.className)
      .filter((item) => !item.exotic)
      .filter((item) => !used.has(item.instanceId))
      .sort((left, right) => armorCandidateScore(right, template) - armorCandidateScore(left, template)
        || right.power - left.power
        || itemEquipConvenience(right, character.characterId) - itemEquipConvenience(left, character.characterId)
        || left.name.localeCompare(right.name));
    const selected = coreArmor && coreSlot === slot ? coreArmor : candidates[0];
    if (!selected) {
      return {
        slot,
        label: ARMOR_SLOT_LABELS[slot],
        score: 0,
        quality: "missing",
        notes: [`No owned ${ARMOR_SLOT_LABELS[slot].toLocaleLowerCase()} matched this character.`]
      };
    }
    used.add(selected.instanceId);
    const exactArchetype = sameName(selected.armorArchetype?.name || "", template.ghostFocus.archetype);
    const score = coreArmor?.instanceId === selected.instanceId ? 100 : Math.max(1, Math.min(99, Math.round(armorCandidateScore(selected, template))));
    const quality: BuildAdvisorArmorEvaluation["quality"] = coreArmor?.instanceId === selected.instanceId || exactArchetype && Boolean(selected.armorStats)
      ? "excellent"
      : selected.armorStats
        ? "strong"
        : "functional";
    const topStats = Object.entries(selected.armorStats || {})
      .sort((left, right) => Number(right[1]) - Number(left[1]))
      .slice(0, 2)
      .map(([stat, amount]) => `${stat} ${amount}`);
    return {
      slot,
      label: ARMOR_SLOT_LABELS[slot],
      item: selected,
      score,
      quality,
      notes: [
        coreArmor?.instanceId === selected.instanceId ? "Required exotic armor." : "",
        selected.armorArchetype ? `${selected.armorArchetype.name} archetype${exactArchetype ? " matches the recommended Ghost focus" : ""}.` : "",
        topStats.length ? `Highest current stats: ${topStats.join(", ")}.` : "Armor stats were unavailable; selected by Power.",
        selected.location === "vault" ? `${selected.name} is in the Vault.` : "",
        selected.ownerCharacterId && selected.ownerCharacterId !== character.characterId && selected.ownerClassName ? `${selected.name} is on the ${selected.ownerClassName}.` : ""
      ].filter(Boolean)
    };
  });
}

function armorCandidateScore(item: BuildAdvisorOwnedItem, template: BuildAdvisorTemplate): number {
  const weightedStats = template.statPriorities.reduce((total, priority) => {
    const weight = 7 - priority.priority;
    return total + Number(item.armorStats?.[priority.stat] || 0) * weight;
  }, 0);
  const statFit = weightedStats / 35;
  const totalFit = Number(item.armorBaseTotal || item.armorCurrentTotal || 0) / 12;
  const archetypeFit = sameName(item.armorArchetype?.name || "", template.ghostFocus.archetype) ? 18 : 0;
  const tuningFit = template.statPriorities.some((priority) => priority.priority <= 2 && priority.stat === item.tunedStat) ? 6 : 0;
  const masterworkFit = item.masterworked ? 3 : 0;
  return statFit + totalFit + archetypeFit + tuningFit + masterworkFit;
}

function armorSlot(item: BuildAdvisorOwnedItem): (typeof ARMOR_SLOTS)[number] | undefined {
  const value = normalizeName(`${item.slot} ${item.itemType}`);
  if (/helmet/.test(value)) return "helmet";
  if (/gauntlet|arms/.test(value)) return "arms";
  if (/chest/.test(value)) return "chest";
  if (/leg armor|boots/.test(value)) return "legs";
  if (/class armor|cloak|mark|bond/.test(value)) return "classItem";
  return undefined;
}

function weaponBucket(item: BuildAdvisorOwnedItem): string {
  const value = normalizeName(item.slot);
  if (value.includes("kinetic")) return "kinetic";
  if (value.includes("energy")) return "energy";
  if (value.includes("power") || value.includes("heavy")) return "power";
  return `unknown:${item.instanceId}`;
}

function recommendationNotes(
  template: BuildAdvisorTemplate,
  character: CharacterSummary,
  coreArmor: BuildAdvisorOwnedItem | undefined,
  collectionArmor: BuildAdvisorCollectionItem | undefined,
  preferredExotic: BuildAdvisorOwnedItem | undefined,
  weapons: BuildAdvisorWeaponEvaluation[],
  status: BuildAdvisorAssemblyStatus,
  allItems: BuildAdvisorOwnedItem[]
): string[] {
  const notes: string[] = [];
  if (status === "fully-assembleable") notes.push("All core pieces were found as physical owned items.");
  if (status === "assembleable-with-substitutions") notes.push("The core build is functional now, with owned substitutions or unverified rolls.");
  if (!coreArmor && collectionArmor) notes.push(`${template.requiredExoticArmor} is unlocked in Collections, but no physical copy was found.`);
  else if (!coreArmor) notes.push(`No physical copy of ${template.requiredExoticArmor} was found.`);
  if (coreArmor?.location === "vault") notes.push(`${coreArmor.name} is in the Vault.`);
  if (coreArmor?.ownerClassName && coreArmor.ownerCharacterId !== character.characterId && coreArmor.location !== "vault") notes.push(`${coreArmor.name} is on the ${coreArmor.ownerClassName}.`);
  if (preferredExotic?.location === "vault") notes.push(`${preferredExotic.name} is available in the Vault.`);
  for (const weapon of weapons) {
    notes.push(...weapon.notes);
    if (weapon.item && weapon.item.power > 0 && character.power - weapon.item.power >= PRIMARY_STAT_POWER_FLOOR) notes.push(`${weapon.item.name} is mechanically useful but may need infusion from ${weapon.item.power} toward ${character.power} Power.`);
    if (weapon.item) {
      const higherPowerCopy = allItems.filter((item) => sameName(item.name, weapon.item!.name) && item.power > weapon.item!.power).sort((a, b) => b.power - a.power)[0];
      if (higherPowerCopy) notes.push(`A higher-Power ${higherPowerCopy.power} copy of ${weapon.item.name} is ${itemLocationPhrase(higherPowerCopy)}; the recommended copy has the stronger matching roll.`);
    }
  }
  if (template.powerFriendly) notes.push("This build remains useful while Power is still increasing.");
  if (template.artifactDependency === "none" || template.artifactDependency === "low") notes.push("This build does not require a seasonal Artifact perk.");
  if (template.artifactDependency === "high") notes.push("This build depends heavily on the current Artifact and may lose value after the episode.");
  return [...new Set(notes)];
}

function recommendationReason(template: BuildAdvisorTemplate, status: BuildAdvisorAssemblyStatus, weapons: BuildAdvisorWeaponEvaluation[]): string {
  if (status === "fully-assembleable" && template.bossDamage === "high") return "This is a complete boss-damage setup assembled from owned gear.";
  if (status === "fully-assembleable" && template.addClear === "high") return "This is a complete owned setup with strong add clear and a coherent gameplay loop.";
  const weakHeavy = weapons.find((weapon) => /heavy/i.test(weapon.label) && !["perfect", "strong"].includes(weapon.quality));
  if (weakHeavy) return `The core build is available, but the owned ${weakHeavy.label.toLocaleLowerCase()} lowers its damage ceiling.`;
  if (status === "assembleable-with-substitutions") return "The core exotic is owned and the available weapons produce a functional substituted version.";
  return `This build is close, but ${template.requiredExoticArmor} or one important weapon role is still missing.`;
}

function assignCategoryAwards(scored: ScoredTemplate[]): void {
  if (!scored.length) return;
  const awards: Array<[BuildAdvisorCategory, (entry: ScoredTemplate) => number]> = [
    ["Best Overall", (entry) => entry.recommendation.score],
    ["Best Boss Damage", (entry) => profileValue(entry.template.bossDamage) * 20 + entry.recommendation.score],
    ["Best General PvE", (entry) => profileValue(entry.template.addClear) * 10 + profileValue(entry.template.survivability) * 10 + entry.recommendation.score],
    ["Best Solo / Survivability", (entry) => profileValue(entry.template.solo) * 15 + profileValue(entry.template.survivability) * 15 + entry.recommendation.score],
    ["Best Add Clear", (entry) => profileValue(entry.template.addClear) * 25 + entry.recommendation.score],
    ["Best Build While Increasing Power", (entry) => (entry.template.powerFriendly ? 60 : 0) + entry.recommendation.score],
    ["Easiest Strong Build to Assemble", (entry) => (entry.template.complexity === "low" ? 35 : entry.template.complexity === "medium" ? 15 : 0) + (entry.template.difficultExecution ? 0 : 15) + entry.recommendation.score],
    ["Best Build With Current Equipped Gear", (entry) => entry.equippedMatchCount * 35 + entry.recommendation.score]
  ];
  for (const [category, scorer] of awards) {
    const eligible = scored.filter((entry) => {
      if (category === "Best Build While Increasing Power") return entry.template.powerFriendly;
      if (category === "Best Build With Current Equipped Gear") return entry.equippedMatchCount > 0;
      return true;
    });
    if (!eligible.length) continue;
    const winner = [...eligible].sort((left, right) => scorer(right) - scorer(left) || right.recommendation.score - left.recommendation.score || left.recommendation.name.localeCompare(right.recommendation.name))[0];
    if (winner && !winner.recommendation.categories.includes(category)) winner.recommendation.categories.push(category);
  }
}

function assemblyStatus(coreOwned: boolean, weapons: BuildAdvisorWeaponEvaluation[]): BuildAdvisorAssemblyStatus {
  const poorOrMissing = weapons.filter((weapon) => weapon.quality === "poor" || weapon.quality === "missing").length;
  if (coreOwned && poorOrMissing === 0 && weapons.every((weapon) => weapon.quality === "perfect" || weapon.quality === "strong")) return "fully-assembleable";
  if (coreOwned && poorOrMissing === 0) return "assembleable-with-substitutions";
  const coreMissing = coreOwned ? 0 : 1;
  if (coreMissing + poorOrMissing === 1) return "missing-one-important-item";
  if (coreMissing + poorOrMissing > 1) return "missing-several-core-items";
  return "not-viable";
}

export function buildAdvisorRecommendationItems(recommendation: BuildAdvisorRecommendation): BuildAdvisorOwnedItem[] {
  return [...recommendation.armor.flatMap((entry) => entry.item ? [entry.item] : []), ...recommendation.weapons.flatMap((entry) => entry.item ? [entry.item] : [])]
    .filter((item, index, all) => all.findIndex((candidate) => candidate.instanceId === item.instanceId) === index);
}

function equipPlanForSelection(
  armor: BuildAdvisorArmorEvaluation[],
  weapons: BuildAdvisorWeaponEvaluation[],
  characterId: string,
  coreExoticOwned: boolean
): BuildAdvisorEquipPlan {
  const items = [
    ...armor.flatMap((entry) => entry.item ? [entry.item] : []),
    ...weapons.flatMap((entry) => entry.item ? [entry.item] : [])
  ].filter((item, index, all) => all.findIndex((candidate) => candidate.instanceId === item.instanceId) === index);
  const blockers: string[] = [];
  if (!coreExoticOwned) blockers.push("The required exotic armor is not a physical owned item.");
  const missingArmor = armor.filter((entry) => !entry.item).map((entry) => entry.label);
  const missingWeapons = weapons.filter((entry) => !entry.item).map((entry) => entry.label);
  if (missingArmor.length) blockers.push(`Missing armor: ${missingArmor.join(", ")}.`);
  if (missingWeapons.length) blockers.push(`Missing weapons: ${missingWeapons.join(", ")}.`);
  for (const item of items) {
    if (item.equipped && item.ownerCharacterId && item.ownerCharacterId !== characterId) {
      blockers.push(`${item.name} is equipped on another character.`);
    } else if (item.ownerCharacterId !== characterId && item.location !== "equipped" && item.transferable === false) {
      blockers.push(`${item.name} cannot be transferred by Bungie.`);
    }
  }
  if (items.length !== 8 && !missingArmor.length && !missingWeapons.length) blockers.push("The selected gear does not contain five unique armor pieces and three unique weapons.");
  const equippedCount = items.filter((item) => item.equipped && item.ownerCharacterId === characterId).length;
  const transferCount = items.filter((item) => item.location === "vault" || item.ownerCharacterId && item.ownerCharacterId !== characterId).length;
  const complete = items.length === 8 && blockers.length === 0;
  const alreadyEquipped = complete && equippedCount === items.length;
  return {
    state: alreadyEquipped ? "already-equipped" : complete ? "ready" : blockers.some((blocker) => /equipped on another|cannot be transferred/i.test(blocker)) ? "blocked" : "partial",
    canEquip: complete && !alreadyEquipped,
    itemCount: items.length,
    transferCount,
    equippedCount,
    blockers
  };
}

function weaponIdentityMatches(item: BuildAdvisorOwnedItem, requirement: BuildAdvisorWeaponRequirement): boolean {
  const preferredName = requirement.preferredNames?.some((name) => sameName(name, item.name)) || false;
  if (preferredName) return true;
  if (requirement.requiresExotic && requirement.preferredNames?.length) return false;
  if (requirement.slots?.length && !requirement.slots.some((slot) => sameName(slot, item.slot))) return false;
  if (requirement.archetypes?.length && !requirement.archetypes.some((type) => sameName(type, item.itemType))) return false;
  if (requirement.damageTypes?.length && !requirement.damageTypes.some((type) => sameName(type, item.damageType || ""))) return false;
  return true;
}

function factor(id: string, label: string, earned: number, available: number, detail: string): BuildAdvisorScoreFactor {
  const ratio = available ? earned / available : 0;
  return { id, label, earned, available, assessment: ratio >= .9 ? "excellent" : ratio >= .7 ? "high" : ratio >= .45 ? "medium" : earned > 0 ? "low" : "missing", detail };
}

function weaponSummary(weapons: BuildAdvisorWeaponEvaluation[]): string {
  const available = weapons.filter((weapon) => weapon.item).length;
  return `${available}/${weapons.length} weapon roles have a physical owned match.`;
}

function armorSummary(armor: BuildAdvisorArmorEvaluation[]): string {
  const available = armor.filter((entry) => entry.item).length;
  const statKnown = armor.filter((entry) => entry.item?.armorStats).length;
  return `${available}/${ARMOR_SLOTS.length} armor slots have an owned match; ${statKnown} include current stat data.`;
}

function rollSummary(weapons: BuildAdvisorWeaponEvaluation[]): string {
  const labels = weapons.map((weapon) => `${weapon.label}: ${weapon.quality}`);
  return labels.join("; ") || "No weapon roll requirements.";
}

function qualityFraction(quality: BuildAdvisorRollQuality): number {
  return ({ perfect: 1, strong: .9, functional: .7, unknown: .55, poor: .25, missing: 0 })[quality];
}

function rollFraction(quality: BuildAdvisorRollQuality): number {
  return ({ perfect: 1, strong: .85, functional: .6, unknown: .35, poor: .15, missing: 0 })[quality];
}

function armorQualityFraction(quality: BuildAdvisorArmorEvaluation["quality"]): number {
  return ({ excellent: 1, strong: .85, functional: .55, missing: 0 })[quality];
}

function rollRank(quality: BuildAdvisorRollQuality): number {
  return ({ perfect: 6, strong: 5, functional: 4, unknown: 3, poor: 2, missing: 1 })[quality];
}

function profileValue(value: "high" | "medium" | "low"): number {
  return value === "high" ? 3 : value === "medium" ? 2 : 1;
}

function focusesForTemplate(template: BuildAdvisorTemplate): BuildAdvisorFocus[] {
  const focuses: BuildAdvisorFocus[] = ["Balanced"];
  if (template.bossDamage === "high") focuses.push("Boss Damage");
  if (template.addClear === "high" && template.survivability !== "low") focuses.push("General PvE");
  if (template.solo === "high" || template.survivability === "high") focuses.push("Solo / Survivability");
  if (template.addClear === "high") focuses.push("Add Clear");
  if (template.abilityUptime === "high") focuses.push("Ability Uptime");
  if (template.powerFriendly) focuses.push("Power Progression");
  return [...new Set(focuses)];
}

function itemEquipConvenience(item: BuildAdvisorOwnedItem, characterId: string): number {
  if (item.equipped && item.ownerCharacterId === characterId) return 5;
  if (item.location === "inventory" && item.ownerCharacterId === characterId) return 4;
  if (item.location === "vault") return 3;
  if (!item.equipped) return 2;
  return 0;
}

function itemSort(left: BuildAdvisorOwnedItem, right: BuildAdvisorOwnedItem): number {
  return left.name.localeCompare(right.name) || right.power - left.power || left.instanceId.localeCompare(right.instanceId);
}

function itemLocationPhrase(item: BuildAdvisorOwnedItem): string {
  if (item.location === "vault") return "in the Vault";
  if (item.ownerClassName && item.ownerClassName !== "Unknown") return `on the ${item.ownerClassName}`;
  return item.equipped ? "equipped" : "in character inventory";
}

function isWeapon(item: BuildAdvisorOwnedItem): boolean {
  return !/armor|helmet|gauntlet|chest|leg armor|cloak|mark|bond/i.test(item.itemType) && !/helmet|gauntlets|chest armor|leg armor|class armor/i.test(item.slot);
}

function isArmor(item: BuildAdvisorOwnedItem): boolean {
  return !isWeapon(item);
}

function classFromDefinition(definition: any): GuardianClass | undefined {
  const value = CLASS_BY_TYPE[Number(definition?.classType)];
  return value && value !== "Unknown" ? value : undefined;
}

function ownedCollectibleHashes(profile: any): Set<string> {
  const result = new Set<string>();
  const apply = (component: any) => {
    for (const [hash, row] of Object.entries(component?.collectibles || {}) as Array<[string, any]>) {
      if ((Number(row?.state || 0) & 1) === 0) result.add(hash);
    }
  };
  apply(profile?.profileCollectibles?.data);
  Object.values(profile?.characterCollectibles?.data || {}).forEach(apply);
  return result;
}

function socketPlugHashes(component: any): string[] {
  return (component?.sockets || []).map((socket: any) => hashOf(socket?.plugHash || socket?.plugItemHash)).filter((hash: string) => hash && hash !== "0");
}

function reusablePlugHashes(component: any): string[] {
  const rows = component?.plugs || {};
  return Object.values(rows).flatMap((plugs: any) => Array.isArray(plugs) ? plugs : []).map((plug: any) => hashOf(plug?.plugItemHash || plug?.plugHash)).filter((hash: string) => hash && hash !== "0");
}

function plugEntry(hash: string, definitions: CompanionManifest["itemDefinitions"]): ReturnType<typeof named> | undefined {
  const definition: any = definitions[hash];
  const name = String(definition?.displayProperties?.name || "").trim();
  if (!name || /^empty (?:mod|perk|socket)/i.test(name)) return undefined;
  const icon = imageUrl(definition?.displayProperties?.icon);
  return { name, hash, ...(icon ? { icon } : {}), description: String(definition?.displayProperties?.description || "") || undefined };
}

function uniqueNamedEntries(entries: Array<ReturnType<typeof named>>): Array<ReturnType<typeof named>> {
  return [...new Map(entries.map((entry) => [entry.hash || normalizeName(entry.name), entry])).values()];
}

function hashOf(value: unknown): string {
  const text = String(value || "").trim();
  return /^\d+$/.test(text) ? text : "";
}

function representativeManifestItems(items: ManifestItem[]): Map<string, ManifestItem> {
  const result = new Map<string, ManifestItem>();
  for (const item of items) {
    const key = normalizeName(item.name);
    const current = result.get(key);
    if (!current || manifestItemScore(item) > manifestItemScore(current)) result.set(key, item);
  }
  return result;
}

function manifestItemScore(item: ManifestItem): number {
  const source = cleanAcquisitionSource(item.source);
  return (source ? 100 : 0)
    + (/exotic armor focusing|exotic archive/i.test(source) ? 20 : 0)
    + (item.collectibleHash ? 5 : 0)
    + (item.icon ? 1 : 0);
}

function normalizeName(value: string): string {
  return value.toLocaleLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9]+/g, " ").trim();
}

function sameName(left: string, right: string): boolean {
  return normalizeName(left) === normalizeName(right);
}

function hasPerk(perkNames: string[], target: string): boolean {
  const normalizedTarget = normalizeName(target);
  return perkNames.some((perk) => perk === normalizedTarget || perk === `${normalizedTarget} enhanced` || perk === `enhanced ${normalizedTarget}`);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
