import type { BuildEquipmentEntry, BuildStatName, GuardianBuild } from "@guardian-nexus/contracts";
import type { BuildAdvisorTemplate, BuildAdvisorWeaponRequirement } from "./buildAdvisorTemplates";

const ALL_STATS: BuildStatName[] = ["Health", "Melee", "Grenade", "Super", "Class", "Weapons"];

export function buildAdvisorTemplatesFromPublishedBuilds(builds: GuardianBuild[]): BuildAdvisorTemplate[] {
  return builds.flatMap((build) => {
    const template = templateFromPublishedBuild(build);
    return template ? [template] : [];
  });
}

function templateFromPublishedBuild(build: GuardianBuild): BuildAdvisorTemplate | undefined {
  if (build.outdated || build.status !== "published" || build.visibility !== "public") return undefined;
  const exoticArmor = build.equipment.armor.find(isExoticEquipment);
  const weapons = build.equipment.weapons.slice(0, 3);
  const abilities = build.subclassConfig;
  if (
    !exoticArmor
    || weapons.length !== 3
    || !build.ghostFocus
    || !abilities.super
    || !abilities.classAbility
    || !abilities.movement
    || !abilities.melee
    || !abilities.grenade
    || abilities.aspects.length === 0
    || abilities.fragments.length === 0
  ) return undefined;

  const profile = publishedBuildProfile(build);
  return {
    id: `published-${build.id}`,
    version: 1,
    reviewedAt: (build.updatedAt || build.publishedAt || new Date().toISOString()).slice(0, 10),
    release: build.patch || "Published build",
    sourceNotes: `Published by ${build.authorDisplayName}.`,
    source: {
      kind: "published-build",
      label: "Published Guardian Nexus build",
      buildId: build.id,
      buildSlug: build.slug,
      authorDisplayName: build.authorDisplayName,
      rating: build.rating
    },
    enabled: true,
    name: build.title,
    classType: build.classType,
    subclass: build.subclass,
    summary: build.summary,
    requiredExoticArmor: exoticArmor.name,
    preferredExoticWeapon: weapons.find(isExoticEquipment)?.name,
    ghostFocus: {
      archetype: build.ghostFocus.mod.name.replace(/\s+Armorer$/i, ""),
      primaryStat: build.ghostFocus.primaryStat,
      secondaryStat: build.ghostFocus.secondaryStat,
      notes: build.ghostFocus.notes || `Focus ${build.ghostFocus.primaryStat}, then ${build.ghostFocus.secondaryStat}.`
    },
    weapons: weapons.map(weaponRequirement),
    abilities: {
      super: abilities.super.name,
      classAbility: abilities.classAbility.name,
      movement: abilities.movement.name,
      melee: abilities.melee.name,
      grenade: abilities.grenade.name,
      aspects: abilities.aspects.map((entry) => entry.name),
      fragments: abilities.fragments.map((entry) => entry.name)
    },
    armorMods: {
      helmet: build.armorMods.helmet.map((entry) => entry.name),
      arms: build.armorMods.arms.map((entry) => entry.name),
      chest: build.armorMods.chest.map((entry) => entry.name),
      legs: build.armorMods.legs.map((entry) => entry.name),
      classItem: build.armorMods.classItem.map((entry) => entry.name)
    },
    statPriorities: completeStatPriorities(build),
    artifactPerks: build.artifacts.flatMap((artifact) => artifact.perks.map((entry) => entry.name)),
    artifactDependency: build.artifacts.some((artifact) => artifact.perks.some((entry) => entry.required)) ? "high" : build.artifacts.length ? "medium" : "none",
    gameplayLoop: build.gameplayLoop.map((entry) => entry.text),
    damageRotation: build.gameplayLoop.map((entry) => entry.text),
    activities: build.activityTags.length ? build.activityTags : ["General PvE"],
    strengths: build.concepts.map((entry) => entry.name),
    weaknesses: [],
    style: build.summary || build.tags.join(" · "),
    role: build.tags[0] || "Published build",
    damageProfile: profile.damage,
    bossDamage: profile.boss,
    addClear: profile.addClear,
    survivability: profile.survivability,
    abilityUptime: "medium",
    complexity: "medium",
    solo: profile.solo,
    group: profile.group,
    powerFriendly: profile.powerFriendly,
    difficultExecution: false,
    teammateDependency: "low",
    upgrades: []
  };
}

function weaponRequirement(item: BuildEquipmentEntry, index: number): BuildAdvisorWeaponRequirement {
  return {
    id: `published-weapon-${index + 1}`,
    label: item.required ? `Required ${item.slot || "weapon"}` : item.slot || `Weapon ${index + 1}`,
    slots: item.slot ? [item.slot] : undefined,
    preferredNames: [item.name],
    requiresExotic: isExoticEquipment(item),
    preferredPerks: item.selectedPerks?.map((entry) => entry.name)
  };
}

function isExoticEquipment(item: BuildEquipmentEntry): boolean {
  return Boolean(item.exotic || /exotic/i.test(item.rarity || ""));
}

function completeStatPriorities(build: GuardianBuild): BuildAdvisorTemplate["statPriorities"] {
  const byStat = new Map(build.statPriorities.map((entry) => [entry.stat, entry]));
  const ordered = [
    ...build.statPriorities.slice().sort((left, right) => left.priority - right.priority).map((entry) => entry.stat),
    ...ALL_STATS.filter((stat) => !byStat.has(stat))
  ].filter((stat, index, all) => all.indexOf(stat) === index);
  return ordered.map((stat, index) => {
    const saved = byStat.get(stat);
    return {
      stat,
      priority: index + 1,
      ...(saved?.target !== undefined ? { target: saved.target } : {}),
      ...(saved?.notes ? { notes: saved.notes } : {})
    };
  });
}

function publishedBuildProfile(build: GuardianBuild): {
  damage: "high" | "medium" | "low";
  boss: "high" | "medium" | "low";
  addClear: "high" | "medium" | "low";
  survivability: "high" | "medium" | "low";
  solo: "high" | "medium" | "low";
  group: "high" | "medium" | "low";
  powerFriendly: boolean;
} {
  const tags = `${build.tags.join(" ")} ${build.activityTags.join(" ")}`.toLocaleLowerCase();
  const boss = /boss|damage/.test(tags) ? "high" : "medium";
  const addClear = /add clear|ad clear|general pve/.test(tags) ? "high" : "medium";
  const survivability = /solo|surviv|healing|invis/.test(tags) ? "high" : "medium";
  return {
    damage: boss === "high" ? "high" : "medium",
    boss,
    addClear,
    survivability,
    solo: /solo/.test(tags) ? "high" : "medium",
    group: /raid|nightfall|group|team/.test(tags) ? "high" : "medium",
    powerFriendly: /power|level|general pve/.test(tags)
  };
}
