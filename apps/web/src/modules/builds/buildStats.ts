import type { BuildStatName, BuildStatPriority } from "@guardian-nexus/contracts";

export const BUILD_STAT_NAMES: BuildStatName[] = ["Health", "Melee", "Grenade", "Super", "Class", "Weapons"];

const STAT_ICONS: Record<BuildStatName, string> = {
  Health: "https://www.bungie.net/common/destiny2_content/icons/717b8b218cc14325a54869bef21d2964.png",
  Melee: "https://www.bungie.net/common/destiny2_content/icons/fa534aca76d7f2d7e7b4ba4df4271b42.png",
  Grenade: "https://www.bungie.net/common/destiny2_content/icons/065cdaabef560e5808e821cefaeaa22c.png",
  Super: "https://www.bungie.net/common/destiny2_content/icons/585ae4ede9c3da96b34086fccccdc8cd.png",
  Class: "https://www.bungie.net/common/destiny2_content/icons/7eb845acb5b3a4a9b7e0b2f05f5c43f1.png",
  Weapons: "https://www.bungie.net/common/destiny2_content/icons/bc69675acdae9e6b9a68a02fb4d62e07.png"
};

export function buildStatIcon(stat: BuildStatName): string {
  return STAT_ICONS[stat];
}

export function defaultBuildStatPriorities(): BuildStatPriority[] {
  return BUILD_STAT_NAMES.map((stat, index) => ({ stat, priority: index + 1, icon: buildStatIcon(stat) }));
}

export function normalizeBuildStatPriorities(values: BuildStatPriority[]): BuildStatPriority[] {
  const valid = values
    .filter((entry) => BUILD_STAT_NAMES.includes(entry.stat))
    .sort((left, right) => left.priority - right.priority);
  const byName = new Map(valid.map((entry) => [entry.stat, entry]));
  const selectedOrder = valid.map((entry) => entry.stat).filter((stat, index, entries) => entries.indexOf(stat) === index);
  const ordered = [...selectedOrder, ...BUILD_STAT_NAMES.filter((stat) => !byName.has(stat))];
  return ordered.slice(0, 6).map((stat, index) => ({
    ...byName.get(stat),
    stat,
    priority: index + 1,
    icon: byName.get(stat)?.icon || buildStatIcon(stat)
  }));
}

export type BuildStatValueLabel = { text: string; target: boolean };

export function buildStatValueLabels(stat: BuildStatPriority): BuildStatValueLabel[] {
  const labels: BuildStatValueLabel[] = [];
  if (stat.minimum !== undefined && stat.maximum !== undefined) {
    labels.push({ text: stat.minimum === stat.maximum ? `${stat.minimum}` : `${stat.minimum}–${stat.maximum}`, target: false });
  } else if (stat.minimum !== undefined) {
    labels.push({ text: `${stat.minimum}+`, target: false });
  } else if (stat.maximum !== undefined) {
    labels.push({ text: stat.maximum === 0 ? "0" : `0–${stat.maximum}`, target: false });
  }
  if (stat.target !== undefined) labels.push({ text: `${stat.target}`, target: true });
  return labels.length ? labels : [{ text: "Any", target: false }];
}
