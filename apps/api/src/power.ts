import type { CharacterPowerCeiling, GuardianClass, PowerData, PowerItem, PowerItemLocation, PowerSlot, PowerSlotKind } from "@guardian-nexus/contracts";
import { imageUrl } from "@guardian-nexus/domain";
import { charactersFromProfile } from "./normalize";

const slots: Array<{ kind: PowerSlotKind; label: string }> = [
  { kind: "kinetic", label: "Kinetic Weapon" },
  { kind: "energy", label: "Energy Weapon" },
  { kind: "power", label: "Power Weapon" },
  { kind: "helmet", label: "Helmet" },
  { kind: "gauntlets", label: "Gauntlets" },
  { kind: "chest", label: "Chest Armor" },
  { kind: "legs", label: "Leg Armor" },
  { kind: "class-item", label: "Class Item" }
];
const classTypes: Record<GuardianClass, number> = { Titan: 0, Hunter: 1, Warlock: 2, Unknown: 3 };

export function normalizePower(profile: any, definitions: Record<string, Record<string, unknown>>, selectedCharacterId: string): PowerData {
  const characters = charactersFromProfile(profile);
  const instances = profile?.itemComponents?.instances?.data || {};
  const entries: Array<{ item: any; location: PowerItemLocation; ownerCharacterId?: string }> = [];
  for (const item of profile?.profileInventory?.data?.items || []) entries.push({ item, location: "vault" });
  for (const [ownerCharacterId, container] of Object.entries(profile?.characterInventories?.data || {}) as Array<[string, any]>) {
    for (const item of container?.items || []) entries.push({ item, location: "inventory", ownerCharacterId });
  }
  for (const [ownerCharacterId, container] of Object.entries(profile?.characterEquipment?.data || {}) as Array<[string, any]>) {
    for (const item of container?.items || []) entries.push({ item, location: "equipped", ownerCharacterId });
  }

  const items = new Map<string, PowerItem & { classType: number; itemType: number }>();
  for (const entry of entries) {
    const instanceId = String(entry.item?.itemInstanceId || "");
    const itemHash = String(Number(entry.item?.itemHash || 0) >>> 0);
    const definition: any = definitions[itemHash];
    const slot = slotFor(definition);
    const power = nonNegative(instances[instanceId]?.primaryStat?.value ?? entry.item?.primaryStat?.value);
    if (!instanceId || !definition || !slot || power <= 0) continue;
    items.set(instanceId, {
      instanceId,
      itemHash,
      name: String(definition?.displayProperties?.name || "Unknown gear"),
      icon: imageUrl(definition?.displayProperties?.icon),
      power,
      slot,
      location: entry.location,
      ...(entry.ownerCharacterId ? { ownerCharacterId: entry.ownerCharacterId } : {}),
      classType: Number(definition?.classType ?? 3),
      itemType: Number(definition?.itemType ?? -1)
    });
  }

  const ceilings = characters.map((character): CharacterPowerCeiling => {
    const compatible = [...items.values()].filter((item) => item.itemType === 3 || item.itemType === 2 && (item.classType === 3 || item.classType === classTypes[character.className]));
    const bestBySlot = new Map<PowerSlotKind, typeof compatible[number]>();
    const vaultBySlot = new Map<PowerSlotKind, typeof compatible[number]>();
    for (const item of compatible) {
      if (better(item, bestBySlot.get(item.slot), character.characterId)) bestBySlot.set(item.slot, item);
      if (item.location === "vault" && better(item, vaultBySlot.get(item.slot), character.characterId)) vaultBySlot.set(item.slot, item);
    }
    const slotPowers = slots.map(({ kind }) => bestBySlot.get(kind)?.power || 0);
    const highestSlotPower = Math.max(0, ...slotPowers);
    const lowestSlotPower = Math.min(...slotPowers);
    const totalPower = slotPowers.reduce((sum, power) => sum + power, 0);
    const maximumPower = Math.floor(totalPower / slots.length);
    const normalizedSlots: PowerSlot[] = slots.map(({ kind, label }) => {
      const item = bestBySlot.get(kind);
      const vaultBest = vaultBySlot.get(kind);
      const power = item?.power || 0;
      return {
        kind,
        label,
        power,
        deficit: Math.max(0, highestSlotPower - power),
        lowest: power === lowestSlotPower,
        ...(item ? { item: publicItem(item) } : {}),
        ...(vaultBest ? { vaultBest: publicItem(vaultBest) } : {})
      };
    });
    return {
      characterId: character.characterId,
      className: character.className,
      emblemPath: character.emblemPath,
      emblemBackgroundPath: character.emblemBackgroundPath,
      currentPower: character.power,
      maximumPower,
      averagePower: Math.round((totalPower / slots.length) * 100) / 100,
      progressToNextPower: totalPower % slots.length,
      lowestSlotPower,
      slots: normalizedSlots
    };
  }).sort((left, right) => Number(right.characterId === selectedCharacterId) - Number(left.characterId === selectedCharacterId));

  const allItems = [...items.values()];
  return {
    selectedCharacterId,
    accountMaximumPower: Math.max(0, ...ceilings.map((character) => character.maximumPower)),
    highestItemPower: Math.max(0, ...allItems.map((item) => item.power)),
    vaultHighestItemPower: Math.max(0, ...allItems.filter((item) => item.location === "vault").map((item) => item.power)),
    characters: ceilings,
    sources: {
      items: "Destiny2.GetProfile inventories, equipment, and item instances",
      definitions: "DestinyInventoryItemDefinition manifest data"
    }
  };
}

export function powerItemHashes(profile: any): string[] {
  const hashes = new Set<string>();
  const collect = (container: any) => {
    for (const item of container?.items || []) {
      const hash = String(Number(item?.itemHash || 0) >>> 0);
      if (hash !== "0") hashes.add(hash);
    }
  };
  collect(profile?.profileInventory?.data);
  Object.values(profile?.characterInventories?.data || {}).forEach(collect);
  Object.values(profile?.characterEquipment?.data || {}).forEach(collect);
  return [...hashes];
}

function slotFor(definition: any): PowerSlotKind | undefined {
  if (![2, 3].includes(Number(definition?.itemType))) return undefined;
  const value = `${definition?.equipmentSlot || ""} ${definition?.itemTypeDisplayName || ""}`.toLowerCase();
  if (/kinetic weapons?|primary weapons?/.test(value)) return "kinetic";
  if (/energy weapons?|special weapons?/.test(value)) return "energy";
  if (/power weapons?|heavy weapons?/.test(value)) return "power";
  if (/helmet/.test(value)) return "helmet";
  if (/gauntlets|arms/.test(value)) return "gauntlets";
  if (/chest/.test(value)) return "chest";
  if (/leg armor|legs/.test(value)) return "legs";
  if (/class armor|class item|mark|cloak|bond/.test(value)) return "class-item";
  return undefined;
}

function better(candidate: PowerItem, current: PowerItem | undefined, characterId: string): boolean {
  if (!current || candidate.power !== current.power) return !current || candidate.power > current.power;
  return itemPriority(candidate, characterId) > itemPriority(current, characterId);
}

function itemPriority(item: PowerItem, characterId: string): number {
  return Number(item.ownerCharacterId === characterId) * 10 + ({ equipped: 3, inventory: 2, vault: 1 } as const)[item.location];
}

function publicItem(item: PowerItem): PowerItem {
  const { instanceId, itemHash, name, icon, power, slot, location, ownerCharacterId } = item;
  return { instanceId, itemHash, name, icon, power, slot, location, ...(ownerCharacterId ? { ownerCharacterId } : {}) };
}

function nonNegative(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}
