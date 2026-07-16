import type { LoadoutItem, LoadoutSocket } from "@guardian-nexus/contracts";
import { expect, it } from "vitest";
import { loadoutItemSockets } from "./loadoutItemSockets";

const socket = (itemHash: string, category: LoadoutSocket["category"], definitionAvailable = true): LoadoutSocket => ({
  itemHash,
  name: `Socket ${itemHash}`,
  description: "",
  icon: "",
  category,
  categoryLabel: category,
  definitionAvailable
});

it("keeps resolved item-specific sockets while removing subclass duplicates and unresolved placeholders", () => {
  const item = {
    instanceId: "item-1", itemHash: "1", name: "Weapon", icon: "", itemType: "Weapon", rarity: "Legendary", equipmentSlot: "Kinetic", definitionAvailable: true,
    sockets: [socket("10", "modifier"), socket("11", "other"), socket("12", "super"), socket("0", "other"), socket("13", "other", false), socket("10", "modifier")]
  } satisfies LoadoutItem;

  expect(loadoutItemSockets(item).map((entry) => entry.itemHash)).toEqual(["10", "11"]);
});
