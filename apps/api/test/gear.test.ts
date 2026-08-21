import { describe, expect, it } from "vitest";
import { normalizeGear } from "../src/gear";

describe("normalizeGear", () => {
  it("normalizes physical weapon rolls, selectable perks, and explainable duplicate review state", () => {
    const profile = {
      profileInventory: { data: { items: [
        { itemHash: 11, itemInstanceId: "101" },
        { itemHash: 11, itemInstanceId: "102" }
      ] } },
      itemComponents: {
        sockets: { data: {
          "101": { sockets: [{ plugHash: 21 }, { plugHash: 22 }, { plugHash: 23 }] },
          "102": { sockets: [{ plugHash: 21 }, { plugHash: 24 }, { plugHash: 23 }] }
        } },
        reusablePlugs: { data: {
          "101": { plugs: { "1": [{ plugItemHash: 22 }, { plugItemHash: 24 }] } },
          "102": { plugs: { "1": [{ plugItemHash: 22 }, { plugItemHash: 24 }] } }
        } },
        instances: { data: {
          "101": { primaryStat: { value: 500 }, isCrafted: true, gearTier: 4 },
          "102": { primaryStat: { value: 500 }, gearTier: 2 }
        } },
        state: { data: {} }
      }
    };
    const manifest: any = {
      version: "weapon-test", generatedAt: "now",
      gearItemDefinitions: { "11": { itemType: 3, itemTypeDisplayName: "Auto Rifle", defaultDamageType: 2, inventory: { tierTypeName: "Legendary", bucketTypeHash: "2465295065" }, displayProperties: { name: "Test Rifle", icon: "/rifle.png" } } },
      weaponPerkColumns: { "11": [[], [], ["22", "24", "25"], []] },
      plugDefinitions: {
        "21": { hash: 21, itemTypeDisplayName: "Intrinsic", displayProperties: { name: "Adaptive Frame" }, plug: { plugCategoryIdentifier: "weapon.intrinsics" } },
        "22": { hash: 22, itemTypeDisplayName: "Trait", displayProperties: { name: "Incandescent" }, plug: { plugCategoryIdentifier: "weapon.traits" } },
        "23": { hash: 23, itemTypeDisplayName: "Origin Trait", displayProperties: { name: "Test Origin" }, plug: { plugCategoryIdentifier: "weapon.origin_traits" } },
        "24": { hash: 24, itemTypeDisplayName: "Trait", displayProperties: { name: "Target Lock" }, plug: { plugCategoryIdentifier: "weapon.traits" } },
        "25": { hash: 25, itemTypeDisplayName: "Trait", displayProperties: { name: "Onslaught" }, plug: { plugCategoryIdentifier: "weapon.traits" } }
      }, statDefinitions: {}
    };

    const data = normalizeGear(profile, manifest, "character", "Warlock", new Map(), "2026-08-01T00:00:00Z");
    expect(data.gearSchemaVersion).toBe(2);
    expect(data.weapons).toHaveLength(2);
    expect(data.weapons?.[0]).toMatchObject({ name: "Test Rifle", slot: "Energy", damageType: "Arc", gearTier: 4, crafted: true, duplicateCount: 2, reviewState: "configured" });
    const traitColumn = data.weapons?.[0]?.perkColumns.find((column) => column.ratingColumn === 2);
    expect(traitColumn).toMatchObject({ ratingColumn: 2, active: { name: "Incandescent" }, options: expect.arrayContaining([expect.objectContaining({ name: "Target Lock" })]) });
    expect(traitColumn?.options.map((perk) => perk.name)).toEqual(expect.arrayContaining(["Incandescent", "Target Lock", "Onslaught"]));
    expect(data.weapons?.[1]).toMatchObject({ gearTier: 2, duplicateCount: 2, reviewState: "duplicate-review" });
  });

  it("uses Bungie manifest imagery and separates base from active adjustments", () => {
    const profile = {
      profileInventory: { data: { items: [{ itemHash: 10, itemInstanceId: "100", state: 1 }] } },
      itemComponents: {
        stats: { data: { "100": { stats: { "392767087": { value: 20 }, "4244567218": { value: 10 } } } } },
        sockets: { data: { "100": { sockets: [{ plugHash: 20 }] } } }, instances: { data: { "100": { primaryStat: { value: 500 } } } }, state: { data: {} }
      }
    };
    const manifest: any = { version: "test", generatedAt: "now", gearItemDefinitions: { "10": { itemType: 2, classType: 2, itemTypeDisplayName: "Helmet", inventory: { tierTypeName: "Legendary" }, displayProperties: { name: "Test Helm", icon: "/item.png" } } }, plugDefinitions: { "20": { hash: 20, displayProperties: { name: "Armor Mod", icon: "/mod.png" }, plug: { plugCategoryIdentifier: "armor.mod" }, investmentStats: [{ statTypeHash: 392767087, value: 5 }] } }, statDefinitions: { "392767087": { displayProperties: { icon: "/health.png" } } } };
    const data = normalizeGear(profile, manifest, "character", "Warlock", new Map(), "2026-07-15T00:00:00Z");
    expect(data.items[0]).toMatchObject({ name: "Test Helm", icon: "https://www.bungie.net/item.png", locked: true, baseStats: { health: 15 }, currentStats: { health: 20 } });
    expect(data.statIcons.health).toBe("https://www.bungie.net/health.png");
  });

  it("uses the equipped ornament and resolves the Armor 3.0 tuned stat from reusable tuning plugs", () => {
    const profile = {
      profileInventory: { data: { items: [{ itemHash: 10, itemInstanceId: "100", state: 4 }] } },
      itemComponents: {
        stats: { data: { "100": { stats: { "1735777505": { value: 22 } } } } },
        sockets: { data: { "100": { sockets: [{ plugHash: 30 }, { plugHash: 40 }] } } },
        reusablePlugs: { data: { "100": { plugs: { "1": [{ plugItemHash: 41 }, { plugItemHash: 42 }, { plugItemHash: 43 }] } } } },
        instances: { data: { "100": { primaryStat: { value: 550 }, gearTier: 5 } } },
        state: { data: {} }
      }
    };
    const manifest: any = {
      version: "test", generatedAt: "now",
      gearItemDefinitions: { "10": { itemType: 2, classType: 2, itemTypeDisplayName: "Helmet", inventory: { tierTypeName: "Legendary" }, displayProperties: { name: "Test Helm", icon: "/item.png" } } },
      plugDefinitions: {
        "30": { hash: 30, displayProperties: { name: "Current Armor Ornament", icon: "/ornament.png" }, itemTypeDisplayName: "Universal Ornament", plug: { plugCategoryIdentifier: "armor_skins" } },
        "40": { hash: 40, displayProperties: { name: "Empty Tuning Mod Socket", icon: "/tuning.png" }, plug: { plugCategoryIdentifier: "core.gear_systems.armor_tiering.plugs.tuning.mods" } },
        "41": { hash: 41, displayProperties: { name: "+Grenade / -Melee" }, plug: { plugCategoryIdentifier: "core.gear_systems.armor_tiering.plugs.tuning.mods" }, investmentStats: [{ statTypeHash: 1735777505, value: 5 }, { statTypeHash: 4244567218, value: -5 }] },
        "42": { hash: 42, displayProperties: { name: "+Grenade / -Health" }, plug: { plugCategoryIdentifier: "core.gear_systems.armor_tiering.plugs.tuning.mods" }, investmentStats: [{ statTypeHash: 1735777505, value: 5 }, { statTypeHash: 392767087, value: -5 }] },
        "43": { hash: 43, displayProperties: { name: "Balanced Tuning" }, plug: { plugCategoryIdentifier: "core.gear_systems.armor_tiering.plugs.tuning.mods" }, investmentStats: [{ statTypeHash: 392767087, value: 1 }, { statTypeHash: 4244567218, value: 1 }, { statTypeHash: 1735777505, value: 1 }] }
      }, statDefinitions: {}
    };
    const item = normalizeGear(profile, manifest, "character", "Warlock", new Map(), "2026-07-15T00:00:00Z").items[0];
    expect(item).toMatchObject({ icon: "https://www.bungie.net/ornament.png", masterworked: true, gearTier: 5, tunedStat: "grenade" });
  });

  it("keeps archetype stats in base and applies Armor 3.0 masterwork only to zero-base secondary stats", () => {
    const profile = {
      profileInventory: { data: { items: [{ itemHash: 10, itemInstanceId: "100", state: 4 }] } },
      itemComponents: {
        stats: { data: { "100": { stats: {
          "392767087": { value: 20 }, "4244567218": { value: 15 }, "1735777505": { value: 10 },
          "144602215": { value: 5 }, "1943323491": { value: 15 }, "2996146975": { value: 5 }
        } } } },
        sockets: { data: { "100": { sockets: [{ plugHash: 50 }, { plugHash: 51 }, { plugHash: 52 }] } } },
        instances: { data: { "100": { gearTier: 5 } } }, state: { data: {} }
      }
    };
    const conditionalMasterworkStats = [144602215, 1943323491, 2996146975].map((statTypeHash) => ({ statTypeHash, value: 5, isConditionallyActive: true }));
    const manifest: any = {
      version: "test", generatedAt: "now",
      gearItemDefinitions: { "10": { itemType: 2, classType: 2, itemTypeDisplayName: "Helmet", inventory: { tierTypeName: "Legendary" }, displayProperties: { name: "Test Helm" } } },
      plugDefinitions: {
        "50": { hash: 50, displayProperties: { name: "Paragon" }, plug: { plugCategoryIdentifier: "armor.archetype" }, investmentStats: [{ statTypeHash: 392767087, value: 20 }, { statTypeHash: 4244567218, value: 15 }, { statTypeHash: 1735777505, value: 10 }] },
        "51": { hash: 51, displayProperties: { name: "Tier 5 Armor Masterwork" }, plug: { plugCategoryIdentifier: "v460.plugs.armor.masterworks" }, investmentStats: conditionalMasterworkStats },
        "52": { hash: 52, displayProperties: { name: "Class Mod" }, plug: { plugCategoryIdentifier: "armor.mod" }, investmentStats: [{ statTypeHash: 1943323491, value: 10 }] }
      }, statDefinitions: {}
    };

    const item = normalizeGear(profile, manifest, "character", "Warlock", new Map(), "2026-07-15T00:00:00Z").items[0]!;
    expect(item.baseStats).toMatchObject({ health: 20, melee: 15, grenade: 10, super: 0, class: 0, weapons: 0 });
    expect(item.adjustments).toEqual(expect.arrayContaining([
      { type: "masterwork", stats: expect.objectContaining({ super: 5, class: 5, weapons: 5 }) },
      { type: "mod", stats: expect.objectContaining({ class: 10 }) }
    ]));
  });
});
