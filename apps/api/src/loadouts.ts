import type { CompanionManifest, GuardianLoadout, LoadoutItem, LoadoutSocket, LoadoutSocketCategory, LoadoutsData } from "@guardian-nexus/contracts";
import { imageUrl } from "@guardian-nexus/domain";
import type { CharacterSummary } from "@guardian-nexus/contracts";

const LOADOUT_EQUIP_RESTRICTION = "Bungie only allows loadout changes while offline, in orbit, or in a social space.";

export function normalizeLoadouts(profile: any, manifest: CompanionManifest, character: CharacterSummary): LoadoutsData {
  const instances = inventoryInstances(profile);
  const loadoutRows = profile?.characterLoadouts?.data?.[character.characterId]?.loadouts || [];
  const loadouts = (loadoutRows as any[]).flatMap((row, index): GuardianLoadout[] => {
    if (!row || !Array.isArray(row.items) || row.items.length === 0) return [];
    const items: LoadoutItem[] = row.items.map((item: any) => normalizeLoadoutItem(item, instances, manifest));
    const allSockets = dedupeSockets(items.flatMap((item) => item.sockets));
    const subclass = items.find((item) => Number((manifest.itemDefinitions[item.itemHash] as any)?.itemType) === 16 || /subclass/i.test(item.equipmentSlot));
    const element = elementFromSockets(subclass?.sockets || allSockets, manifest);
    return [{
      index,
      name: String((manifest.loadoutNameDefinitions[String(row.nameHash || "")] as any)?.name || "Loadout name unavailable"),
      icon: imageUrl((manifest.loadoutIconDefinitions[String(row.iconHash || "")] as any)?.iconImagePath),
      color: imageUrl((manifest.loadoutColorDefinitions[String(row.colorHash || "")] as any)?.colorImagePath),
      element,
      items,
      subclass,
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
    equipRestriction: LOADOUT_EQUIP_RESTRICTION
  };
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
    name: String(properties.name || "Item definition unavailable"),
    icon: imageUrl(properties.icon),
    itemType: String(definition?.itemTypeDisplayName || "Item type unavailable"),
    rarity: String(definition?.inventory?.tierTypeName || "Rarity unavailable"),
    equipmentSlot: String(definition?.equipmentSlot || "Slot unavailable"),
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
    categoryLabel: socketCategoryLabel(category),
    definitionAvailable: Boolean(properties.name)
  };
}

function socketCategory(identifier: string): LoadoutSocketCategory {
  if (/\.supers?$/.test(identifier)) return "super";
  if (/\.melee$/.test(identifier)) return "melee";
  if (/\.grenades?$|\.prism_grenade$/.test(identifier)) return "grenade";
  if (/\.class_abilities$/.test(identifier)) return "class-ability";
  if (/\.movement$/.test(identifier)) return "movement";
  if (/\.aspects$/.test(identifier)) return "aspect";
  if (/\.fragments$/.test(identifier)) return "fragment";
  if (/mod|enhancement|trait|perk|masterwork/i.test(identifier)) return "modifier";
  return "other";
}

function socketCategoryLabel(category: LoadoutSocketCategory): string {
  const labels: Record<LoadoutSocketCategory, string> = {
    element: "Element",
    super: "Super",
    melee: "Melee",
    grenade: "Grenade",
    "class-ability": "Class Ability",
    movement: "Movement",
    aspect: "Aspect",
    fragment: "Fragment",
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
