import type { ArmorAdjustment, ArmorItem, ArmorPerk, ArmorStatKey, ArmorStats, GearData, GearManifest, GearTag, GuardianClass, WeaponItem, WeaponPerkColumn } from "@guardian-nexus/contracts";
import { ARMOR_STAT_KEYS, armorGrade, imageUrl } from "@guardian-nexus/domain";

const STAT_HASHES: Record<string, ArmorStatKey> = { "392767087": "health", "4244567218": "melee", "1735777505": "grenade", "144602215": "super", "1943323491": "class", "2996146975": "weapons" };
const CLASS_NAMES: Record<number, GuardianClass> = { 0: "Titan", 1: "Hunter", 2: "Warlock", 3: "Unknown" };
const ARCHETYPES = new Set([
  "paragon",
  "grenadier",
  "specialist",
  "brawler",
  "bulwark",
  "gunner",
  "siegebreaker",
  "skirmisher",
  "demolitionist",
  "colossus",
  "reaver",
  "powerhouse"
]);
const TUNING_CATEGORY = "core.gear_systems.armor_tiering.plugs.tuning.mods";
const WEAPON_SLOT_HASHES: Record<string, WeaponItem["slot"]> = { "1498876634": "Kinetic", "2465295065": "Energy", "953998645": "Power" };
const POSTMASTER_BUCKET_HASH = "215593132";
const DAMAGE_TYPES: Record<number, WeaponItem["damageType"]> = { 1: "Kinetic", 2: "Arc", 3: "Solar", 4: "Void", 6: "Stasis", 7: "Strand" };
const WEAPON_STATS: Record<string, { name: string; maximumValue: number; displayAsNumeric?: boolean }> = {
  "4284893193": { name: "Rounds Per Minute", maximumValue: 1000, displayAsNumeric: true },
  "4043523819": { name: "Impact", maximumValue: 100 },
  "1240592695": { name: "Range", maximumValue: 100 },
  "155624089": { name: "Stability", maximumValue: 100 },
  "943549884": { name: "Handling", maximumValue: 100 },
  "4188031367": { name: "Reload Speed", maximumValue: 100 },
  "3871231066": { name: "Magazine", maximumValue: 100, displayAsNumeric: true },
  "1345609583": { name: "Aim Assistance", maximumValue: 100 },
  "3555269338": { name: "Zoom", maximumValue: 100 },
  "2715839340": { name: "Recoil Direction", maximumValue: 100 },
  "2714457168": { name: "Airborne Effectiveness", maximumValue: 100 }
};

export interface GearStateRow { item_instance_id: string; tag?: GearTag; first_seen_at: string; dismissed_at?: string }

export function normalizeGear(profile: any, manifest: GearManifest, selectedCharacterId: string, selectedClass: GuardianClass, states: Map<string, GearStateRow>, now: string): GearData {
  const definitions = manifest.gearItemDefinitions;
  const plugs = manifest.plugDefinitions;
  const stats = profile?.itemComponents?.stats?.data || {};
  const sockets = profile?.itemComponents?.sockets?.data || {};
  const reusablePlugs = profile?.itemComponents?.reusablePlugs?.data || {};
  const instances = profile?.itemComponents?.instances?.data || {};
  const itemStates = profile?.itemComponents?.state?.data || {};
  const itemObjectives = profile?.itemComponents?.objectives?.data || {};
  const collected: Array<{ item: any; owner?: string; location: ArmorItem["location"]; equipped: boolean; inPostmaster?: boolean }> = [];
  for (const item of profile?.profileInventory?.data?.items || []) collected.push({ item, location: "vault", equipped: false });
  for (const [owner, container] of Object.entries(profile?.characterInventories?.data || {}) as any) for (const item of container?.items || []) collected.push({ item, owner, location: "inventory", equipped: false, inPostmaster: String(item?.bucketHash || "") === POSTMASTER_BUCKET_HASH });
  for (const [owner, container] of Object.entries(profile?.characterEquipment?.data || {}) as any) for (const item of container?.items || []) collected.push({ item, owner, location: "equipped", equipped: true });
  const seen = new Set<string>();
  const items: ArmorItem[] = [];
  const weapons: WeaponItem[] = [];
  for (const entry of collected) {
    const instanceId = String(entry.item?.itemInstanceId || "");
    if (!instanceId || seen.has(instanceId)) continue;
    seen.add(instanceId);
    const itemHash = String(Number(entry.item?.itemHash) >>> 0);
    const definition: any = definitions[itemHash];
    if (!definition || ![2, 3].includes(Number(definition.itemType))) continue;
    const itemSockets = sockets[instanceId]?.sockets || [];
    const activePlugHashes = itemSockets.map((socket: any) => hashOf(socket?.plugHash || socket?.plugItemHash)).filter((hash: string) => hash !== "0");
    const activePlugs = activePlugHashes.map((hash: string) => plugs[hash]).filter(Boolean) as any[];
    const state = states.get(instanceId);
    const instance = instances[instanceId] || {};
    const itemState = Number(itemStates[instanceId]?.state ?? entry.item?.state ?? 0);
    if (Number(definition.itemType) === 3) {
      const perkColumns = weaponPerkColumns(itemSockets, reusablePlugs[instanceId]?.plugs || {}, plugs);
      const originTraits = activePlugs.filter((plug) => weaponPlugKind(plug) === "origin").map(perk).filter((value) => value.name);
      const masterwork = activePlugs.find((plug) => weaponPlugKind(plug) === "masterwork");
      const rollDataState: WeaponItem["rollDataState"] = perkColumns.length >= 2 && perkColumns.every((column) => column.active) ? "complete" : activePlugs.length || perkColumns.length ? "partial" : "unavailable";
      const enhanced = activePlugs.some((plug) => /enhanced|enhancement/i.test(`${plug?.displayProperties?.name} ${plug?.plug?.plugCategoryIdentifier}`));
      const weaponStats = Object.entries(stats[instanceId]?.stats || {}).flatMap(([hash, value]: [string, any]) => {
        const definition = WEAPON_STATS[hash];
        return definition ? [{ hash, name: definition.name, value: Number(value?.value || 0), maximumValue: definition.maximumValue, displayAsNumeric: definition.displayAsNumeric }] : [];
      });
      const trackerValue = (itemObjectives[instanceId]?.objectives || []).map((objective: any) => Number(objective?.progress || 0)).find((value: number) => value > 0);
      weapons.push({
        instanceId, itemHash, name: String(definition.displayProperties?.name || "Unknown Weapon"), icon: imageUrl(definition.displayProperties?.icon), itemType: String(definition.itemTypeDisplayName || "Weapon"),
        slot: WEAPON_SLOT_HASHES[String(definition.inventory?.bucketTypeHash || "")] || "Unknown", damageType: DAMAGE_TYPES[Number(definition.defaultDamageType)] || "Unknown",
        rarity: String(definition.inventory?.tierTypeName || "Legendary"), power: Number(instance.primaryStat?.value || entry.item?.primaryStat?.value || 0), ownerCharacterId: entry.owner,
        location: entry.location, ...(entry.inPostmaster ? { inPostmaster: true } : {}), equipped: entry.equipped, locked: Boolean(itemState & 1), masterworked: Boolean(itemState & 4), crafted: Boolean(instance.isCrafted), enhanced,
        perkColumns, originTraits, ...(masterwork ? { masterwork: perk(masterwork) } : {}), stats: weaponStats, ...(trackerValue !== undefined ? { trackerValue } : {}), rollDataState, reviewState: "unique", reviewReasons: [], duplicateCount: 1, wishlisted: false,
        tag: state?.tag, firstSeenAt: state?.first_seen_at || now, dismissedAt: state?.dismissed_at, isNew: !state?.dismissed_at && !state?.tag
      });
      continue;
    }
    const currentStats = statsFromComponent(stats[instanceId]?.stats || {});
    const archetypeDef = activePlugs.find((plug) => ARCHETYPES.has(normalize(plug?.displayProperties?.name)) || normalize(plug?.plug?.plugCategoryIdentifier).includes("archetype"));
    // Armor archetypes/intrinsics define the roll itself. DIM treats those as
    // base stats, so only removable enhancement plugs belong in adjustments.
    const adjustments = adjustmentsFromPlugs(activePlugs.filter((plug) => plug !== archetypeDef), currentStats);
    const totalAdjustments = sumAdjustments(adjustments);
    const baseStats = mapStats((key) => Math.max(0, currentStats[key] - totalAdjustments[key]));
    const tuningDef = activePlugs.find(isTuningPlug);
    const tunedStat = resolveTunedStat(itemSockets, reusablePlugs[instanceId]?.plugs || {}, plugs, tuningDef);
    const ornamentDef = activePlugs.find(isEquippedArmorOrnament);
    const setDefs = activePlugs.filter((plug) => /set bonus|piece bonus|pieces equipped/i.test(`${plug?.displayProperties?.name} ${plug?.displayProperties?.description}`));
    const baseTotal = total(baseStats); const currentTotal = total(currentStats);
    items.push({
      instanceId, itemHash, name: String(definition.displayProperties?.name || "Unknown Armor"), icon: imageUrl(ornamentDef?.displayProperties?.icon || definition.displayProperties?.icon), className: CLASS_NAMES[Number(definition.classType)] || "Unknown",
      slot: String(definition.itemTypeDisplayName || "Armor"), rarity: String(definition.inventory?.tierTypeName || "Legendary"), power: Number(instance.primaryStat?.value || entry.item?.primaryStat?.value || 0), ownerCharacterId: entry.owner,
      location: entry.location, ...(entry.inPostmaster ? { inPostmaster: true } : {}), equipped: entry.equipped, locked: Boolean(Number(itemStates[instanceId]?.state ?? entry.item?.state ?? 0) & 1), masterworked: Boolean(Number(itemStates[instanceId]?.state ?? entry.item?.state ?? 0) & 4), gearTier: Number(instance.gearTier || 0),
      archetype: archetypeDef ? perk(archetypeDef) : undefined, tuning: tuningDef ? { ...perk(tuningDef), stats: statsFromInvestment(tuningDef.investmentStats || []) } : undefined, tunedStat,
      setBonuses: setDefs.map((plug) => ({ ...perk(plug), pieces: pieceCount(plug), active: true })), perks: activePlugs.filter((plug) => plug !== archetypeDef && plug !== tuningDef && !setDefs.includes(plug)).map(perk).filter((value) => value.name),
      baseStats, currentStats, adjustments, baseTotal, currentTotal, grade: armorGrade(baseStats), tag: state?.tag, firstSeenAt: state?.first_seen_at || now, dismissedAt: state?.dismissed_at, isNew: !state?.dismissed_at && !state?.tag
    });
  }
  const weaponCounts = new Map<string, number>();
  for (const weapon of weapons) weaponCounts.set(weapon.itemHash, (weaponCounts.get(weapon.itemHash) || 0) + 1);
  for (const weapon of weapons) {
    weapon.duplicateCount = weaponCounts.get(weapon.itemHash) || 1;
    weapon.reviewState = weapon.rollDataState !== "complete" ? "incomplete-data"
      : weapon.crafted || weapon.enhanced || weapon.masterworked ? "configured"
        : weapon.duplicateCount > 1 ? "duplicate-review" : "unique";
    weapon.reviewReasons = weapon.reviewState === "incomplete-data" ? ["Bungie did not return enough socket data for a complete roll comparison."]
      : weapon.reviewState === "configured" ? [weapon.crafted ? "This is a crafted weapon." : weapon.enhanced ? "This weapon has enhanced traits." : "This weapon is masterworked."]
        : weapon.reviewState === "duplicate-review" ? [`You own ${weapon.duplicateCount} physical copies; compare perk columns before deciding which to keep.`]
          : ["This is the only physical copy found on the account."];
  }
  const statIcons = Object.fromEntries(Object.entries(STAT_HASHES).map(([hash, key]) => [key, imageUrl((manifest.statDefinitions[hash] as any)?.displayProperties?.icon)]).filter(([, icon]) => icon));
  return { gearSchemaVersion: 2, manifestVersion: manifest.version, selectedCharacterId, selectedClass, items, weapons, statIcons, totals: { armor: items.length, weapons: weapons.length, vault: items.filter((item) => item.location === "vault").length, equipped: items.filter((item) => item.equipped).length, locked: items.filter((item) => item.locked).length, grouped: 0, newItems: items.filter((item) => item.isNew).length } };
}

function weaponPerkColumns(itemSockets: any[], reusableBySocket: Record<string, any[]>, plugs: Record<string, any>): WeaponPerkColumn[] {
  const columns = itemSockets.map((socket, socketIndex): (WeaponPerkColumn & { ratingKind?: "first" | "second" | "trait" }) | undefined => {
    const activeHash = hashOf(socket?.plugHash || socket?.plugItemHash);
    const activeDefinition = activeHash !== "0" ? plugs[activeHash] : undefined;
    const optionHashes = [
      ...(socket?.reusablePlugHashes || []),
      ...(socket?.reusablePlugItems || []).map((entry: any) => entry?.plugItemHash ?? entry?.plugHash),
      ...(reusableBySocket[String(socketIndex)] || []).map((entry: any) => entry?.plugItemHash ?? entry?.plugHash)
    ].map(hashOf).filter((hash) => hash !== "0");
    const definitions = [...new Map(optionHashes.map((hash) => [hash, plugs[hash]]).filter((entry): entry is [string, any] => Boolean(entry[1])))];
    const kind = weaponPlugKind(activeDefinition || definitions[0]?.[1]);
    if (!kind || kind === "origin" || kind === "masterwork") return undefined;
    const options = definitions.map(([, definition]) => perk(definition)).filter((value) => value.name);
    const ratingKind = weaponRatingKind(activeDefinition || definitions[0]?.[1]);
    return { socketIndex, ...(ratingKind ? { ratingKind } : {}), ...(activeDefinition ? { active: perk(activeDefinition) } : {}), options };
  }).filter((value): value is WeaponPerkColumn & { ratingKind?: "first" | "second" | "trait" } => Boolean(value));
  let traitColumn = 2;
  return columns.map(({ ratingKind, ...column }) => {
    if (ratingKind === "first") return { ...column, ratingColumn: 0 };
    if (ratingKind === "second") return { ...column, ratingColumn: 1 };
    if (ratingKind === "trait" && traitColumn <= 3) {
      const ratingColumn = traitColumn as 2 | 3;
      traitColumn += 1;
      return { ...column, ratingColumn };
    }
    return column;
  });
}

function weaponRatingKind(plug: any): "first" | "second" | "trait" | undefined {
  const type = normalize(plug?.itemTypeDisplayName);
  if (/origin trait|intrinsic/.test(type)) return undefined;
  if (/trait/.test(type)) return "trait";
  if (/barrel|scope|sight|blade|haft/.test(type)) return "first";
  if (/magazine|battery|guard|grip|stock/.test(type)) return "second";
  return undefined;
}

function weaponPlugKind(plug: any): "perk" | "origin" | "masterwork" | undefined {
  if (!plug) return undefined;
  const category = normalize(plug?.plug?.plugCategoryIdentifier);
  const text = normalize(`${plug?.displayProperties?.name} ${plug?.itemTypeDisplayName} ${category}`);
  if (/ornament|shader|tracker|kill counter|memento|empty /.test(text)) return undefined;
  if (/origin/.test(category)) return "origin";
  if (/masterwork/.test(category) || /masterwork/.test(plug?.itemTypeDisplayName || "")) return "masterwork";
  if (/weapon|intrinsic|frame|barrel|magazine|scope|sight|grip|stock|trait|perk|enhancement/.test(category)) return "perk";
  return undefined;
}

function resolveTunedStat(itemSockets: any[], reusableBySocket: Record<string, any[]>, plugs: Record<string, any>, applied?: any): ArmorStatKey | undefined {
  const appliedPositive = directionalTunedStat(applied);
  if (appliedPositive) return appliedPositive;
  const candidates = itemSockets.flatMap((socket) => [
    ...(socket?.reusablePlugHashes || []),
    ...(socket?.reusablePlugItems || []).map((entry: any) => entry?.plugItemHash ?? entry?.plugHash)
  ]).concat(Object.values(reusableBySocket).flat().map((entry: any) => entry?.plugItemHash ?? entry?.plugHash)).map(hashOf).map((hash) => plugs[hash]).filter(isTuningPlug);
  const positiveStats = [...new Set(candidates.map(directionalTunedStat).filter(Boolean))] as ArmorStatKey[];
  return positiveStats.length === 1 ? positiveStats[0] : undefined;
}

function directionalTunedStat(plug: any): ArmorStatKey | undefined {
  if (!plug) return undefined;
  const stats = statsFromInvestment(plug.investmentStats || []);
  const positive = ARMOR_STAT_KEYS.filter((key) => stats[key] >= 5);
  const hasTradeoff = ARMOR_STAT_KEYS.some((key) => stats[key] <= -5);
  return positive.length === 1 && hasTradeoff ? positive[0] : undefined;
}

function isTuningPlug(plug: any): boolean { return normalize(plug?.plug?.plugCategoryIdentifier) === TUNING_CATEGORY; }
function isEquippedArmorOrnament(plug: any): boolean {
  const text = normalize(`${plug?.displayProperties?.name} ${plug?.displayProperties?.description} ${plug?.itemTypeDisplayName} ${plug?.plug?.plugCategoryIdentifier}`);
  return (text.includes("ornament") || text.includes("skin")) && !/empty|default ornament/.test(normalize(plug?.displayProperties?.name)) && Boolean(plug?.displayProperties?.icon);
}
function hashOf(value: unknown): string { return String(Number(value || 0) >>> 0); }

function adjustmentsFromPlugs(plugs: any[], currentStats: ArmorStats): ArmorAdjustment[] {
  const raw = plugs.map((plug) => {
    const text = normalize(`${plug?.displayProperties?.name} ${plug?.itemTypeDisplayName} ${plug?.plug?.plugCategoryIdentifier}`);
    const type: ArmorAdjustment["type"] = text.includes("tuning") ? "tuning" : text.includes("artifice") ? "artifice" : text.includes("masterwork") ? "masterwork" : text.includes("mod") ? "mod" : "other";
    return { type, plug, stats: statsFromInvestment((plug?.investmentStats || []).filter((stat: any) => !stat?.isConditionallyActive)) };
  });
  const unconditional = sumAdjustments(raw.map(({ type, stats }) => ({ type, stats })));
  return raw.map(({ type, plug, stats }) => {
    const conditional = (plug?.investmentStats || []).filter((stat: any) => stat?.isConditionallyActive);
    if (conditional.length) {
      for (const stat of conditional) {
        const key = STAT_HASHES[String(Number(stat?.statTypeHash) >>> 0)];
        const value = Number(stat?.value || stat?.statValue || 0);
        if (!key || !value) continue;
        // Armor 3.0 masterwork and Balanced Tuning values apply only when the
        // underlying stat is zero. Remove ordinary mods first, then recognize
        // the applied conditional bonus by its exact remaining value.
        if (currentStats[key] - unconditional[key] === value) stats[key] += value;
      }
    }
    return { type, stats };
  }).filter((entry) => Object.values(entry.stats).some(Boolean));
}
function statsFromComponent(value: Record<string, any>): ArmorStats { return mapStats((key) => Number(value[Object.keys(STAT_HASHES).find((hash) => STAT_HASHES[hash] === key) || ""]?.value || 0)); }
function statsFromInvestment(value: any[]): ArmorStats { const out = mapStats(() => 0); for (const stat of value || []) { const key = STAT_HASHES[String(Number(stat?.statTypeHash) >>> 0)]; if (key) out[key] += Number(stat?.value || stat?.statValue || 0); } return out; }
function sumAdjustments(value: ArmorAdjustment[]): ArmorStats { const out = mapStats(() => 0); for (const adjustment of value) for (const key of ARMOR_STAT_KEYS) out[key] += Number(adjustment.stats[key] || 0); return out; }
function mapStats(fn: (key: ArmorStatKey) => number): ArmorStats { return Object.fromEntries(ARMOR_STAT_KEYS.map((key) => [key, fn(key)])) as unknown as ArmorStats; }
function total(value: ArmorStats): number { return ARMOR_STAT_KEYS.reduce((sum, key) => sum + value[key], 0); }
function normalize(value: unknown): string { return String(value || "").trim().toLowerCase(); }
function perk(definition: any): ArmorPerk { return { hash: String(definition?.hash || ""), name: String(definition?.displayProperties?.name || ""), description: String(definition?.displayProperties?.description || ""), icon: imageUrl(definition?.displayProperties?.icon) }; }
function pieceCount(definition: any): number | undefined { const match = `${definition?.displayProperties?.name} ${definition?.displayProperties?.description}`.match(/([24])[- ]?piece|([24]) pieces/i); return match ? Number(match[1] || match[2]) : undefined; }
