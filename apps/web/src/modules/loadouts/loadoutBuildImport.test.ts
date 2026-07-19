// @vitest-environment jsdom
import type { GuardianLoadout, LoadoutItem, LoadoutSocket } from "@guardian-nexus/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { buildDocumentFromLoadout, readLoadoutBuildImport, removeLoadoutBuildImport, storeLoadoutBuildImport } from "./loadoutBuildImport";

const socket = (hash: string, name: string, category: LoadoutSocket["category"], categoryLabel: string): LoadoutSocket => ({
  itemHash: hash, name, description: `${name} description`, icon: `/icons/${hash}.jpg`, category, categoryLabel, definitionAvailable: true
});

const item = (hash: string, name: string, slot: string, rarity: string, sockets: LoadoutSocket[] = []): LoadoutItem => ({
  instanceId: `instance-${hash}`, itemHash: hash, name, icon: `/icons/${hash}.jpg`, itemType: slot.includes("Weapons") ? "Weapon" : "Armor", rarity, equipmentSlot: slot, definitionAvailable: true, sockets
});

const superSocket = socket("super", "Song of Flame", "super", "Super");
const grenade = socket("grenade", "Healing Grenade", "grenade", "Grenade");
const prismaticGrenade = socket("prismatic", "Freezing Singularity", "prismatic-grenade", "Prismatic Grenade");
const transcendence = socket("transcendence", "Transcendence", "transcendence", "Transcendence");
const weapon = item("weapon", "Test Rifle", "Kinetic Weapons", "Exotic", [
  socket("intrinsic", "Exotic Intrinsic", "modifier", "Intrinsic"), socket("perk", "Damage Perk", "modifier", "Perk"), socket("shader", "Dark Shader", "other", "Shader")
]);
const helmet = item("helmet", "Test Hood", "Helmet", "Legendary", [
  socket("armor-mod", "Ashes to Assets", "modifier", "Armor Mod"), socket("ornament", "Test Ornament", "other", "Ornament")
]);
const artifact = item("artifact", "Seasonal Artifact", "Artifacts", "Legendary");

function loadout(): GuardianLoadout {
  return {
    index: 2, name: "Raid", icon: "", color: "", element: "Prismatic", items: [weapon, helmet, artifact], equipment: [weapon, helmet],
    subclass: item("subclass", "Prismatic Warlock", "Subclass", "Legendary"), artifact,
    artifactMods: [socket("artifact-perk", "Anti-Barrier Scout", "artifact-perk", "Artifact Mod")], isPrismatic: true,
    transcendence, prismaticGrenade, abilities: [superSocket, grenade], aspects: [socket("aspect", "Feed the Void", "aspect", "Aspect")],
    fragments: [socket("fragment", "Facet of Purpose", "fragment", "Fragment")], modifiers: [], unresolvedItemCount: 0
  };
}

describe("loadout build imports", () => {
  beforeEach(() => sessionStorage.clear());

  it("prefills every supported build section without inventing guide content", () => {
    const document = buildDocumentFromLoadout(loadout(), "Warlock");
    expect(document.title).toBe("Raid");
    expect(document.classType).toBe("warlock");
    expect(document.subclass).toBe("prismatic");
    expect(document.subclassConfig.super?.name).toBe("Song of Flame");
    expect(document.subclassConfig.grenade?.name).toBe("Freezing Singularity");
    expect(document.subclassConfig.transcendence?.name).toBe("Transcendence");
    expect(document.subclassConfig.aspects.map((entry) => entry.name)).toEqual(["Feed the Void"]);
    expect(document.equipment.weapons[0]).toMatchObject({ name: "Test Rifle", exotic: true, slot: "Kinetic Weapons" });
    expect(document.equipment.weapons[0]?.traits?.map((entry) => entry.name)).toEqual(["Exotic Intrinsic"]);
    expect(document.equipment.weapons[0]?.selectedPerks?.map((entry) => entry.name)).toEqual(["Damage Perk"]);
    expect(document.armorMods.helmet.map((entry) => entry.name)).toEqual(["Ashes to Assets"]);
    expect(document.artifacts[0]?.perks.map((entry) => entry.name)).toEqual(["Anti-Barrier Scout"]);
    expect(document.cosmetics.shader?.name).toBe("Dark Shader");
    expect(document.cosmetics.ornaments.map((entry) => entry.name)).toEqual(["Test Ornament"]);
    expect(document).toMatchObject({ summary: "", notes: "", tags: [], gameplayLoop: [], status: "draft", visibility: "private" });
  });

  it("does not import transcendence into a non-Prismatic build", () => {
    const value = loadout(); value.element = "Solar"; value.isPrismatic = false;
    expect(buildDocumentFromLoadout(value, "Warlock").subclassConfig.transcendence).toBeUndefined();
    expect(buildDocumentFromLoadout(value, "Warlock").subclassConfig.grenade?.name).toBe("Healing Grenade");
  });

  it("round-trips a one-time browser import payload", () => {
    const value = { version: 1 as const, sourceName: "Raid", sourceIndex: 2, document: buildDocumentFromLoadout(loadout(), "Warlock") };
    const token = storeLoadoutBuildImport(value);
    expect(readLoadoutBuildImport(token)).toEqual(value);
    removeLoadoutBuildImport(token);
    expect(readLoadoutBuildImport(token)).toBeUndefined();
  });
});
