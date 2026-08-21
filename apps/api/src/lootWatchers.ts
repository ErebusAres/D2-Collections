import type { ArmorItem, GearData, LootWatcherConfig, WeaponItem } from "@guardian-nexus/contracts";

type PhysicalItem = (ArmorItem & { kind: "armor" }) | (WeaponItem & { kind: "weapon" });

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

  if (config.highestPowerLock) {
    for (const group of grouped(items.filter((item) => item.power > 0), equipmentSlotKey).values()) {
      const highest = Math.max(...group.map((item) => item.power));
      group.filter((item) => item.power === highest && !item.locked).forEach((item) => lock.add(item.instanceId));
    }
  }

  if ((config.tier5FitLock || config.duplicateFitJunk) && !baselineEstablished) {
    skipped.push("Armor-fit watchers will begin after Guardian Nexus establishes the current inventory baseline.");
  } else {
    const fitGroups = grouped(data.items.filter(hasComparableFit), armorFitKey);
    if (config.tier5FitLock) {
      for (const group of fitGroups.values()) {
        const newTier5 = group.filter((item) => newInstanceIds.has(item.instanceId) && item.gearTier === 5);
        const alreadyOwned = group.some((item) => !newInstanceIds.has(item.instanceId));
        if (!newTier5.length || alreadyOwned) continue;
        const keeper = [...newTier5].sort(bestArmorFirst)[0];
        if (keeper && !keeper.locked) lock.add(keeper.instanceId);
      }
    }
    if (config.duplicateFitJunk) {
      for (const group of fitGroups.values()) {
        if (group.length < 2 || !group.some((item) => newInstanceIds.has(item.instanceId))) continue;
        const keeper = [...group].sort((left, right) => bestArmorFirstWithPlannedLocks(left, right, lock))[0];
        for (const item of group) {
          if (item.instanceId === keeper?.instanceId || protectedItem(item) || lock.has(item.instanceId) || item.tag === "junk") continue;
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
  return [item.className, item.slot, item.name, item.archetype?.hash || item.archetype?.name, item.tunedStat].map(normalized).join("|");
}
function protectedItem(item: { equipped: boolean; locked: boolean; tag?: string }): boolean {
  return item.equipped || item.locked || item.tag === "favorite" || item.tag === "keep";
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
