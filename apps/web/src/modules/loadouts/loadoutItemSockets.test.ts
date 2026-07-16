import type { LoadoutItem, LoadoutSocket } from "@guardian-nexus/contracts";
import { expect, it } from "vitest";
import { loadoutItemCosmetics, loadoutItemMods, loadoutItemSockets } from "./loadoutItemSockets";

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

it("separates ornament and shader icons from vertically listed equipment mods", () => {
  const ornament = { ...socket("10", "other"), categoryLabel: "Ornament" };
  const shader = { ...socket("11", "other"), categoryLabel: "Shader" };
  const mod = { ...socket("12", "modifier"), categoryLabel: "Weapon Mod" };
  const item = {
    instanceId: "item-1", itemHash: "1", name: "Weapon", icon: "", itemType: "Weapon", rarity: "Legendary", equipmentSlot: "Kinetic Weapons", definitionAvailable: true,
    sockets: [ornament, shader, mod]
  } satisfies LoadoutItem;

  expect(loadoutItemCosmetics(item).map((entry) => entry.itemHash)).toEqual(["10", "11"]);
  expect(loadoutItemMods(item).map((entry) => entry.itemHash)).toEqual(["12"]);
});
