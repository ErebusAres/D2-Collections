import type { GuardianBuild } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { buildAdvisorTemplatesFromPublishedBuilds } from "./buildAdvisorPublished";

describe("published Build Advisor templates", () => {
  it("turns a complete current published build into a scored advisor candidate", () => {
    const [template] = buildAdvisorTemplatesFromPublishedBuilds([publishedBuild()]);
    expect(template).toMatchObject({
      id: "published-build-1",
      requiredExoticArmor: "Gyrfalcon's Hauberk",
      preferredExoticWeapon: "Graviton Lance",
      source: {
        kind: "published-build",
        buildId: "build-1",
        buildSlug: "void-build"
      }
    });
    expect(template?.weapons).toHaveLength(3);
    expect(template?.abilities.aspects).toEqual(["Vanishing Step", "Stylish Executioner"]);
    expect(template?.statPriorities).toHaveLength(6);
  });

  it("does not present an incomplete published build as a known complete build", () => {
    const build = publishedBuild();
    build.ghostFocus = undefined;
    expect(buildAdvisorTemplatesFromPublishedBuilds([build])).toEqual([]);
  });

  it("excludes builds that are not marked for the current Monument of Triumph sandbox", () => {
    const build = publishedBuild();
    build.patch = "The Final Shape";
    expect(buildAdvisorTemplatesFromPublishedBuilds([build])).toEqual([]);
  });
});

function publishedBuild(): GuardianBuild {
  return {
    id: "build-1",
    slug: "void-build",
    authorMembershipId: "editor",
    authorDisplayName: "Build Editor",
    rating: { upvotes: 8, downvotes: 1, total: 9, score: 7, percentPositive: 89 },
    canEdit: false,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-26T00:00:00.000Z",
    publishedAt: "2026-07-26T00:00:00.000Z",
    title: "Published Void Build",
    classType: "hunter",
    subclass: "void",
    tags: ["General PvE"],
    activityTags: ["Solo", "Nightfall"],
    summary: "A complete published Void build.",
    notes: "",
    patch: "Monument of Triumph · Update 9.7.0",
    concepts: [],
    championCounters: [],
    links: [],
    subclassConfig: {
      super: { name: "Shadowshot: Deadfall" },
      classAbility: { name: "Gambler's Dodge" },
      movement: { name: "Triple Jump" },
      melee: { name: "Snare Bomb" },
      grenade: { name: "Vortex Grenade" },
      aspects: [{ name: "Vanishing Step" }, { name: "Stylish Executioner" }],
      fragments: [{ name: "Echo of Starvation" }, { name: "Echo of Persistence" }, { name: "Echo of Cessation" }, { name: "Echo of Obscurity" }]
    },
    equipment: {
      weapons: [
        { name: "Kinetic Special", slot: "Kinetic Weapons", selectedPerks: [{ name: "Chill Clip" }] },
        { name: "Graviton Lance", slot: "Energy Weapons", exotic: true, required: true },
        { name: "Damage Heavy", slot: "Power Weapons", selectedPerks: [{ name: "Bait and Switch" }] }
      ],
      armor: [{ name: "Gyrfalcon's Hauberk", slot: "Chest Armor", exotic: true, required: true }],
      armorSets: []
    },
    statPriorities: [
      { stat: "Class", priority: 1, target: 100 },
      { stat: "Health", priority: 2, target: 100 },
      { stat: "Weapons", priority: 3, target: 100 },
      { stat: "Grenade", priority: 4, target: 70 },
      { stat: "Melee", priority: 5, target: 50 },
      { stat: "Super", priority: 6, target: 30 }
    ],
    ghostFocus: {
      mod: { name: "Reaver Armorer" },
      primaryStat: "Class",
      secondaryStat: "Melee"
    },
    armorMods: {
      helmet: [{ name: "Harmonic Siphon" }],
      arms: [{ name: "Firepower" }],
      chest: [{ name: "Concussive Dampener" }],
      legs: [{ name: "Recuperation" }],
      classItem: [{ name: "Reaper" }]
    },
    artifacts: [],
    gameplayLoop: [{ text: "Dodge, attack, and reset invisibility." }],
    cosmetics: { ornaments: [] },
    outdated: false,
    changelog: [],
    status: "published",
    visibility: "public"
  };
}
