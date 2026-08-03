import type { CharacterSummary, CompactManifest, CompanionManifest, GearManifest } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { buildDocumentSchema } from "./builds";
import {
  buildAdvisorRecommendations,
  normalizeBuildAdvisorData,
  normalizeBuildAdvisorInventory
} from "./buildAdvisor";
import { BUILD_ADVISOR_TEMPLATES } from "./buildAdvisorTemplates";
import { profileComponentsFor } from "./bungie";

const hunter: CharacterSummary = { characterId: "hunter", className: "Hunter", raceName: "Human", emblemPath: "", emblemBackgroundPath: "", power: 500, dateLastPlayed: "", minutesPlayedThisSession: 0 };
const titan: CharacterSummary = { ...hunter, characterId: "titan", className: "Titan" };
const warlock: CharacterSummary = { ...hunter, characterId: "warlock", className: "Warlock" };

const hashes = {
  gyrfalcon: "1001",
  nighthawk: "1002",
  liars: "1003",
  cuirass: "1004",
  synthoceps: "1005",
  contraverse: "1006",
  helmet: "1101",
  arms: "1102",
  legs: "1103",
  cloak: "1104",
  graviton: "2001",
  wrongExotic: "2008",
  voidPrimary: "2002",
  solarPrimary: "2003",
  shotgun: "2004",
  heavy: "2005",
  arcPrimary: "2006",
  glaive: "2007",
  bait: "3001",
  vorpal: "3002",
  oneTwo: "3003",
  repulsor: "3004",
  hipFire: "3005",
  voltshot: "3006",
  enhancedBait: "3007"
};

function definition(name: string, itemType: 2 | 3, itemTypeDisplayName: string, rarity = "Legendary", slot = ""): any {
  return {
    displayProperties: { name, icon: `/common/${name.replace(/\W+/g, "-").toLowerCase()}.jpg` },
    itemType,
    itemTypeDisplayName,
    equipmentSlot: slot,
    inventory: { tierType: rarity === "Exotic" ? 6 : 5, tierTypeName: rarity }
  };
}

function abilityDefinition(name: string, plugCategoryIdentifier: string): any {
  return {
    displayProperties: { name, icon: `/common/${name.replace(/\W+/g, "-").toLowerCase()}.png` },
    itemTypeDisplayName: "Subclass ability",
    plug: { plugCategoryIdentifier }
  };
}

function manifests(): { companion: CompanionManifest; collection: CompactManifest } {
  const itemDefinitions: any = {
    [hashes.gyrfalcon]: definition("Gyrfalcon's Hauberk", 2, "Chest Armor", "Exotic", "Chest Armor"),
    [hashes.nighthawk]: definition("Celestial Nighthawk", 2, "Helmet", "Exotic", "Helmet"),
    [hashes.liars]: definition("Liar's Handshake", 2, "Gauntlets", "Exotic", "Gauntlets"),
    [hashes.cuirass]: definition("Cuirass of the Falling Star", 2, "Chest Armor", "Exotic", "Chest Armor"),
    [hashes.synthoceps]: definition("Synthoceps", 2, "Gauntlets", "Exotic", "Gauntlets"),
    [hashes.contraverse]: definition("Contraverse Hold", 2, "Gauntlets", "Exotic", "Gauntlets"),
    [hashes.helmet]: definition("Deterministic Helmet", 2, "Helmet", "Legendary", "Helmet"),
    [hashes.arms]: definition("Deterministic Arms", 2, "Gauntlets", "Legendary", "Gauntlets"),
    [hashes.legs]: definition("Deterministic Legs", 2, "Leg Armor", "Legendary", "Leg Armor"),
    [hashes.cloak]: definition("Deterministic Cloak", 2, "Hunter Cloak", "Legendary", "Class Armor"),
    [hashes.graviton]: { ...definition("Graviton Lance", 3, "Pulse Rifle", "Exotic", "Energy Weapons"), defaultDamageType: 4 },
    [hashes.wrongExotic]: { ...definition("Unrelated Exotic", 3, "Pulse Rifle", "Exotic", "Energy Weapons"), defaultDamageType: 4 },
    [hashes.voidPrimary]: { ...definition("Deterministic Void Rifle", 3, "Auto Rifle", "Legendary", "Energy Weapons"), defaultDamageType: 4 },
    [hashes.solarPrimary]: { ...definition("Deterministic Solar Rifle", 3, "Auto Rifle", "Legendary", "Energy Weapons"), defaultDamageType: 3 },
    [hashes.shotgun]: definition("Deterministic Shotgun", 3, "Shotgun", "Legendary", "Kinetic Weapons"),
    [hashes.heavy]: definition("Deterministic Heavy", 3, "Rocket Launcher", "Legendary", "Power Weapons"),
    [hashes.arcPrimary]: { ...definition("Deterministic Arc Rifle", 3, "Auto Rifle", "Legendary", "Energy Weapons"), defaultDamageType: 2 },
    [hashes.glaive]: definition("Deterministic Glaive", 3, "Glaive", "Legendary", "Energy Weapons"),
    [hashes.bait]: definition("Bait and Switch", 3, "Perk"),
    [hashes.vorpal]: definition("Vorpal Weapon", 3, "Perk"),
    [hashes.oneTwo]: definition("One-Two Punch", 3, "Perk"),
    [hashes.repulsor]: definition("Repulsor Brace", 3, "Perk"),
    [hashes.hipFire]: definition("Hip-Fire Grip", 3, "Perk"),
    [hashes.voltshot]: definition("Voltshot", 3, "Perk"),
    [hashes.enhancedBait]: definition("Bait and Switch Enhanced", 3, "Perk")
  };
  const collectionItems: CompactManifest["items"] = [
    { itemHash: hashes.gyrfalcon, collectibleHash: "4001", name: "Gyrfalcon's Hauberk", description: "", icon: "/gyrfalcon.jpg", kind: "armor", className: "Hunter", slot: "Chest Armor", itemType: "Chest Armor", source: "Exotic Armor Focusing", catalystRecordHashes: [] },
    { itemHash: hashes.nighthawk, collectibleHash: "4002", name: "Celestial Nighthawk", description: "", icon: "/nighthawk.jpg", kind: "armor", className: "Hunter", slot: "Helmet", itemType: "Helmet", source: "", catalystRecordHashes: [] },
    { itemHash: hashes.liars, collectibleHash: "4003", name: "Liar's Handshake", description: "", icon: "/liars.jpg", kind: "armor", className: "Hunter", slot: "Gauntlets", itemType: "Gauntlets", source: "", catalystRecordHashes: [] },
    { itemHash: hashes.cuirass, collectibleHash: "4004", name: "Cuirass of the Falling Star", description: "", icon: "/cuirass.jpg", kind: "armor", className: "Titan", slot: "Chest Armor", itemType: "Chest Armor", source: "", catalystRecordHashes: [] },
    { itemHash: hashes.synthoceps, collectibleHash: "4005", name: "Synthoceps", description: "", icon: "/synthoceps.jpg", kind: "armor", className: "Titan", slot: "Gauntlets", itemType: "Gauntlets", source: "", catalystRecordHashes: [] },
    { itemHash: hashes.contraverse, collectibleHash: "4006", name: "Contraverse Hold", description: "", icon: "/contraverse.jpg", kind: "armor", className: "Warlock", slot: "Gauntlets", itemType: "Gauntlets", source: "", catalystRecordHashes: [] },
    { itemHash: hashes.graviton, collectibleHash: "4007", name: "Graviton Lance", description: "", icon: "/graviton.jpg", kind: "weapon", slot: "Energy Weapons", itemType: "Pulse Rifle", damageType: "Void", source: "Source: Exotic engrams; extremely rare world drops.", catalystRecordHashes: [] }
  ];
  return {
    companion: {
      version: "test",
      generatedAt: "2026-07-26T00:00:00.000Z",
      itemDefinitions,
      bucketDefinitions: {},
      loadoutNameDefinitions: {},
      loadoutIconDefinitions: {},
      loadoutColorDefinitions: {}
    },
    collection: {
      version: "test",
      generatedAt: "2026-07-26T00:00:00.000Z",
      items: collectionItems,
      itemDefinitions: {},
      objectiveDefinitions: {},
      activityDefinitions: {},
      recordDefinitions: {}
    }
  };
}

function gearManifest(): GearManifest {
  const { companion } = manifests();
  return {
    version: "test",
    generatedAt: "2026-07-26T00:00:00.000Z",
    gearItemDefinitions: companion.itemDefinitions,
    plugDefinitions: companion.itemDefinitions,
    statDefinitions: {}
  };
}

function item(itemHash: string, itemInstanceId: string, power = 500): any {
  return { itemHash, itemInstanceId, primaryStat: { value: power } };
}

function profile(input: {
  vault?: any[];
  inventories?: Record<string, any[]>;
  equipment?: Record<string, any[]>;
  plugs?: Record<string, string[] | undefined>;
  collectibles?: Record<string, number>;
  stats?: Record<string, Record<string, number>>;
  mintedAt?: string;
} = {}): any {
  const sockets = Object.fromEntries(Object.entries(input.plugs || {}).filter(([, plugs]) => plugs !== undefined).map(([instanceId, plugs]) => [instanceId, { sockets: plugs!.map((plugHash) => ({ plugHash })) }]));
  const all = [
    ...(input.vault || []),
    ...Object.values(input.inventories || {}).flat(),
    ...Object.values(input.equipment || {}).flat()
  ];
  return {
    responseMintedTimestamp: input.mintedAt || "2026-07-26T12:00:00.000Z",
    profileInventory: { data: { items: input.vault || [] } },
    characterInventories: { data: Object.fromEntries(Object.entries(input.inventories || {}).map(([id, items]) => [id, { items }])) },
    characterEquipment: { data: Object.fromEntries(Object.entries(input.equipment || {}).map(([id, items]) => [id, { items }])) },
    itemComponents: {
      instances: { data: Object.fromEntries(all.map((entry) => [entry.itemInstanceId, { primaryStat: entry.primaryStat }])) },
      stats: { data: Object.fromEntries(Object.entries(input.stats || {}).map(([instanceId, values]) => [instanceId, { stats: Object.fromEntries(Object.entries(values).map(([hash, value]) => [hash, { value }])) }])) },
      sockets: { data: sockets },
      perks: { data: {} },
      reusablePlugs: { data: {} }
    },
    profileCollectibles: { data: { collectibles: Object.fromEntries(Object.entries(input.collectibles || {}).map(([hash, state]) => [hash, { state }])) } },
    characterLoadouts: { data: {} }
  };
}

function fullyOwnedHunterProfile(): any {
  return profile({
    vault: [item(hashes.gyrfalcon, "armor-vault"), item(hashes.shotgun, "special-vault"), item(hashes.heavy, "heavy-vault", 510)],
    inventories: { hunter: [item(hashes.graviton, "graviton-inventory")] },
    equipment: { hunter: [item(hashes.solarPrimary, "solar-equipped")] },
    plugs: {
      "armor-vault": [],
      "special-vault": [hashes.vorpal],
      "heavy-vault": [hashes.bait],
      "graviton-inventory": [],
      "solar-equipped": []
    }
  });
}

describe("Build Advisor inventory and scoring", () => {
  it("requests every Bungie component needed by the advisor", () => {
    expect(profileComponentsFor("build-advisor")).toBe("100,102,104,200,201,204,205,206,300,301,302,304,305,306,307,308,309,310,800");
  });

  it("normalizes equipment, character inventory, and Vault into one physical set", () => {
    const { companion, collection } = manifests();
    const normalized = normalizeBuildAdvisorInventory(fullyOwnedHunterProfile(), companion, collection, [hunter, titan, warlock]);
    expect(normalized.items.map((entry) => [entry.instanceId, entry.location])).toEqual(expect.arrayContaining([
      ["armor-vault", "vault"],
      ["graviton-inventory", "inventory"],
      ["solar-equipped", "equipped"]
    ]));
    expect(new Set(normalized.items.map((entry) => entry.instanceId)).size).toBe(normalized.items.length);
  });

  it("builds independently from each signed-in Guardian's owned item instances", () => {
    const { companion, collection } = manifests();
    const accountOne = normalizeBuildAdvisorInventory(profile({
      vault: [item(hashes.gyrfalcon, "one-armor"), item(hashes.shotgun, "one-special"), item(hashes.heavy, "one-heavy")],
      inventories: { hunter: [item(hashes.graviton, "one-exotic")] },
      plugs: { "one-armor": [], "one-special": [hashes.vorpal], "one-heavy": [hashes.bait], "one-exotic": [] }
    }), companion, collection, [hunter]);
    const accountTwo = normalizeBuildAdvisorInventory(profile({
      vault: [item(hashes.gyrfalcon, "two-armor"), item(hashes.shotgun, "two-special"), item(hashes.heavy, "two-heavy")],
      inventories: { hunter: [item(hashes.graviton, "two-exotic")] },
      plugs: { "two-armor": [], "two-special": [hashes.vorpal], "two-heavy": [hashes.bait], "two-exotic": [] }
    }), companion, collection, [hunter]);
    const template = BUILD_ADVISOR_TEMPLATES.find((entry) => entry.id === "hunter-void-gyrfalcon")!;
    const first = buildAdvisorRecommendations(accountOne, hunter, 0, [template]).recommendations[0]!;
    const second = buildAdvisorRecommendations(accountTwo, hunter, 0, [template]).recommendations[0]!;
    const firstIds = [...first.armor, ...first.weapons].flatMap((entry) => entry.item ? [entry.item.instanceId] : []);
    const secondIds = [...second.armor, ...second.weapons].flatMap((entry) => entry.item ? [entry.item.instanceId] : []);
    expect(firstIds.length).toBeGreaterThan(0);
    expect(firstIds.every((id) => id.startsWith("one-"))).toBe(true);
    expect(secondIds.length).toBeGreaterThan(0);
    expect(secondIds.every((id) => id.startsWith("two-"))).toBe(true);
  });

  it("selects the best owned armor roll account-wide instead of favoring equipped gear", () => {
    const { companion, collection } = manifests();
    const normalized = normalizeBuildAdvisorInventory(profile({
      vault: [
        item(hashes.gyrfalcon, "armor-vault"),
        item(hashes.helmet, "better-vault-helmet", 490),
        item(hashes.arms, "arms"),
        item(hashes.legs, "legs"),
        item(hashes.cloak, "cloak"),
        item(hashes.shotgun, "special"),
        item(hashes.heavy, "heavy")
      ],
      inventories: { hunter: [item(hashes.graviton, "graviton")] },
      equipment: { hunter: [item(hashes.helmet, "weaker-equipped-helmet", 500)] },
      plugs: {
        "armor-vault": [], "better-vault-helmet": [], arms: [], legs: [], cloak: [],
        special: [hashes.vorpal], heavy: [hashes.bait], graviton: [], "weaker-equipped-helmet": []
      },
      stats: {
        "better-vault-helmet": { "1943323491": 30, "392767087": 24 },
        "weaker-equipped-helmet": { "1943323491": 2, "392767087": 2 }
      }
    }), companion, collection, [hunter], gearManifest());
    const template = BUILD_ADVISOR_TEMPLATES.find((entry) => entry.id === "hunter-void-gyrfalcon")!;
    const recommendation = buildAdvisorRecommendations(normalized, hunter, 0, [template]).recommendations[0]!;
    expect(recommendation.armor.find((entry) => entry.slot === "helmet")?.item?.instanceId).toBe("better-vault-helmet");
    expect(recommendation.armorOptimization).toEqual(expect.objectContaining({
      strategy: "account-wide-combination-v1",
      candidatesEvaluated: expect.any(Number),
      selected: expect.objectContaining({ items: expect.any(Array), targets: expect.any(Array) })
    }));
    expect(recommendation.armorOptimization!.selected.items.map((entry) => entry.instanceId)).toEqual(recommendation.armor.flatMap((entry) => entry.item ? [entry.item.instanceId] : []));
  });

  it("keeps collection-only unlocks separate from physical owned copies", () => {
    const { companion, collection } = manifests();
    const normalized = normalizeBuildAdvisorInventory(profile({ collectibles: { "4002": 0 } }), companion, collection, [hunter]);
    expect(normalized.items).toHaveLength(0);
    expect(normalized.collectionOnlyExotics.map((entry) => entry.name)).toContain("Celestial Nighthawk");
  });

  it("does not replace a build's required exotic weapon with an unrelated owned exotic", () => {
    const { companion, collection } = manifests();
    const normalized = normalizeBuildAdvisorInventory(profile({
      vault: [
        item(hashes.gyrfalcon, "armor"),
        item(hashes.shotgun, "special"),
        item(hashes.wrongExotic, "wrong-exotic"),
        item(hashes.heavy, "heavy")
      ],
      plugs: { armor: [], special: [hashes.vorpal], "wrong-exotic": [], heavy: [hashes.bait] }
    }), companion, collection, [hunter]);
    const template = BUILD_ADVISOR_TEMPLATES.find((entry) => entry.id === "hunter-void-gyrfalcon")!;
    const recommendation = buildAdvisorRecommendations(normalized, hunter, 0, [template]).recommendations[0]!;
    const exotic = recommendation.weapons.find((entry) => entry.requirementId === "exotic-primary")!;
    expect(exotic.item).toBeUndefined();
    expect(exotic.quality).toBe("missing");
    expect(recommendation.missingItemGuides.map((guide) => guide.name)).toContain("Graviton Lance");
  });

  it("restricts recommendations to the selected class", () => {
    const { companion, collection } = manifests();
    const normalized = normalizeBuildAdvisorInventory(fullyOwnedHunterProfile(), companion, collection, [hunter, titan, warlock]);
    const result = buildAdvisorRecommendations(normalized, hunter);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.every((entry) => entry.classType === "hunter")).toBe(true);
  });

  it("validates every subclass selection against its Bungie class and subclass category", () => {
    const { companion, collection } = manifests();
    Object.assign(companion.itemDefinitions, voidHunterAbilityDefinitions());
    const normalized = normalizeBuildAdvisorInventory(fullyOwnedHunterProfile(), companion, collection, [hunter]);
    const template = BUILD_ADVISOR_TEMPLATES.find((entry) => entry.id === "hunter-void-gyrfalcon")!;
    const result = buildAdvisorRecommendations(normalized, hunter, 0, [template]);
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0]?.subclassValidation).toMatchObject({ state: "validated", checkedCount: 11 });
    expect(result.recommendations[0]?.build.subclassConfig.super?.hash).toBe("9001");
  });

  it("omits a build when a named ability belongs to the wrong subclass", () => {
    const { companion, collection } = manifests();
    const definitions = voidHunterAbilityDefinitions();
    definitions["9006"] = abilityDefinition("Vanishing Step", "hunter.arc.aspects");
    Object.assign(companion.itemDefinitions, definitions);
    const normalized = normalizeBuildAdvisorInventory(fullyOwnedHunterProfile(), companion, collection, [hunter]);
    const template = BUILD_ADVISOR_TEMPLATES.find((entry) => entry.id === "hunter-void-gyrfalcon")!;
    const result = buildAdvisorRecommendations(normalized, hunter, 0, [template]);
    expect(result.recommendations).toHaveLength(0);
    expect(result.analysis.warnings.join(" ")).toMatch(/incompatible.*Vanishing Step/i);
  });

  it("ranks a fully owned template above incomplete templates", () => {
    const { companion, collection } = manifests();
    const normalized = normalizeBuildAdvisorInventory(fullyOwnedHunterProfile(), companion, collection, [hunter]);
    const completeTemplate = BUILD_ADVISOR_TEMPLATES.find((entry) => entry.id === "hunter-void-gyrfalcon")!;
    const result = buildAdvisorRecommendations(normalized, hunter, 0, [
      completeTemplate,
      { ...completeTemplate, id: "hunter-void-missing-core", name: "Missing Core Comparison", requiredExoticArmor: "Celestial Nighthawk" }
    ]);
    expect(result.recommendations[0]?.templateId).toBe("hunter-void-gyrfalcon");
    expect(result.recommendations[0]?.status).toBe("fully-assembleable");
    expect(result.recommendations[0]!.viabilityScore).toBe(
      result.recommendations.find((entry) => entry.templateId === "hunter-void-missing-core")!.viabilityScore
    );
    expect(result.recommendations[0]!.readinessScore).toBeGreaterThan(
      result.recommendations.find((entry) => entry.templateId === "hunter-void-missing-core")!.readinessScore
    );
    expect(result.recommendations[0]!.score).toBeGreaterThan(result.recommendations.find((entry) => entry.templateId === "hunter-void-missing-core")!.score);
  });

  it("does not mark a build complete when its required exotic is missing", () => {
    const { companion, collection } = manifests();
    const withoutArmor = profile({
      vault: [item(hashes.shotgun, "special"), item(hashes.heavy, "heavy")],
      inventories: { hunter: [item(hashes.graviton, "graviton")] },
      plugs: { special: [hashes.vorpal], heavy: [hashes.bait], graviton: [] }
    });
    const normalized = normalizeBuildAdvisorInventory(withoutArmor, companion, collection, [hunter]);
    const result = buildAdvisorRecommendations(normalized, hunter);
    const recommendation = result.recommendations.find((entry) => entry.templateId === "hunter-void-gyrfalcon");
    expect(recommendation?.status).toBe("missing-one-important-item");
    expect(recommendation?.missingItems).toContain("Gyrfalcon's Hauberk");
    expect(recommendation?.missingItemGuides).toContainEqual(expect.objectContaining({
      name: "Gyrfalcon's Hauberk",
      source: "bungie-manifest",
      acquisition: "Exotic Armor Focusing"
    }));
    expect(recommendation?.missingItemGuides.find((entry) => entry.name === "Gyrfalcon's Hauberk")?.steps.join(" ")).toMatch(/Exotic Armor Focusing/i);
    expect(recommendation?.adviceSchemaVersion).toBe(2);
    expect(recommendation?.componentVerifications).toContainEqual(expect.objectContaining({
      kind: "exotic-armor",
      state: "missing",
      name: "Gyrfalcon's Hauberk"
    }));
    expect(recommendation?.acquisitionPlans?.find((entry) => entry.name === "Gyrfalcon's Hauberk")?.routes[0]).toEqual(expect.objectContaining({
      source: "bungie-manifest",
      availability: "available-now",
      certainty: "deterministic"
    }));
    expect(recommendation?.upgradePath?.map((entry) => entry.kind)).toEqual(expect.arrayContaining(["playable-now", "next-upgrade", "ideal"]));
  });

  it("uses Collections reacquisition before the published source for an unlocked item without a physical copy", () => {
    const { companion, collection } = manifests();
    const unlockedOnly = profile({
      vault: [item(hashes.shotgun, "special"), item(hashes.heavy, "heavy")],
      inventories: { hunter: [item(hashes.graviton, "graviton")] },
      plugs: { special: [hashes.vorpal], heavy: [hashes.bait], graviton: [] },
      collectibles: { "4001": 0 }
    });
    const normalized = normalizeBuildAdvisorInventory(unlockedOnly, companion, collection, [hunter]);
    const recommendation = buildAdvisorRecommendations(normalized, hunter).recommendations.find((entry) => entry.templateId === "hunter-void-gyrfalcon")!;
    const guide = recommendation.missingItemGuides.find((entry) => entry.name === "Gyrfalcon's Hauberk")!;
    expect(guide.source).toBe("collections");
    expect(guide.acquisition).toMatch(/Unlocked in Collections/i);
    expect(guide.steps.join(" ")).toMatch(/Reacquire.*Exotic Armor Focusing/i);
  });

  it("describes the exact slot, archetype, and perks for a missing weapon role", () => {
    const { companion, collection } = manifests();
    const missingSpecial = profile({
      vault: [item(hashes.gyrfalcon, "armor"), item(hashes.heavy, "heavy")],
      inventories: { hunter: [item(hashes.graviton, "graviton")] },
      plugs: { armor: [], heavy: [hashes.bait], graviton: [] }
    });
    const normalized = normalizeBuildAdvisorInventory(missingSpecial, companion, collection, [hunter]);
    const recommendation = buildAdvisorRecommendations(normalized, hunter).recommendations.find((entry) => entry.templateId === "hunter-void-gyrfalcon")!;
    const guide = recommendation.missingItemGuides.find((entry) => entry.id === "weapon-role:kinetic-special")!;
    expect(guide.source).toBe("loadout-requirement");
    expect(guide.steps.join(" ")).toMatch(/Kinetic Weapons.*Fusion Rifle.*Chill Clip/i);
  });

  it("identifies an acceptable substitute without calling it a perfect roll", () => {
    const { companion, collection } = manifests();
    const substituted = profile({
      vault: [item(hashes.gyrfalcon, "armor"), item(hashes.shotgun, "special"), item(hashes.heavy, "heavy")],
      inventories: { hunter: [item(hashes.graviton, "graviton")] },
      plugs: { armor: [], special: [hashes.vorpal], heavy: [hashes.vorpal], graviton: [] }
    });
    const normalized = normalizeBuildAdvisorInventory(substituted, companion, collection, [hunter]);
    const recommendation = buildAdvisorRecommendations(normalized, hunter).recommendations.find((entry) => entry.templateId === "hunter-void-gyrfalcon")!;
    const heavy = recommendation.weapons.find((entry) => entry.requirementId === "damage-heavy")!;
    expect(heavy.quality).toBe("functional");
    expect(heavy.substitution).toBe("functional");
    expect(recommendation.status).toBe("assembleable-with-substitutions");
    expect(recommendation.componentVerifications?.find((entry) => entry.id === "weapon:damage-heavy")?.state).toBe("functional-owned");
  });

  it("ranks additional owned rolls as structured alternatives", () => {
    const { companion, collection } = manifests();
    const inventory = profile({
      vault: [
        item(hashes.gyrfalcon, "armor"),
        item(hashes.shotgun, "special"),
        item(hashes.heavy, "heavy-best", 500),
        item(hashes.heavy, "heavy-fallback", 490)
      ],
      inventories: { hunter: [item(hashes.graviton, "graviton")] },
      plugs: { armor: [], special: [hashes.vorpal], "heavy-best": [hashes.bait], "heavy-fallback": [hashes.vorpal], graviton: [] }
    });
    const normalized = normalizeBuildAdvisorInventory(inventory, companion, collection, [hunter]);
    const recommendation = buildAdvisorRecommendations(normalized, hunter).recommendations.find((entry) => entry.templateId === "hunter-void-gyrfalcon")!;
    expect(recommendation.alternatives).toContainEqual(expect.objectContaining({
      requirementId: "damage-heavy",
      name: "Deterministic Heavy",
      item: expect.objectContaining({ instanceId: "heavy-fallback" })
    }));
  });

  it("scores a wrong legendary roll below perfect", () => {
    const { companion, collection } = manifests();
    const wrongRoll = profile({
      vault: [item(hashes.gyrfalcon, "armor"), item(hashes.shotgun, "special"), item(hashes.heavy, "heavy")],
      inventories: { hunter: [item(hashes.graviton, "graviton")] },
      plugs: { armor: [], special: [hashes.vorpal], heavy: [hashes.hipFire], graviton: [] }
    });
    const normalized = normalizeBuildAdvisorInventory(wrongRoll, companion, collection, [hunter]);
    const heavy = buildAdvisorRecommendations(normalized, hunter).recommendations.find((entry) => entry.templateId === "hunter-void-gyrfalcon")!.weapons.find((entry) => entry.requirementId === "damage-heavy")!;
    expect(heavy.quality).toBe("poor");
    expect(heavy.quality).not.toBe("perfect");
  });

  it("labels missing socket data as unknown", () => {
    const { companion, collection } = manifests();
    const unknownRoll = profile({
      vault: [item(hashes.gyrfalcon, "armor"), item(hashes.heavy, "heavy")],
      inventories: { hunter: [item(hashes.graviton, "graviton")] },
      plugs: { armor: [], graviton: [] }
    });
    const normalized = normalizeBuildAdvisorInventory(unknownRoll, companion, collection, [hunter]);
    const heavy = buildAdvisorRecommendations(normalized, hunter).recommendations.find((entry) => entry.templateId === "hunter-void-gyrfalcon")!.weapons.find((entry) => entry.requirementId === "damage-heavy")!;
    expect(heavy.quality).toBe("unknown");
    expect(heavy.notes.join(" ")).toMatch(/roll is unknown/i);
  });

  it("recognizes crafted state and enhanced versions of requested perks", () => {
    const { companion, collection } = manifests();
    const crafted = profile({
      vault: [item(hashes.gyrfalcon, "armor"), item(hashes.heavy, "heavy")],
      inventories: { hunter: [item(hashes.graviton, "graviton")] },
      plugs: { armor: [], heavy: [hashes.enhancedBait], graviton: [] }
    });
    crafted.itemComponents.state = { data: { heavy: { state: 8 } } };
    const normalized = normalizeBuildAdvisorInventory(crafted, companion, collection, [hunter]);
    const heavyItem = normalized.items.find((entry) => entry.instanceId === "heavy")!;
    expect(heavyItem.crafted).toBe(true);
    expect(heavyItem.enhancedPerks).toContain("Bait and Switch Enhanced");
    const heavy = buildAdvisorRecommendations(normalized, hunter).recommendations.find((entry) => entry.templateId === "hunter-void-gyrfalcon")!.weapons.find((entry) => entry.requirementId === "damage-heavy")!;
    expect(["perfect", "strong"]).toContain(heavy.quality);
  });

  it("generates deterministic notes from the same inventory", () => {
    const { companion, collection } = manifests();
    const normalized = normalizeBuildAdvisorInventory(fullyOwnedHunterProfile(), companion, collection, [hunter]);
    const first = buildAdvisorRecommendations(normalized, hunter);
    const second = buildAdvisorRecommendations(normalized, hunter);
    expect(second.recommendations.map((entry) => entry.notes)).toEqual(first.recommendations.map((entry) => entry.notes));
  });

  it("adapts generated recommendations to the existing Builder schema and exotic limits", () => {
    const { companion, collection } = manifests();
    const normalized = normalizeBuildAdvisorInventory(fullyOwnedHunterProfile(), companion, collection, [hunter]);
    for (const recommendation of buildAdvisorRecommendations(normalized, hunter).recommendations) {
      expect(buildDocumentSchema.safeParse(recommendation.build).success).toBe(true);
      expect(recommendation.weapons).toHaveLength(3);
      expect(new Set(recommendation.weapons.flatMap((entry) => entry.item ? [entry.item.slot] : [])).size).toBe(recommendation.weapons.filter((entry) => entry.item).length);
      expect(recommendation.armor.map((entry) => entry.slot)).toEqual(["helmet", "arms", "chest", "legs", "classItem"]);
      expect(recommendation.build.statPriorities).toHaveLength(6);
      expect(new Set(recommendation.build.statPriorities.map((entry) => entry.stat)).size).toBe(6);
      expect(recommendation.build.ghostFocus?.mod.name).toBeTruthy();
      expect(recommendation.build.subclassConfig.super?.name).toBeTruthy();
      expect(recommendation.build.subclassConfig.aspects).toHaveLength(2);
      expect(recommendation.build.subclassConfig.fragments.length).toBeGreaterThanOrEqual(4);
      expect(Object.values(recommendation.build.armorMods).every((entries) => entries.length === 3)).toBe(true);
      expect(recommendation.build.equipment.armor.filter((entry) => entry.exotic)).toHaveLength(recommendation.build.equipment.armor.length ? 1 : 0);
      expect(recommendation.build.equipment.weapons.filter((entry) => entry.exotic).length).toBeLessThanOrEqual(1);
      const template = BUILD_ADVISOR_TEMPLATES.find((entry) => entry.id === recommendation.templateId)!;
      expect(new Set(recommendation.build.equipment.armorSets.map((entry) => entry.setName))).toEqual(new Set(template.recommendedArmorSets || []));
      expect(recommendation.build.equipment.armorSets.map((entry) => entry.requiredPieces)).toEqual(template.recommendedArmorSets?.length ? [2, 4] : []);
    }
  });

  it("selects one owned armor piece for every slot and carries armor stats into Builder", () => {
    const { companion, collection } = manifests();
    const raw = profile({
      vault: [
        item(hashes.gyrfalcon, "chest"),
        item(hashes.helmet, "helmet"),
        item(hashes.arms, "arms"),
        item(hashes.legs, "legs"),
        item(hashes.cloak, "cloak"),
        item(hashes.shotgun, "special"),
        item(hashes.heavy, "heavy")
      ],
      inventories: { hunter: [item(hashes.graviton, "graviton")] },
      plugs: { chest: [], helmet: [], arms: [], legs: [], cloak: [], special: [hashes.vorpal], heavy: [hashes.bait], graviton: [] },
      stats: {
        helmet: { "1943323491": 24, "392767087": 18 },
        arms: { "2996146975": 25, "392767087": 17 },
        legs: { "1735777505": 23, "392767087": 19 },
        cloak: { "1943323491": 21, "2996146975": 20 }
      }
    });
    const normalized = normalizeBuildAdvisorInventory(raw, companion, collection, [hunter], gearManifest());
    const recommendation = buildAdvisorRecommendations(normalized, hunter).recommendations.find((entry) => entry.templateId === "hunter-void-gyrfalcon")!;
    expect(recommendation.armor.every((entry) => entry.item)).toBe(true);
    expect(new Set(recommendation.armor.map((entry) => entry.item!.instanceId)).size).toBe(5);
    expect(recommendation.armor.find((entry) => entry.slot === "helmet")?.item?.armorStats?.Class).toBe(24);
    expect(recommendation.build.equipment.armor).toHaveLength(5);
    expect(recommendation.build.equipment.armor.filter((entry) => entry.exotic)).toHaveLength(1);
    expect(recommendation.equipPlan).toMatchObject({ state: "ready", canEquip: true, itemCount: 8 });
  });

  it("offers every current subclass for every Guardian class", () => {
    const expected = new Set(["arc", "solar", "void", "strand", "stasis", "prismatic"]);
    for (const classType of ["hunter", "titan", "warlock"] as const) {
      const subclasses = BUILD_ADVISOR_TEMPLATES.filter((template) => template.classType === classType).map((template) => template.subclass);
      expect(new Set(subclasses)).toEqual(expected);
    }
    expect(new Set(BUILD_ADVISOR_TEMPLATES.map((template) => `${template.classType}:${template.subclass}`)).size).toBe(18);
    expect(BUILD_ADVISOR_TEMPLATES).toHaveLength(72);
    for (const classType of ["hunter", "titan", "warlock"] as const) {
      expect(BUILD_ADVISOR_TEMPLATES.filter((template) => template.classType === classType)).toHaveLength(24);
      for (const subclass of expected) {
        expect(BUILD_ADVISOR_TEMPLATES.filter((template) => template.classType === classType && template.subclass === subclass)).toHaveLength(4);
      }
    }
  });

  it("keeps several current-sandbox options per class with one exotic armor and one exotic weapon", () => {
    for (const classType of ["hunter", "titan", "warlock"] as const) {
      const templates = BUILD_ADVISOR_TEMPLATES.filter((template) => template.classType === classType);
      expect(templates.length).toBeGreaterThanOrEqual(2);
      for (const template of templates) {
        expect(template.requiredExoticArmor).toBeTruthy();
        expect(template.preferredExoticWeapon).toBeTruthy();
        expect(template.weapons.filter((requirement) => requirement.requiresExotic)).toHaveLength(1);
        expect(template.weapons.find((requirement) => requirement.requiresExotic)?.preferredNames).toContain(template.preferredExoticWeapon);
        expect(template.release).toMatch(/Monument of Triumph/);
      }
    }
  });

  it("uses the alternate Exotic weapon's real slot and archetype instead of inheriting the base build profile", () => {
    expect(BUILD_ADVISOR_TEMPLATES.find((template) => template.id === "warlock-solar-speakers")?.weapons.find((weapon) => weapon.requiresExotic)).toMatchObject({
      preferredNames: ["Lumina"], slots: ["Kinetic Weapons"], damageTypes: ["Kinetic"], archetypes: ["Hand Cannon"]
    });
    expect(BUILD_ADVISOR_TEMPLATES.find((template) => template.id === "titan-prismatic-hazardous")?.weapons.find((weapon) => weapon.requiresExotic)).toMatchObject({
      preferredNames: ["Grand Overture"], slots: ["Power Weapons"], damageTypes: ["Arc"], archetypes: ["Machine Gun"]
    });
  });

  it("does not expose token-shaped profile fields in recommendation output", () => {
    const { companion, collection } = manifests();
    const raw = fullyOwnedHunterProfile();
    raw.access_token = "secret-access-token";
    raw.refresh_token = "secret-refresh-token";
    raw.authorization = "Bearer private";
    const data = normalizeBuildAdvisorData(raw, companion, collection, [hunter], hunter, Date.parse("2026-07-26T12:01:00.000Z"));
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain("secret-access-token");
    expect(serialized).not.toContain("secret-refresh-token");
    expect(serialized).not.toContain("Bearer private");
    expect(serialized).not.toMatch(/access_token|refresh_token|authorization/i);
  });

  it("marks stale and incomplete inventory without changing deterministic recommendations", () => {
    const { companion, collection } = manifests();
    const raw = fullyOwnedHunterProfile();
    const stale = normalizeBuildAdvisorData(raw, companion, collection, [hunter], hunter, Date.parse("2026-07-26T12:10:00.000Z"));
    expect(stale.state).toBe("may-be-stale");
    delete raw.itemComponents.sockets;
    const incomplete = normalizeBuildAdvisorData(raw, companion, collection, [hunter], hunter, Date.parse("2026-07-26T12:01:00.000Z"));
    expect(incomplete.state).toBe("incomplete");
    expect(incomplete.analysis.warnings.join(" ")).toMatch(/socket data/i);
  });

  it.each([
    ["Hunter", hunter, "hunter"],
    ["Titan", titan, "titan"],
    ["Warlock", warlock, "warlock"]
  ] as const)("filters templates for a selected %s", (_label, character, expectedClass) => {
    const { companion, collection } = manifests();
    const raw = profile({
      vault: [
        item(hashes.gyrfalcon, "gyrfalcon"),
        item(hashes.cuirass, "cuirass"),
        item(hashes.synthoceps, "synthoceps"),
        item(hashes.contraverse, "contraverse"),
        item(hashes.heavy, "heavy"),
        item(hashes.shotgun, "shotgun")
      ],
      inventories: { [character.characterId]: [item(hashes.graviton, "graviton"), item(hashes.arcPrimary, "arc-primary")] },
      plugs: { gyrfalcon: [], cuirass: [], synthoceps: [], contraverse: [], heavy: [hashes.bait], shotgun: [hashes.oneTwo], graviton: [], "arc-primary": [hashes.voltshot] }
    });
    const normalized = normalizeBuildAdvisorInventory(raw, companion, collection, [hunter, titan, warlock]);
    const result = buildAdvisorRecommendations(normalized, character);
    expect(result.recommendations).toHaveLength(24);
    expect(result.recommendations.every((entry) => entry.classType === expectedClass)).toBe(true);
    for (const subclass of ["arc", "solar", "void", "strand", "stasis", "prismatic"] as const) {
      expect(result.recommendations.filter((entry) => entry.subclass === subclass)).toHaveLength(4);
    }
    expect(BUILD_ADVISOR_TEMPLATES.some((template) => template.classType === expectedClass)).toBe(true);
  });
});

function voidHunterAbilityDefinitions(): Record<string, any> {
  return {
    "9001": abilityDefinition("Shadowshot: Deadfall", "hunter.void.supers"),
    "9002": abilityDefinition("Gambler's Dodge", "hunter.void.class_abilities"),
    "9003": abilityDefinition("Triple Jump", "hunter.void.movement"),
    "9004": abilityDefinition("Snare Bomb", "hunter.void.melee"),
    "9005": abilityDefinition("Vortex Grenade", "shared.void.grenades"),
    "9006": abilityDefinition("Vanishing Step", "hunter.void.aspects"),
    "9007": abilityDefinition("Stylish Executioner", "hunter.void.aspects"),
    "9008": abilityDefinition("Echo of Starvation", "shared.void.fragments"),
    "9009": abilityDefinition("Echo of Persistence", "shared.void.fragments"),
    "9010": abilityDefinition("Echo of Cessation", "shared.void.fragments"),
    "9011": abilityDefinition("Echo of Obscurity", "shared.void.fragments")
  };
}
