import type { BuildArmorSlot, BuildDocument, BuildEquipmentEntry, BuildGuardianClass, BuildNamedEntry, BuildSubclass, GuardianLoadout, LoadoutItem, LoadoutSocket } from "@guardian-nexus/contracts";
import { emptyBuildDocument } from "../builds/builds";
import { loadoutItemCosmetics, loadoutItemMods } from "./loadoutItemSockets";

const IMPORT_PREFIX = "guardian-nexus:loadout-build-import:";
const BUILD_SUBCLASSES = new Set<BuildSubclass>(["prismatic", "arc", "solar", "void", "strand", "stasis"]);
const TRAIT_LABELS = new Set(["Intrinsic", "Origin Trait"]);
const WEAPON_PERK_LABELS = new Set(["Barrel", "Scope", "Magazine", "Guard", "Perk", "Catalyst"]);

export interface LoadoutBuildImport { version: 1; sourceName: string; sourceIndex: number; document: BuildDocument }

export function buildDocumentFromLoadout(loadout: GuardianLoadout, characterClass: string): BuildDocument {
  const base = emptyBuildDocument();
  const subclass = normalizeSubclass(loadout);
  const armorMods = { ...base.armorMods };
  const ornaments: BuildNamedEntry[] = [];
  let shader: BuildNamedEntry | undefined;
  for (const item of loadout.equipment) {
    for (const cosmetic of loadoutItemCosmetics(item)) {
      const entry = socketEntry(cosmetic);
      if (cosmetic.categoryLabel === "Shader") shader ||= entry;
      else ornaments.push(entry);
    }
    const slot = buildArmorSlot(item.equipmentSlot);
    if (slot) armorMods[slot] = uniqueEntries(loadoutItemMods(item).filter((socket) => socket.categoryLabel === "Armor Mod").map(socketEntry));
  }
  const abilities = new Map(loadout.abilities.map((socket) => [socket.category, socket]));
  const grenade = loadout.isPrismatic ? loadout.prismaticGrenade || abilities.get("grenade") : abilities.get("grenade");
  return {
    ...base,
    title: loadout.name,
    classType: normalizeClass(characterClass),
    subclass,
    subclassConfig: {
      super: optionalSocketEntry(abilities.get("super")), classAbility: optionalSocketEntry(abilities.get("class-ability")),
      movement: optionalSocketEntry(abilities.get("movement")), melee: optionalSocketEntry(abilities.get("melee")), grenade: optionalSocketEntry(grenade),
      transcendence: subclass === "prismatic" ? optionalSocketEntry(loadout.transcendence) : undefined,
      aspects: uniqueEntries(loadout.aspects.map(socketEntry)), fragments: uniqueEntries(loadout.fragments.map(socketEntry))
    },
    equipment: { weapons: loadout.equipment.filter(isWeapon).map(toEquipmentEntry), armor: loadout.equipment.filter(isArmor).map(toEquipmentEntry), armorSets: [] },
    armorMods,
    artifacts: loadout.artifact ? [{ ...itemEntry(loadout.artifact), perks: uniqueEntries(loadout.artifactMods.map(socketEntry)).slice(0, 7) }] : [],
    cosmetics: { shader, ornaments: uniqueEntries(ornaments) }, status: "draft", visibility: "private"
  };
}

export function storeLoadoutBuildImport(value: LoadoutBuildImport, storage: Storage = window.sessionStorage): string {
  const token = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  storage.setItem(`${IMPORT_PREFIX}${token}`, JSON.stringify(value));
  return token;
}

export function readLoadoutBuildImport(token: string, storage: Storage = window.sessionStorage): LoadoutBuildImport | undefined {
  if (!token) return undefined;
  try {
    const value = JSON.parse(storage.getItem(`${IMPORT_PREFIX}${token}`) || "null") as LoadoutBuildImport | null;
    return value?.version === 1 && value.document?.status === "draft" ? value : undefined;
  } catch { return undefined; }
}

export function removeLoadoutBuildImport(token: string, storage: Storage = window.sessionStorage): void { if (token) storage.removeItem(`${IMPORT_PREFIX}${token}`); }

function normalizeClass(value: string): BuildGuardianClass { const normalized = value.toLowerCase(); return normalized === "titan" || normalized === "warlock" ? normalized : "hunter"; }
function normalizeSubclass(loadout: GuardianLoadout): BuildSubclass { if (loadout.isPrismatic) return "prismatic"; const value = (loadout.element || "").toLowerCase() as BuildSubclass; return BUILD_SUBCLASSES.has(value) ? value : "prismatic"; }
function isWeapon(item: LoadoutItem): boolean { return /weapon/i.test(item.equipmentSlot) || /weapon|rifle|cannon|launcher|bow|glaive|sword/i.test(item.itemType); }
function isArmor(item: LoadoutItem): boolean { return Boolean(buildArmorSlot(item.equipmentSlot)); }
function buildArmorSlot(value: string): BuildArmorSlot | undefined {
  if (/helmet/i.test(value)) return "helmet"; if (/gauntlet|arms/i.test(value)) return "arms"; if (/chest/i.test(value)) return "chest";
  if (/leg/i.test(value)) return "legs"; if (/class armor|class item|cloak|mark|bond/i.test(value)) return "classItem"; return undefined;
}
function toEquipmentEntry(item: LoadoutItem): BuildEquipmentEntry {
  const sockets = loadoutItemMods(item);
  return { ...itemEntry(item), slot: item.equipmentSlot, exotic: /exotic/i.test(item.rarity),
    traits: uniqueEntries(sockets.filter((socket) => TRAIT_LABELS.has(socket.categoryLabel)).map(socketEntry)),
    selectedPerks: isWeapon(item) ? uniqueEntries(sockets.filter((socket) => WEAPON_PERK_LABELS.has(socket.categoryLabel)).map(socketEntry)) : [],
    selectedSpirits: uniqueEntries(sockets.filter((socket) => /^Spirit of\b/i.test(socket.name)).map(socketEntry)).slice(0, 2) };
}
function itemEntry(item: LoadoutItem): BuildNamedEntry { return { hash: item.itemHash || undefined, name: item.name, icon: item.icon || undefined, itemType: item.itemType || undefined, rarity: item.rarity || undefined }; }
function socketEntry(socket: LoadoutSocket): BuildNamedEntry { return { hash: socket.itemHash || undefined, name: socket.name, icon: socket.icon || undefined, itemType: socket.categoryLabel || undefined, description: socket.description || undefined }; }
function optionalSocketEntry(socket: LoadoutSocket | undefined): BuildNamedEntry | undefined { return socket ? socketEntry(socket) : undefined; }
function uniqueEntries<T extends BuildNamedEntry>(entries: T[]): T[] { return [...new Map(entries.filter((entry) => entry.name && entry.name !== "Socket definition unavailable").map((entry) => [entry.hash || `${entry.name}:${entry.itemType || ""}`, entry])).values()]; }
