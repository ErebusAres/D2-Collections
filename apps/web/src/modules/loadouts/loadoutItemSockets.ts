import type { LoadoutItem, LoadoutSocket } from "@guardian-nexus/contracts";

const SUBCLASS_CATEGORIES = new Set(["super", "melee", "grenade", "prismatic-grenade", "transcendence", "class-ability", "movement", "aspect", "fragment", "artifact-perk"]);
const COSMETIC_LABELS = new Set(["Ornament", "Shader"]);

export function loadoutItemSockets(item: LoadoutItem): LoadoutSocket[] {
  return [...new Map(item.sockets
    .filter((socket) => socket.definitionAvailable && socket.itemHash && socket.itemHash !== "0" && !SUBCLASS_CATEGORIES.has(socket.category))
    .map((socket) => [socket.itemHash, socket])).values()];
}

export function loadoutItemCosmetics(item: LoadoutItem): LoadoutSocket[] {
  return loadoutItemSockets(item).filter((socket) => COSMETIC_LABELS.has(socket.categoryLabel));
}

export function loadoutItemMods(item: LoadoutItem): LoadoutSocket[] {
  return loadoutItemSockets(item).filter((socket) => !COSMETIC_LABELS.has(socket.categoryLabel));
}
