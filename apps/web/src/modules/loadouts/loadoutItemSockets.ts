import type { LoadoutItem, LoadoutSocket } from "@guardian-nexus/contracts";

const SUBCLASS_CATEGORIES = new Set(["super", "melee", "grenade", "class-ability", "movement", "aspect", "fragment"]);

export function loadoutItemSockets(item: LoadoutItem): LoadoutSocket[] {
  return [...new Map(item.sockets
    .filter((socket) => socket.definitionAvailable && socket.itemHash && socket.itemHash !== "0" && !SUBCLASS_CATEGORIES.has(socket.category))
    .map((socket) => [socket.itemHash, socket])).values()];
}
