import type { CompanionManifest, GearManifest } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { searchBuildCatalog } from "./buildCatalog";

const companion: CompanionManifest = {
  version: "test-manifest",
  generatedAt: "2026-07-16T00:00:00.000Z",
  bucketDefinitions: {},
  loadoutNameDefinitions: {},
  loadoutIconDefinitions: {},
  loadoutColorDefinitions: {},
  itemDefinitions: {
    "1": item("Prismatic Hunter", "Hunter Subclass", "/icons/prismatic.png"),
    "2": item("Combination Blow", "Arc Melee | Light Ability", "/icons/melee.png", "hunter.prism.melee"),
    "3": item("Firepower", "Arms Armor Mod", "/icons/firepower.png", "enhancements.v2_arms"),
    "4": { ...item("Gjallarhorn", "Rocket Launcher", "/icons/gjallarhorn.jpg"), itemType: 3, inventory: { tierTypeName: "Exotic" }, equipmentSlot: "Power Weapons", damageType: "Solar" },
    "5": item("Locked Armor Mod", "Arms Armor Mod", "/icons/locked.png", "enhancements.v2_arms")
  }
};

const gear: GearManifest = { version: "test-manifest", generatedAt: companion.generatedAt, gearItemDefinitions: {}, plugDefinitions: {}, statDefinitions: {} };

describe("build manifest catalog", () => {
  it("resolves official subclass and ability icons for the selected class and subclass", () => {
    const subclass = searchBuildCatalog(companion, gear, { kind: "subclass", q: "", classType: "hunter" });
    const melee = searchBuildCatalog(companion, gear, { kind: "melee", q: "combination", classType: "hunter", subclass: "prismatic" });
    expect(subclass[0]).toMatchObject({ hash: "1", subclass: "prismatic", classType: "hunter", icon: "https://www.bungie.net/icons/prismatic.png" });
    expect(melee[0]).toMatchObject({ hash: "2", kind: "melee", name: "Combination Blow" });
  });

  it("filters armor mods by slot and removes locked placeholders", () => {
    expect(searchBuildCatalog(companion, gear, { kind: "armorMod", q: "", slot: "arms" }).map((entry) => entry.name)).toEqual(["Firepower"]);
    expect(searchBuildCatalog(companion, gear, { kind: "armorMod", q: "", slot: "helmet" })).toEqual([]);
  });

  it("returns real weapon metadata and Exotic state", () => {
    expect(searchBuildCatalog(companion, gear, { kind: "weapon", q: "gjallar" })[0]).toMatchObject({ name: "Gjallarhorn", exotic: true, slot: "Power Weapons", damageType: "Solar" });
  });
});

function item(name: string, itemTypeDisplayName: string, icon: string, plugCategoryIdentifier?: string) {
  return {
    displayProperties: { name, icon, description: `${name} description` },
    itemTypeDisplayName,
    inventory: { tierTypeName: "Legendary" },
    ...(plugCategoryIdentifier ? { plug: { plugCategoryIdentifier } } : {})
  };
}
