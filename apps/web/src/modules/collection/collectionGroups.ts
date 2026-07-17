import type { ExoticCollectionEntry, GuardianClass } from "@guardian-nexus/contracts";

export type CollectionClassScope = "hunter" | "titan" | "warlock" | "all";

export interface CollectionGroup {
  id: "weapons" | `armor-${Exclude<CollectionClassScope, "all">}`;
  title: string;
  eyebrow: string;
  entries: ExoticCollectionEntry[];
}

const PLAYABLE_CLASSES: GuardianClass[] = ["Hunter", "Titan", "Warlock"];

export function collectionClassScope(className?: GuardianClass): CollectionClassScope {
  const value = className?.toLowerCase();
  return value === "hunter" || value === "titan" || value === "warlock" ? value : "all";
}

export function scopeCollectionEntries(entries: ExoticCollectionEntry[], scope: CollectionClassScope): ExoticCollectionEntry[] {
  if (scope === "all") return entries;
  return entries.filter((entry) => entry.kind === "weapon" || entry.className?.toLowerCase() === scope);
}

export function groupCollectionEntries(entries: ExoticCollectionEntry[], scope: CollectionClassScope): CollectionGroup[] {
  const groups: CollectionGroup[] = [];
  const weapons = entries.filter((entry) => entry.kind === "weapon");
  if (weapons.length) groups.push({ id: "weapons", title: "Exotic Weapons", eyebrow: "Shared across every Guardian", entries: weapons });

  const classes = scope === "all"
    ? PLAYABLE_CLASSES
    : PLAYABLE_CLASSES.filter((className) => className.toLowerCase() === scope);
  for (const className of classes) {
    const armor = entries.filter((entry) => entry.kind === "armor" && entry.className === className);
    if (armor.length) groups.push({
      id: `armor-${className.toLowerCase()}` as CollectionGroup["id"],
      title: `${className} Exotic Armor`,
      eyebrow: `${className} collection`,
      entries: armor
    });
  }
  return groups;
}
