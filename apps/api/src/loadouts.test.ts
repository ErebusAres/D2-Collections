import { describe, expect, it } from "vitest";
import { normalizeLoadouts } from "./loadouts";

describe("loadout normalization", () => {
  it("keeps current equipment separate and marks missing live socket data partial", () => {
    const profile = {
      characterEquipment: { data: { c1: { items: [
        { itemInstanceId: "subclass", itemHash: 10 },
        { itemInstanceId: "weapon", itemHash: 20 }
      ] } } },
      characterInventories: { data: {} },
      profileInventory: { data: { items: [] } },
      characterLoadouts: { data: { c1: { loadouts: [] } } },
      itemComponents: { sockets: { data: {
        subclass: { sockets: [{ plugHash: 100 }] }
      } } }
    };
    const manifest = {
      version: "test",
      itemDefinitions: {
        "10": definition("Prismatic Hunter", "Subclass", "Subclass", 16),
        "20": definition("Test Rifle", "Auto Rifle", "Kinetic Weapons", 3),
        "100": { displayProperties: { name: "Golden Gun", description: "Solar super" }, plug: { plugCategoryIdentifier: "hunter.supers" } }
      },
      loadoutNameDefinitions: {}, loadoutIconDefinitions: {}, loadoutColorDefinitions: {}
    };

    const result = normalizeLoadouts(profile, manifest as any, { characterId: "c1", className: "Hunter" } as any);

    expect(result.equippedState).toBe("partial");
    expect(result.equipped?.name).toBe("Equipped");
    expect(result.equipped?.subclass?.name).toBe("Prismatic Hunter");
    expect(result.equipped?.equipment.map((item) => item.name)).toEqual(["Test Rifle"]);
    expect(result.equipped?.abilities.map((socket) => socket.name)).toEqual(["Golden Gun"]);
    expect(result.loadouts).toEqual([]);
  });

  it("reports equipped data unavailable instead of inventing an empty set", () => {
    const result = normalizeLoadouts({ characterLoadouts: { data: {} } }, { version: "test", itemDefinitions: {}, loadoutNameDefinitions: {}, loadoutIconDefinitions: {}, loadoutColorDefinitions: {} } as any, { characterId: "c1", className: "Hunter" } as any);
    expect(result.equippedState).toBe("unavailable");
    expect(result.equipped).toBeUndefined();
  });
});

function definition(name: string, itemTypeDisplayName: string, equipmentSlot: string, itemType: number) {
  return { displayProperties: { name, icon: `/${name}.png` }, itemTypeDisplayName, itemType, equipmentSlot, inventory: { tierTypeName: "Exotic" } };
}
