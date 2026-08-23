import type { ArmorItem, GearData, LootWatcherConfig, WeaponItem } from "@guardian-nexus/contracts";

type PhysicalItem = (ArmorItem & { kind: "armor" }) | (WeaponItem & { kind: "weapon" });

const DESTINY_RECIPES_FIT_STATS: Record<string, ReadonlySet<string>> = {
  brawler: new Set(["weapons", "class", "grenade", "super"]),
  bulwark: new Set(["weapons", "grenade", "super", "melee"]),
  colossus: new Set(["weapons", "class", "grenade", "melee"]),
  demolitionist: new Set(["weapons", "health", "super", "melee"]),
  grenadier: new Set(["weapons", "health", "class", "melee"]),
  gunner: new Set(["health", "class", "super", "melee"]),
  paragon: new Set(["weapons", "health", "class", "grenade"]),
  powerhouse: new Set(["health", "class", "grenade", "melee"]),
  reaver: new Set(["weapons", "health", "grenade", "super"]),
  siegebreaker: new Set(["weapons", "class", "super", "melee"]),
  skirmisher: new Set(["health", "class", "grenade", "super"]),
  specialist: new Set(["health", "grenade", "super", "melee"])
};

export interface LootWatcherPlan {
  moveToVault: string[];
  lock: string[];
  tagJunk: string[];
  skipped: string[];
}

export function planLootWatchers(data: GearData, config: LootWatcherConfig, newInstanceIds: Set<string>, baselineEstablished = true): LootWatcherPlan {
  const items: PhysicalItem[] = [
    ...data.items.map((item) => ({ ...item, kind: "armor" as const })),
    ...(data.weapons || []).map((item) => ({ ...item, kind: "weapon" as const }))
  ];
  const lock = new Set<string>();
  const tagJunk = new Set<string>();
  const moveToVault = new Set<string>();
  const skipped: string[] = [];

  if (config.highestPowerLock && baselineEstablished) {
    for (const group of grouped(items.filter((item) => item.power > 0), equipmentSlotKey).values()) {
      const prior = group.filter((item) => !newInstanceIds.has(item.instanceId));
      const priorHighest = prior.length ? Math.max(...prior.map((item) => item.power)) : Number.NEGATIVE_INFINITY;
      const newHighest = Math.max(...group.filter((item) => newInstanceIds.has(item.instanceId)).map((item) => item.power), Number.NEGATIVE_INFINITY);
      if (newHighest <= priorHighest) continue;
      group.filter((item) => newInstanceIds.has(item.instanceId) && item.power === newHighest && !item.locked).forEach((item) => lock.add(item.instanceId));
    }
  }

  if ((config.highestPowerLock || config.tier5FitLock || config.duplicateFitJunk) && !baselineEstablished) {
    skipped.push("New-loot watchers will begin after Guardian Nexus establishes the current inventory baseline.");
  } else {
    const comparableArmor = data.items.filter(hasComparableFit);
    const fitGroups = grouped(comparableArmor.filter(isArmorFit), armorFitKey);
    if (config.tier5FitLock) {
      for (const group of fitGroups.values()) {
        const newTier5 = group.filter((item) => newInstanceIds.has(item.instanceId) && item.gearTier === 5);
        const alreadyOwned = group.some((item) => !newInstanceIds.has(item.instanceId) && item.gearTier >= 5);
        if (!newTier5.length || alreadyOwned) continue;
        const keeper = [...newTier5].sort(bestArmorFirst)[0];
        if (keeper && !keeper.locked) lock.add(keeper.instanceId);
      }
    }
    if (config.duplicateFitJunk) {
      for (const item of comparableArmor.filter((entry) => newInstanceIds.has(entry.instanceId))) {
        if (isArmorFit(item) || protectedForJunk(item) || lock.has(item.instanceId)) continue;
        tagJunk.add(item.instanceId);
      }
      for (const group of grouped(comparableArmor.filter(isArmorFit), armorDuplicateKey).values()) {
        const prior = group.filter((item) => !newInstanceIds.has(item.instanceId));
        if (!prior.length) continue;
        const keeper = [...group].sort((left, right) => bestArmorFirstWithPlannedLocks(left, right, lock))[0];
        for (const item of group.filter((entry) => newInstanceIds.has(entry.instanceId))) {
          if (item.instanceId === keeper?.instanceId || protectedForJunk(item) || lock.has(item.instanceId)) continue;
          tagJunk.add(item.instanceId);
        }
      }
    }
  }

  if (config.farmingMode) {
    const inventory = items.filter((item) => item.location === "inventory" && item.ownerCharacterId === data.selectedCharacterId && !item.inPostmaster);
    for (const group of grouped(inventory, equipmentSlotKey).values()) {
      // Destiny character buckets expose nine unequipped inventory positions
      // beside the equipped item. Eight inventory items leaves one pickup slot.
      const needed = Math.max(0, group.length - 8);
      const candidates = [...group]
        .filter((item) => !protectedItem(item) && !lock.has(item.instanceId))
        .sort((left, right) => Number(newInstanceIds.has(right.instanceId)) - Number(newInstanceIds.has(left.instanceId)) || left.power - right.power);
      candidates.slice(0, needed).forEach((item) => moveToVault.add(item.instanceId));
      if (candidates.length < needed) skipped.push(`${equipmentSlotKey(group[0]!)} has no unprotected item available to keep a slot free.`);
    }
  }

  return { moveToVault: [...moveToVault], lock: [...lock], tagJunk: [...tagJunk], skipped };
}

function grouped<T>(items: T[], keyFor: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFor(item);
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

function equipmentSlotKey(item: PhysicalItem): string { return `${item.kind}:${item.slot}`.toLocaleLowerCase(); }
function normalized(value: string | undefined): string { return String(value || "").trim().toLocaleLowerCase(); }
function hasComparableFit(item: ArmorItem): boolean {
  return normalized(item.rarity) !== "exotic" && Boolean(item.archetype?.hash || item.archetype?.name) && Boolean(item.tunedStat);
}
function armorFitKey(item: ArmorItem): string {
  return [item.className, item.slot, item.archetype?.name || item.archetype?.hash, item.tunedStat].map(normalized).join("|");
}
function armorDuplicateKey(item: ArmorItem): string {
  return [item.className, item.slot, item.name, item.archetype?.name || item.archetype?.hash, item.tunedStat].map(normalized).join("|");
}
function isArmorFit(item: ArmorItem): boolean {
  const allowed = DESTINY_RECIPES_FIT_STATS[normalized(item.archetype?.name)];
  if (allowed) return Boolean(item.tunedStat) && allowed.has(item.tunedStat!);
  const archetypeStats = Object.entries(item.baseStats)
    .sort((left, right) => Number(right[1]) - Number(left[1]))
    .slice(0, 2)
    .map(([key]) => key);
  return Boolean(item.tunedStat) && !archetypeStats.includes(item.tunedStat!);
}
function protectedItem(item: { equipped: boolean; locked: boolean; tag?: string }): boolean {
  return item.equipped || item.locked || item.tag === "favorite" || item.tag === "keep";
}
function protectedForJunk(item: { equipped: boolean; locked: boolean; tag?: string }): boolean {
  return item.equipped || item.locked || Boolean(item.tag);
}
function bestArmorFirst(left: ArmorItem, right: ArmorItem): number {
  return Number(protectedItem(right)) - Number(protectedItem(left))
    || right.gearTier - left.gearTier
    || right.baseTotal - left.baseTotal
    || right.currentTotal - left.currentTotal
    || right.power - left.power
    || Date.parse(right.firstSeenAt) - Date.parse(left.firstSeenAt);
}
function bestArmorFirstWithPlannedLocks(left: ArmorItem, right: ArmorItem, locks: Set<string>): number {
  return Number(locks.has(right.instanceId)) - Number(locks.has(left.instanceId)) || bestArmorFirst(left, right);
}
