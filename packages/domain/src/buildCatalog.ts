import type { BuildCatalogEntry } from "@guardian-nexus/contracts";

/**
 * Bungie's inventory manifest includes both playable subclass definitions and
 * retired presentation/banner records with the same names. Keep one playable
 * identity per Guardian class and element, preferring the equipped Subclass
 * bucket definition that carries the in-game diamond (or Prismatic circle).
 */
export function canonicalBuildCatalogEntries(entries: BuildCatalogEntry[]): BuildCatalogEntry[] {
  const subclasses = new Map<string, BuildCatalogEntry>();
  const remaining: BuildCatalogEntry[] = [];
  for (const entry of entries) {
    if (entry.kind !== "subclass" || !entry.classType || !entry.subclass) {
      remaining.push(entry);
      continue;
    }
    const key = `${entry.classType}:${entry.subclass}`;
    const current = subclasses.get(key);
    if (!current || subclassDefinitionScore(entry) > subclassDefinitionScore(current)) subclasses.set(key, entry);
  }
  return [...remaining, ...subclasses.values()];
}

function subclassDefinitionScore(entry: BuildCatalogEntry): number {
  return (entry.slot.toLocaleLowerCase() === "subclass" ? 8 : 0)
    + (entry.rarity.toLocaleLowerCase() === "common" ? 4 : 0)
    + (/\.png(?:\?|$)/i.test(entry.icon) ? 2 : 0)
    + (entry.itemType.toLocaleLowerCase().endsWith(" subclass") ? 1 : 0);
}
