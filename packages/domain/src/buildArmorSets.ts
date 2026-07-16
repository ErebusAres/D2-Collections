import type { BuildNamedEntry } from "@guardian-nexus/contracts";

export function normalizeArmorSetSelections(values: BuildNamedEntry[]): BuildNamedEntry[] {
  const expanded = values.flatMap(expandLegacyCombinedSelection);
  const unique = expanded.filter((entry, index) => expanded.findIndex((candidate) => sameBonus(candidate, entry)) === index);
  const primary = unique.find((entry) => entry.requiredPieces === 2);
  if (!primary) return unique.slice(0, 2);
  const secondary = unique.find((entry) => entry !== primary && (
    entry.requiredPieces === 4 && sameSet(entry, primary)
    || entry.requiredPieces === 2 && !sameSet(entry, primary)
  ));
  return secondary ? [primary, secondary] : [primary];
}

export function armorSetOptionAllowed(values: BuildNamedEntry[], option: BuildNamedEntry): boolean {
  const selected = normalizeArmorSetSelections(values);
  if (selected.length >= 2) return false;
  if (!selected.length) return option.requiredPieces === 2;
  const primary = selected[0]!;
  return option.requiredPieces === 4
    ? sameSet(primary, option)
    : option.requiredPieces === 2 && !sameSet(primary, option);
}

export function addArmorSetSelection(values: BuildNamedEntry[], option: BuildNamedEntry): BuildNamedEntry[] {
  const selected = normalizeArmorSetSelections(values);
  const next = normalizeArmorSetSelections([option])[0] || option;
  if (!armorSetOptionAllowed(selected, next)) return selected;
  return normalizeArmorSetSelections([...selected, next]);
}

function expandLegacyCombinedSelection(entry: BuildNamedEntry): BuildNamedEntry[] {
  const exactBonuses = (entry.bonuses || []).filter((bonus) => bonus.requiredPieces === 2 || bonus.requiredPieces === 4);
  if (exactBonuses.length === 0) return [entry];
  return exactBonuses.map((bonus) => ({
    ...bonus,
    icon: bonus.icon || entry.icon,
    setName: entry.setName || setNameFromEntry(entry),
    requiredPieces: bonus.requiredPieces,
    bonuses: [{ ...bonus }]
  }));
}

function sameSet(left: BuildNamedEntry, right: BuildNamedEntry): boolean {
  return setNameFromEntry(left).toLocaleLowerCase() === setNameFromEntry(right).toLocaleLowerCase();
}

function sameBonus(left: BuildNamedEntry, right: BuildNamedEntry): boolean {
  return sameSet(left, right) && left.requiredPieces === right.requiredPieces;
}

function setNameFromEntry(entry: BuildNamedEntry): string {
  return (entry.setName || entry.name.replace(/\s*[·-]\s*(?:2|4)(?:\s*\+\s*4)?-?piece.*$/i, "")).trim();
}
