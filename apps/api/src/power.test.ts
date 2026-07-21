import { describe, expect, it } from "vitest";
import { normalizePower, powerItemHashes } from "./power";

const slotNames = ["Kinetic Weapons", "Energy Weapons", "Power Weapons", "Helmet", "Gauntlets", "Chest Armor", "Leg Armor", "Class Armor"];
const definitions = Object.fromEntries(slotNames.map((equipmentSlot, index) => [String(index + 1), {
  itemType: index < 3 ? 3 : 2,
  classType: index < 3 ? 3 : 2,
  itemTypeDisplayName: equipmentSlot,
  equipmentSlot,
  displayProperties: { name: `Item ${index + 1}`, icon: `/item-${index + 1}.png` }
}]));

describe("normalizePower", () => {
  it("finds the highest transferable item for all eight slots and identifies the lowest slot", () => {
    const inventoryItems = slotNames.map((_, index) => ({ itemHash: index + 1, itemInstanceId: String(100 + index) }));
    const profile = {
      characters: { data: { c1: { characterId: "c1", classType: 2, raceType: 0, light: 548, emblemPath: "/emblem.png" } } },
      profileInventory: { data: { items: inventoryItems } },
      characterInventories: { data: { c1: { items: [{ itemHash: 1, itemInstanceId: "999" }] } } },
      characterEquipment: { data: { c1: { items: [] } } },
      itemComponents: { instances: { data: {
        ...Object.fromEntries(inventoryItems.map((item, index) => [item.itemInstanceId, { primaryStat: { value: index === 6 ? 545 : 550 } }])),
        "999": { primaryStat: { value: 550 } }
      } } }
    };

    const data = normalizePower(profile, definitions, "c1");
    expect(data).toMatchObject({ accountMaximumPower: 549, highestItemPower: 550, vaultHighestItemPower: 550 });
    expect(data.characters[0]).toMatchObject({ maximumPower: 549, progressToNextPower: 3, lowestSlotPower: 545 });
    expect(data.characters[0]?.slots.find((slot) => slot.kind === "legs")).toMatchObject({ power: 545, deficit: 5, lowest: true, item: { location: "vault" } });
    expect(data.characters[0]?.slots.find((slot) => slot.kind === "kinetic")?.item).toMatchObject({ instanceId: "999", location: "inventory" });
    expect(powerItemHashes(profile)).toEqual(expect.arrayContaining(slotNames.map((_, index) => String(index + 1))));
  });
});
