import type { CompanionManifest, GuardianLoadout, LoadoutItem, LoadoutSocket, LoadoutSocketCategory, LoadoutsData } from "@guardian-nexus/contracts";
import { imageUrl } from "@guardian-nexus/domain";
import type { CharacterSummary } from "@guardian-nexus/contracts";

const LOADOUT_EQUIP_RESTRICTION = "Bungie only allows loadout changes while offline, in orbit, or in a social space.";
const EQUIPMENT_SLOT_ORDER = ["Kinetic Weapons", "Energy Weapons", "Power Weapons", "Helmet", "Gauntlets", "Chest Armor", "Leg Armor", "Class Armor"];
const MAX_EQUIPPED_ARTIFACT_PERKS = 7;

export function normalizeLoadouts(profile: any, manifest: CompanionManifest, character: CharacterSummary): LoadoutsData {
  const instances = inventoryInstances(profile);
  const loadoutRows = profile?.characterLoadouts?.data?.[character.characterId]?.loadouts || [];
  const loadouts = (loadoutRows as any[]).flatMap((row, index): GuardianLoadout[] => {
    const savedItems = Array.isArray(row?.items) ? row.items.filter(hasSavedItem) : [];
    if (savedItems.length === 0) return [];
    const items: LoadoutItem[] = savedItems.map((item: any) => normalizeLoadoutItem(item, instances, manifest));
    const allSockets = dedupeSockets(items.flatMap((item) => item.sockets));
    const subclass = items.find((item) => Number((manifest.itemDefinitions[item.itemHash] as any)?.itemType) === 16 || /subclass/i.test(item.equipmentSlot));
    const artifact = items.find((item) => /^Artifacts?$/i.test(item.equipmentSlot) || item.sockets.some((socket) => socket.category === "artifact-perk"));
    const artifactMods = dedupeSockets(artifact?.sockets.filter((socket) => (socket.category === "artifact-perk" || !socket.definitionAvailable) && !/^Empty Artifact Mod$/i.test(socket.name)) || [])
      .slice(0, MAX_EQUIPPED_ARTIFACT_PERKS);
    const element = elementFromSockets(subclass?.sockets || allSockets, manifest);
    const isPrismatic = element === "Prismatic" || /prismatic/i.test(subclass?.name || "");
    return [{
      index,
      name: String((manifest.loadoutNameDefinitions[String(row.nameHash || "")] as any)?.name || "Loadout name unavailable"),
      icon: imageUrl((manifest.loadoutIconDefinitions[String(row.iconHash || "")] as any)?.iconImagePath),
      color: imageUrl((manifest.loadoutColorDefinitions[String(row.colorHash || "")] as any)?.colorImagePath),
      element,
      items,
      equipment: equipmentItems(items, subclass),
      subclass,
      artifact,
      artifactMods,
      isPrismatic,
      transcendence: isPrismatic ? allSockets.find((socket) => socket.category === "transcendence") : undefined,
      prismaticGrenade: isPrismatic ? allSockets.find((socket) => socket.category === "prismatic-grenade") : undefined,
      abilities: allSockets.filter((socket) => ["super", "melee", "grenade", "class-ability", "movement"].includes(socket.category)),
      aspects: allSockets.filter((socket) => socket.category === "aspect"),
      fragments: allSockets.filter((socket) => socket.category === "fragment"),
      modifiers: allSockets.filter((socket) => socket.category === "modifier" || socket.category === "other"),
      unresolvedItemCount: items.filter((item) => !item.definitionAvailable).length
    }];
  });
  return {
    manifestVersion: manifest.version,
    characterId: character.characterId,
    characterClass: character.className,
    loadouts,
    artifact: {
      mods: [],
      source: "saved-loadout-compatibility",
      limitation: "Artifact data is saved per loadout; use each loadout's artifact and artifactMods fields."
    },
    equipRestriction: LOADOUT_EQUIP_RESTRICTION
  };
}

function equipmentItems(items: LoadoutItem[], subclass: LoadoutItem | undefined): LoadoutItem[] {
  return items
    .filter((item) => item !== subclass && !/^Artifacts?$/i.test(item.equipmentSlot))
    .sort((left, right) => equipmentSlotIndex(left.equipmentSlot) - equipmentSlotIndex(right.equipmentSlot));
}

function equipmentSlotIndex(slot: string): number {
  const index = EQUIPMENT_SLOT_ORDER.findIndex((entry) => entry.toLowerCase() === slot.toLowerCase());
  return index === -1 ? EQUIPMENT_SLOT_ORDER.length : index;
}

function hasSavedItem(row: any): boolean {
  const instanceId = String(row?.itemInstanceId || "");
  return Boolean(instanceId && instanceId !== "0");
}

function inventoryInstances(profile: any): Map<string, any> {
  const result = new Map<string, any>();
  const collect = (container: any) => {
    for (const item of container?.items || []) {
      const instanceId = String(item?.itemInstanceId || "");
      if (instanceId) result.set(instanceId, item);
    }
  };
  collect(profile?.profileInventory?.data);
  Object.values(profile?.characterInventories?.data || {}).forEach(collect);
  Object.values(profile?.characterEquipment?.data || {}).forEach(collect);
  return result;
}

function normalizeLoadoutItem(row: any, instances: Map<string, any>, manifest: CompanionManifest): LoadoutItem {
  const instanceId = String(row?.itemInstanceId || "");
  const inventoryItem = instances.get(instanceId);
  const itemHash = String(inventoryItem?.itemHash || "");
  const definition = manifest.itemDefinitions[itemHash] as any;
  const properties = definition?.displayProperties || {};
  const definitionAvailable = Boolean(properties.name);
  return {
    instanceId,
    itemHash,
    name: String(properties.name || "Saved item unavailable"),
    icon: imageUrl(properties.icon),
    itemType: String(definition?.itemTypeDisplayName || "Bungie no longer returns this saved item instance"),
    rarity: String(definition?.inventory?.tierTypeName || "Definition unavailable"),
    equipmentSlot: String(definition?.equipmentSlot || "Unavailable saved item"),
    definitionAvailable,
    sockets: (row?.plugItemHashes || []).map((value: unknown) => normalizeSocket(String(value || ""), manifest))
  };
}

function normalizeSocket(itemHash: string, manifest: CompanionManifest): LoadoutSocket {
  const definition = manifest.itemDefinitions[itemHash] as any;
  const properties = definition?.displayProperties || {};
  const identifier = String(definition?.plug?.plugCategoryIdentifier || "");
  const category = socketCategory(identifier);
  return {
    itemHash,
    name: String(properties.name || "Socket definition unavailable"),
    description: String(properties.description || ""),
    icon: imageUrl(properties.icon),
    category,
    categoryLabel: socketCategoryLabel(category, identifier),
    definitionAvailable: Boolean(properties.name)
  };
}

function socketCategory(identifier: string): LoadoutSocketCategory {
  if (/\.transcendence$/.test(identifier)) return "transcendence";
  if (/\.prism_grenade$/.test(identifier)) return "prismatic-grenade";
  if (/^artifact_perks$/.test(identifier)) return "artifact-perk";
  if (/\.supers?$/.test(identifier)) return "super";
  if (/\.melee$/.test(identifier)) return "melee";
  if (/\.grenades?$/.test(identifier)) return "grenade";
  if (/\.class_abilities$/.test(identifier)) return "class-ability";
  if (/\.movement$/.test(identifier)) return "movement";
  if (/\.aspects$/.test(identifier)) return "aspect";
  if (/\.fragments$/.test(identifier)) return "fragment";
  if (/mod|enhancement|trait|perk|masterwork/i.test(identifier)) return "modifier";
  return "other";
}

function socketCategoryLabel(category: LoadoutSocketCategory, identifier: string): string {
  if (/shader/i.test(identifier)) return "Shader";
  if (/ornament|skin/i.test(identifier)) return "Ornament";
  if (/catalyst/i.test(identifier)) return "Catalyst";
  if (/memento/i.test(identifier)) return "Memento";
  if (/origin/i.test(identifier)) return "Origin Trait";
  if (/intrinsic|frame/i.test(identifier)) return "Intrinsic";
  if (/barrel/i.test(identifier)) return "Barrel";
  if (/scope/i.test(identifier)) return "Scope";
  if (/magazine|magazines|batter|tube/i.test(identifier)) return "Magazine";
  if (/guard/i.test(identifier)) return "Guard";
  if (/masterwork/i.test(identifier)) return "Masterwork";
  if (/tracker/i.test(identifier)) return "Tracker";
  if (/weapon.*mod|mod.*weapon/i.test(identifier)) return "Weapon Mod";
  if (/armor.*mod|enhancement/i.test(identifier)) return "Armor Mod";
  if (/trait|perk/i.test(identifier)) return "Perk";
  const labels: Record<LoadoutSocketCategory, string> = {
    element: "Element",
    super: "Super",
    melee: "Melee",
    grenade: "Grenade",
    "prismatic-grenade": "Prismatic Grenade",
    transcendence: "Transcendence",
    "class-ability": "Class Ability",
    movement: "Movement",
    aspect: "Aspect",
    fragment: "Fragment",
    "artifact-perk": "Artifact Mod",
    modifier: "Modifier",
    other: "Socket"
  };
  return labels[category];
}

function elementFromSockets(sockets: LoadoutSocket[], manifest: CompanionManifest): string | undefined {
  const text = sockets.map((socket) => {
    const definition = manifest.itemDefinitions[socket.itemHash] as any;
    return `${socket.name} ${socket.description} ${definition?.plug?.plugCategoryIdentifier || ""}`;
  }).join(" ").toLowerCase();
  for (const element of ["Prismatic", "Strand", "Stasis", "Solar", "Void", "Arc"]) {
    if (text.includes(element.toLowerCase())) return element;
  }
  return undefined;
}

function dedupeSockets(sockets: LoadoutSocket[]): LoadoutSocket[] {
  return [...new Map(sockets.map((socket) => [socket.itemHash, socket])).values()];
}
