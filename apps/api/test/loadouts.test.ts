import { describe, expect, it } from "vitest";
import { normalizeLoadouts } from "../src/loadouts";

describe("normalizeLoadouts", () => {
  it("resolves saved items, abilities, subclass element, identifiers, and modifiers", () => {
    const profile = {
      profileInventory: { data: { items: [{ itemHash: 20, itemInstanceId: "200" }] } },
      characterEquipment: { data: { c1: { items: [{ itemHash: 10, itemInstanceId: "100" }] } } },
      characterLoadouts: { data: { c1: { loadouts: [{
        nameHash: 1, iconHash: 2, colorHash: 3,
        items: [
          { itemInstanceId: "100", plugItemHashes: [30, 31, 32, 33] },
          { itemInstanceId: "200", plugItemHashes: [40] }
        ]
      }] } } }
    };
    const manifest: any = {
      version: "test", generatedAt: "now", bucketDefinitions: {},
      loadoutNameDefinitions: { "1": { name: "Raid" } },
      loadoutIconDefinitions: { "2": { iconImagePath: "/loadout.png" } },
      loadoutColorDefinitions: { "3": { colorImagePath: "/color.jpg" } },
      itemDefinitions: {
        "10": { itemType: 16, displayProperties: { name: "Gunslinger", icon: "/subclass.png" }, itemTypeDisplayName: "Hunter Subclass", inventory: { tierTypeName: "Legendary" }, equipmentSlot: "Subclass" },
        "20": { itemType: 3, displayProperties: { name: "Test Weapon", icon: "/weapon.png" }, itemTypeDisplayName: "Hand Cannon", inventory: { tierTypeName: "Legendary" }, equipmentSlot: "Kinetic Weapons" },
        "30": { displayProperties: { name: "Golden Gun", icon: "/super.png" }, plug: { plugCategoryIdentifier: "hunter.solar.supers" } },
        "31": { displayProperties: { name: "Knife Trick", icon: "/melee.png" }, plug: { plugCategoryIdentifier: "hunter.solar.melee" } },
        "32": { displayProperties: { name: "Healing Grenade", icon: "/grenade.png" }, plug: { plugCategoryIdentifier: "shared.solar.grenades" } },
        "33": { displayProperties: { name: "On Your Mark", icon: "/aspect.png" }, plug: { plugCategoryIdentifier: "hunter.solar.aspects" } },
        "40": { displayProperties: { name: "Backup Mag", icon: "/mod.png" }, plug: { plugCategoryIdentifier: "weapon.mod" } }
      }
    };
    const character: any = { characterId: "c1", className: "Hunter", emblemPath: "", emblemBackgroundPath: "", power: 400, raceName: "Human", dateLastPlayed: "", minutesPlayedThisSession: 0 };

    const data = normalizeLoadouts(profile, manifest, character);
    expect(data.loadouts[0]).toMatchObject({ name: "Raid", element: "Solar", unresolvedItemCount: 0 });
    expect(data.loadouts[0]?.abilities.map((ability) => ability.category)).toEqual(["super", "melee", "grenade"]);
    expect(data.loadouts[0]?.aspects[0]).toMatchObject({ name: "On Your Mark", category: "aspect" });
    expect(data.loadouts[0]?.modifiers[0]).toMatchObject({ name: "Backup Mag", category: "modifier" });
  });

  it("omits empty and placeholder loadout slots while preserving saved slot indexes", () => {
    const profile = {
      characterEquipment: { data: { c1: { items: [{ itemHash: 10, itemInstanceId: "100" }] } } },
      characterLoadouts: { data: { c1: { loadouts: [
        { nameHash: 1, items: [] },
        { nameHash: 2, items: [{ itemInstanceId: "0", plugItemHashes: [] }] },
        { nameHash: 3, items: [{ plugItemHashes: [] }] },
        { nameHash: 4, items: [{ itemInstanceId: "100", plugItemHashes: [] }] }
      ] } } }
    };
    const manifest: any = {
      version: "test", generatedAt: "now", bucketDefinitions: {},
      loadoutNameDefinitions: { "4": { name: "Saved Loadout" } },
      loadoutIconDefinitions: {}, loadoutColorDefinitions: {},
      itemDefinitions: {
        "10": { displayProperties: { name: "Saved Weapon", icon: "/weapon.png" }, itemTypeDisplayName: "Weapon", inventory: { tierTypeName: "Legendary" }, equipmentSlot: "Kinetic Weapons" }
      }
    };
    const character: any = { characterId: "c1", className: "Hunter", emblemPath: "", emblemBackgroundPath: "", power: 400, raceName: "Human", dateLastPlayed: "", minutesPlayedThisSession: 0 };

    const data = normalizeLoadouts(profile, manifest, character);

    expect(data.loadouts).toHaveLength(1);
    expect(data.loadouts[0]).toMatchObject({ index: 3, name: "Saved Loadout" });
  });

  it("keeps a stale saved item reference and explains that Bungie no longer resolves it", () => {
    const profile = { characterLoadouts: { data: { c1: { loadouts: [{ items: [{ itemInstanceId: "999", plugItemHashes: [] }] }] } } } };
    const manifest: any = { version: "test", generatedAt: "now", bucketDefinitions: {}, loadoutNameDefinitions: {}, loadoutIconDefinitions: {}, loadoutColorDefinitions: {}, itemDefinitions: {} };
    const character: any = { characterId: "c1", className: "Hunter", emblemPath: "", emblemBackgroundPath: "", power: 400, raceName: "Human", dateLastPlayed: "", minutesPlayedThisSession: 0 };

    const data = normalizeLoadouts(profile, manifest, character);

    expect(data.loadouts[0]).toMatchObject({ unresolvedItemCount: 1, items: [{ instanceId: "999", name: "Saved item unavailable", equipmentSlot: "Unavailable saved item", definitionAvailable: false }] });
  });
});
