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

  it("orders equipment, separates Prismatic configuration, and keeps only seven equipped Artifact perks", () => {
    const equipment = [
      ["100", 10], ["101", 11], ["102", 12], ["103", 13], ["104", 14],
      ["105", 15], ["106", 16], ["107", 17], ["108", 18], ["109", 19]
    ].map(([itemInstanceId, itemHash]) => ({ itemInstanceId, itemHash }));
    const savedOrder = ["107", "102", "105", "100", "109", "104", "108", "106", "101", "103"];
    const profile = {
      characterEquipment: { data: { c1: { items: equipment } } },
      characterProgressions: { data: { c1: { seasonalArtifact: {
        artifactHash: 9000,
        pointsUsed: 1,
        tiers: [{ items: [{ itemHash: 57, isActive: true, isVisible: true }] }]
      } } } },
      characterLoadouts: { data: { c1: { loadouts: [{
        nameHash: 1,
        items: savedOrder.map((itemInstanceId) => ({
          itemInstanceId,
          plugItemHashes: itemInstanceId === "100" ? [30, 31, 32, 33, 34] : itemInstanceId === "101" ? [40, 41, 42] : itemInstanceId === "109" ? [50, 51, 52, 53, 54, 55, 56, 50, 57, 58, 59, 60, 61, 62, 63] : []
        }))
      }] } } }
    };
    const slots = ["Subclass", "Kinetic Weapons", "Energy Weapons", "Power Weapons", "Helmet", "Gauntlets", "Chest Armor", "Leg Armor", "Class Armor", "Artifacts"];
    const manifest: any = {
      version: "test", generatedAt: "now", bucketDefinitions: {},
      loadoutNameDefinitions: { "1": { name: "Prismatic" } }, loadoutIconDefinitions: {}, loadoutColorDefinitions: {},
      itemDefinitions: Object.fromEntries([
        ...slots.map((equipmentSlot, index) => [String(10 + index), {
          itemType: index === 0 ? 16 : 3,
          displayProperties: { name: index === 0 ? "Prismatic Hunter" : equipmentSlot, icon: `/${index}.png` },
          itemTypeDisplayName: equipmentSlot,
          inventory: { tierTypeName: "Legendary" },
          equipmentSlot
        }]),
        ["30", { displayProperties: { name: "Golden Gun", icon: "/super.png" }, plug: { plugCategoryIdentifier: "hunter.prism.supers" } }],
        ["31", { displayProperties: { name: "Transcendence", icon: "/transcendence.png" }, plug: { plugCategoryIdentifier: "hunter.prism.transcendence" } }],
        ["32", { displayProperties: { name: "Hailfire Spike", icon: "/prism-grenade.png" }, plug: { plugCategoryIdentifier: "hunter.prism.prism_grenade" } }],
        ["33", { displayProperties: { name: "Winter's Shroud", icon: "/aspect.png" }, plug: { plugCategoryIdentifier: "hunter.prism.aspects" } }],
        ["34", { displayProperties: { name: "Facet of Courage", icon: "/fragment.png" }, plug: { plugCategoryIdentifier: "hunter.prism.fragments" } }],
        ["40", { displayProperties: { name: "Weapon Ornament", icon: "/ornament.png" }, plug: { plugCategoryIdentifier: "weapon_skins" } }],
        ["41", { displayProperties: { name: "Test Shader", icon: "/shader.png" }, plug: { plugCategoryIdentifier: "shader" } }],
        ["42", { displayProperties: { name: "Backup Mag", icon: "/mod.png" }, plug: { plugCategoryIdentifier: "weapon.mod" } }],
        ...[50, 51, 52, 53, 54, 55, 56, 57, 59, 60, 61, 62, 63].map((hash) => [String(hash), { displayProperties: { name: `Artifact Mod ${hash}`, icon: `/artifact-${hash}.png` }, plug: { plugCategoryIdentifier: "artifact_perks" } }]),
        ["58", { displayProperties: { name: "Empty Artifact Mod", icon: "/empty-artifact.png" }, plug: { plugCategoryIdentifier: "artifact_perks" } }]
      ])
    };
    const character: any = { characterId: "c1", className: "Hunter", emblemPath: "", emblemBackgroundPath: "", power: 400, raceName: "Human", dateLastPlayed: "", minutesPlayedThisSession: 0 };

    const data = normalizeLoadouts(profile, manifest, character);
    const loadout = data.loadouts[0];

    expect(loadout).toMatchObject({ isPrismatic: true, transcendence: { name: "Transcendence" }, prismaticGrenade: { name: "Hailfire Spike" } });
    expect(loadout?.abilities.map((socket) => socket.category)).toEqual(["super"]);
    expect(loadout?.equipment.map((item) => item.equipmentSlot)).toEqual(slots.slice(1, 9));
    expect(loadout?.equipment[0]?.sockets.map((socket) => socket.categoryLabel)).toEqual(["Ornament", "Shader", "Weapon Mod"]);
    expect(loadout?.artifact).toMatchObject({ name: "Artifacts", equipmentSlot: "Artifacts" });
    expect(loadout?.artifactMods).toHaveLength(7);
    expect(loadout?.artifactMods.map((mod) => mod.name)).toEqual(["Artifact Mod 50", "Artifact Mod 51", "Artifact Mod 52", "Artifact Mod 53", "Artifact Mod 54", "Artifact Mod 55", "Artifact Mod 56"]);
    expect(loadout?.artifactMods.every((mod) => mod.category === "artifact-perk" && mod.definitionAvailable)).toBe(true);
    expect(loadout?.artifactMods.some((mod) => mod.name === "Artifact Mod 57")).toBe(false);
    expect(data.artifact).toMatchObject({ mods: [], source: "saved-loadout-compatibility" });
  });
});
