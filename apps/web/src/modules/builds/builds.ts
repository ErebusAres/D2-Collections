import type { BuildDocument, BuildGuardianClass, BuildSubclass, GuardianBuild } from "@guardian-nexus/contracts";
import { normalizeArmorSetSelections } from "@guardian-nexus/domain";
import { defaultBuildStatPriorities, normalizeBuildStatPriorities } from "./buildStats";

export type BuildSort = "updated" | "newest" | "top" | "most-voted";

export interface BuildFilters {
  search: string;
  classType: "all" | BuildGuardianClass;
  subclass: "all" | BuildSubclass;
  activity: string;
  author: string;
  tag: string;
  exoticArmor: string;
  exoticWeapon: string;
  artifact: string;
  feature: "all" | "dim" | "video" | "notes";
  sort: BuildSort;
}

export const defaultBuildFilters: BuildFilters = {
  search: "",
  classType: "all",
  subclass: "all",
  activity: "all",
  author: "all",
  tag: "all",
  exoticArmor: "all",
  exoticWeapon: "all",
  artifact: "all",
  feature: "all",
  sort: "updated"
};

export function emptyBuildDocument(): BuildDocument {
  return {
    title: "",
    classType: "hunter",
    subclass: "prismatic",
    tags: [],
    activityTags: [],
    summary: "",
    notes: "",
    concepts: [],
    championCounters: [],
    links: [],
    subclassConfig: { aspects: [], fragments: [] },
    equipment: { weapons: [], armor: [], armorSets: [] },
    statPriorities: defaultBuildStatPriorities(),
    armorMods: { helmet: [], arms: [], chest: [], legs: [], classItem: [] },
    artifacts: [],
    gameplayLoop: [],
    cosmetics: { ornaments: [] },
    outdated: false,
    changelog: [],
    status: "draft",
    visibility: "private"
  };
}

export function filterBuilds(builds: GuardianBuild[], filters: BuildFilters): GuardianBuild[] {
  const query = filters.search.trim().toLowerCase();
  return builds.filter((build) => {
    if (filters.classType !== "all" && build.classType !== filters.classType) return false;
    if (filters.subclass !== "all" && build.subclass !== filters.subclass) return false;
    if (filters.activity !== "all" && !build.activityTags.includes(filters.activity)) return false;
    if (filters.author !== "all" && build.authorDisplayName !== filters.author && build.originalCreatorName !== filters.author) return false;
    if (filters.tag !== "all" && !build.tags.includes(filters.tag)) return false;
    if (filters.exoticArmor !== "all" && !build.equipment.armor.some((entry) => entry.exotic && entry.name === filters.exoticArmor)) return false;
    if (filters.exoticWeapon !== "all" && !build.equipment.weapons.some((entry) => entry.exotic && entry.name === filters.exoticWeapon)) return false;
    if (filters.artifact !== "all" && !build.artifacts.some((entry) => entry.name === filters.artifact)) return false;
    if (filters.feature === "dim" && !build.links.some((link) => link.kind === "dim")) return false;
    if (filters.feature === "video" && !build.links.some((link) => link.kind === "youtube" || link.kind === "twitch")) return false;
    if (filters.feature === "notes" && !build.notes.trim()) return false;
    if (query && !buildSearchText(build).includes(query)) return false;
    return true;
  }).sort((left, right) => {
    if (filters.sort === "top") return (right.rating.percentPositive ?? -1) - (left.rating.percentPositive ?? -1) || right.rating.total - left.rating.total;
    if (filters.sort === "most-voted") return right.rating.total - left.rating.total || Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    if (filters.sort === "newest") return Date.parse(right.createdAt) - Date.parse(left.createdAt);
    return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  });
}

function buildSearchText(build: GuardianBuild): string {
  const armorMods = Object.values(build.armorMods).flat();
  const subclassChoices = [build.subclassConfig.super, build.subclassConfig.classAbility, build.subclassConfig.movement, build.subclassConfig.melee, build.subclassConfig.grenade, build.subclassConfig.transcendence]
    .flatMap((entry) => entry ? [entry] : []);
  const named = [
    ...build.equipment.weapons,
    ...build.equipment.armor,
    ...build.equipment.armorSets,
    ...build.equipment.armorSets.flatMap((entry) => entry.bonuses || []),
    ...build.equipment.weapons.flatMap((entry) => entry.selectedPerks || []),
    ...armorMods,
    ...build.artifacts,
    ...build.artifacts.flatMap((artifact) => artifact.perks),
    ...build.concepts,
    ...subclassChoices,
    ...build.subclassConfig.aspects,
    ...build.subclassConfig.fragments,
    ...build.cosmetics.ornaments,
    ...[build.cosmetics.shader, build.cosmetics.ghost, build.cosmetics.sparrow, build.cosmetics.ship].flatMap((entry) => entry ? [entry] : [])
  ].map((entry) => `${entry.name} ${entry.setName || ""} ${entry.description || ""} ${entry.notes || ""}`).join(" ");
  return [build.title, build.tags.join(" "), build.activityTags.join(" "), build.authorDisplayName, build.originalCreatorName, build.summary, build.notes, build.classType, build.subclass, named]
    .filter(Boolean).join(" ").toLowerCase();
}

export function buildDiscordSummary(build: GuardianBuild): string {
  const links = build.links.map((link) => `- ${link.label}: ${link.url}`).join("\n");
  const weapons = build.equipment.weapons.map((item) => `- ${item.slot}: ${item.name}${item.selectedPerks?.length ? ` — ${item.selectedPerks.map((perk) => perk.name).join(", ")}` : item.perks ? ` — ${item.perks}` : ""}${item.required ? " (required)" : ""}`).join("\n");
  const stats = [...build.statPriorities].sort((a, b) => a.priority - b.priority).map((stat) => `- ${stat.stat}: ${stat.target ?? stat.minimum ?? "priority"}`).join("\n");
  const artifacts = build.artifacts.map((artifact) => `- ${artifact.name}: ${artifact.perks.map((perk) => perk.name).join(", ") || "no perks listed"}`).join("\n");
  const concepts = build.concepts.map((entry) => entry.name).join(", ");
  const loop = build.gameplayLoop.map((step, index) => `${index + 1}. ${step.text}`).join("\n");
  return [
    `**${build.title}** · ${titleCase(build.classType)} / ${titleCase(build.subclass)}`,
    build.tags.map((tag) => `#${tag.replace(/\s+/g, "-")}`).join(" "),
    build.summary,
    links && `**Links**\n${links}`,
    weapons && `**Weapons**\n${weapons}`,
    stats && `**Stat priorities**\n${stats}`,
    artifacts && `**Artifact**\n${artifacts}`,
    concepts && `**At a glance**\n${concepts}`,
    loop && `**Gameplay loop**\n${loop}`,
    build.notes && `**Notes**\n${build.notes}`
  ].filter(Boolean).join("\n\n");
}

export function titleCase(value: string): string {
  return value ? `${value[0]!.toUpperCase()}${value.slice(1)}` : value;
}

export function splitTags(value: string): string[] {
  const tags: string[] = [];
  for (const segment of value.split(/[,\n]+/)) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const hashtags = [...trimmed.matchAll(/#([^#\s,]+)/g)].map((match) => match[1]!.trim()).filter(Boolean);
    if (trimmed.startsWith("#") && hashtags.length === 1) tags.push(trimmed.slice(1).trim());
    else if (hashtags.length) {
      const plain = trimmed.replace(/#[^#\s,]+/g, " ").trim();
      if (plain) tags.push(plain);
      tags.push(...hashtags);
    } else tags.push(trimmed.replace(/^#+/, "").trim());
  }
  return [...new Set(tags.filter(Boolean))].slice(0, 20);
}

export function prepareBuildDocument(value: BuildDocument): BuildDocument {
  const named = <T extends { name: string }>(entries: T[]): T[] => entries.filter((entry) => entry.name.trim()).map((entry) => clean(entry));
  const expanded = (entries: BuildDocument["armorMods"][keyof BuildDocument["armorMods"]]) => entries.flatMap((entry) => Array.from({ length: Math.max(1, entry.quantity || 1) }, () => ({ ...entry, quantity: undefined })));
  const optionalNamed = <T extends { name: string }>(entry: T | undefined): T | undefined => entry?.name.trim() ? clean(entry) : undefined;
  return clean({
    ...value,
    title: value.title.trim(),
    tags: value.tags.map((entry) => entry.trim()).filter(Boolean),
    activityTags: value.activityTags.map((entry) => entry.trim()).filter(Boolean),
    concepts: named(value.concepts),
    championCounters: named(value.championCounters),
    links: value.links.filter((entry) => entry.label.trim() && entry.url.trim()).map((entry) => clean(entry)),
    subclassConfig: {
      ...value.subclassConfig,
      super: optionalNamed(value.subclassConfig.super),
      classAbility: optionalNamed(value.subclassConfig.classAbility),
      movement: optionalNamed(value.subclassConfig.movement),
      melee: optionalNamed(value.subclassConfig.melee),
      grenade: optionalNamed(value.subclassConfig.grenade),
      transcendence: value.subclass === "prismatic" ? optionalNamed(value.subclassConfig.transcendence) : undefined,
      aspects: named(value.subclassConfig.aspects),
      fragments: named(value.subclassConfig.fragments)
    },
    equipment: {
      weapons: named(value.equipment.weapons).filter((entry) => entry.slot.trim()).map((entry) => ({ ...entry, selectedPerks: named(entry.selectedPerks || []), traits: named(entry.traits || []) })),
      armor: named(value.equipment.armor).filter((entry) => entry.slot.trim()).map((entry) => ({ ...entry, traits: named(entry.traits || []), selectedSpirits: named(entry.selectedSpirits || []).slice(0, 2) })),
      armorSets: named(normalizeArmorSetSelections(value.equipment.armorSets)).slice(0, 2)
    },
    statPriorities: normalizeBuildStatPriorities(value.statPriorities).map((entry) => clean(entry)),
    armorMods: {
      helmet: named(expanded(value.armorMods.helmet)).slice(0, 3),
      arms: named(expanded(value.armorMods.arms)).slice(0, 3),
      chest: named(expanded(value.armorMods.chest)).slice(0, 3),
      legs: named(expanded(value.armorMods.legs)).slice(0, 3),
      classItem: named(expanded(value.armorMods.classItem)).slice(0, 3)
    },
    artifacts: named(value.artifacts).slice(0, 7).map((artifact) => ({
      ...artifact,
      perks: uniqueNamed(named(artifact.perks)).slice(0, 7).sort((left, right) => (left.artifactSlot || 8) - (right.artifactSlot || 8))
    })),
    gameplayLoop: value.gameplayLoop.filter((entry) => entry.text.trim()).map((entry) => clean(entry)),
    cosmetics: {
      ...value.cosmetics,
      shader: optionalNamed(value.cosmetics.shader),
      ornaments: named(value.cosmetics.ornaments),
      ghost: optionalNamed(value.cosmetics.ghost),
      sparrow: optionalNamed(value.cosmetics.sparrow),
      ship: optionalNamed(value.cosmetics.ship)
    },
    changelog: value.changelog.filter((entry) => entry.notes.trim()).map((entry) => clean(entry)),
    visibility: value.status === "published" ? "public" : "private"
  });
}

function uniqueNamed<T extends { name: string; hash?: string }>(values: T[]): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const identity = value.hash ? `hash:${value.hash}` : `name:${value.name.trim().toLocaleLowerCase()}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clean) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== "" && entry !== undefined)
      .map(([key, entry]) => [key, clean(entry)])) as T;
  }
  return value;
}
