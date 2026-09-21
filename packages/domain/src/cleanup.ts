import type { ArmorItem, ArmorStatKey, CleanupRecommendation, CleanupSettings, GearData, WeaponItem } from "@guardian-nexus/contracts";

export const CLEANUP_DEFAULTS: CleanupSettings = { focus: "both", location: "vault", exact: true, dominance: true, preferences: true, aggressive: false, fullComparison: true, legacyReview: true, sources: ["voltron"], priorities: { health: 1, melee: 1, grenade: 1, super: 1, class: 1, weapons: 1 } };
type Item = ArmorItem | WeaponItem;
export interface CleanupWishlist { id: string; name: string; reviewedAt: string; perkAliases?: Record<string, string>; items: Record<string, { disliked?: boolean; pve: { recommendations: number; columns: string[][]; traitPairs: string[] }; pvp: { recommendations: number; columns: string[][]; traitPairs: string[] } }> }
const stats: ArmorStatKey[] = ["health", "melee", "grenade", "super", "class", "weapons"];
const weapon = (item: Item): item is WeaponItem => "perkColumns" in item;
const sorted = (values: string[]) => [...new Set(values)].sort();

export function cleanupProtections(item: Item, highest: Map<string, string>, saved: Set<string>): string[] {
  return [item.locked && "Locked", item.equipped && "Equipped", item.tag && `Manual ${item.tag} tag`, saved.has(item.instanceId) && "Saved build or loadout", item.instanceId === highest.get(slotKey(item)) && "Retained highest-Power copy in slot", item.rarity === "Exotic" && "Exotic", item.inPostmaster && "Postmaster item", weapon(item) && item.crafted && "Crafted investment", weapon(item) && item.enhanced && "Enhanced investment"].filter(Boolean) as string[];
}
function slotKey(item: Item) { return weapon(item) ? `weapon:${item.slot}` : `${item.className}:${item.slot}`; }
function family(item: Item): string {
  return JSON.stringify(weapon(item) ? ["weapon", item.itemHash, item.slot, item.damageType, item.gearTier, item.crafted, item.enhanced, item.masterwork?.hash, sorted(item.originTraits.map((p) => p.hash))] : ["armor", item.itemHash, item.className, item.slot, item.gearTier, item.archetype?.hash, item.tunedStat, item.tuning?.hash, item.tuning?.stats, sorted(item.setBonuses.map((p) => `${p.hash}:${p.pieces}`)), sorted(item.perks.map((p) => p.hash))]);
}
function roll(item: WeaponItem) {
  return JSON.stringify(item.perkColumns.map((column) => [column.socketIndex, column.kind, sorted(column.selectablePlugHashes || [])]).sort((a, b) => Number(a[0]) - Number(b[0])));
}
function comparisonFamily(item: Item, settings: CleanupSettings): string {
  if (weapon(item) || !settings.fullComparison || !item.cleanupSocketKey || item.rarity === "Exotic") return family(item);
  // Exact socket capabilities include special raid/artifice slots; never infer equivalence from totals.
  return JSON.stringify(["compatible-armor", item.className, item.slot, item.rarity, item.gearTier, item.armorSystem, item.archetype?.hash, item.tunedStat, item.cleanupSocketKey, sorted(item.setBonuses.map((p) => `${p.hash}:${p.pieces}`))]);
}
function evidence(item: Item) {
  return [family(item), item.power, item.masterworked, weapon(item) ? [roll(item), item.stats, item.trackerValue] : [item.baseStats, item.tuning]];
}
function complete(item: Item) {
  if (!item.instanceId || item.slot === "Unknown" || item.power <= 0 || item.inPostmaster || (item.location !== "vault" && !item.ownerCharacterId)) return false;
  return weapon(item) ? item.rollDataState === "complete" && Boolean(item.stats?.length) && item.perkColumns.length > 0 && item.perkColumns.every((c) => Boolean(c.selectablePlugHashes?.length)) : item.className !== "Unknown" && item.baseTotal > 0 && stats.every((key) => Number.isFinite(item.baseStats[key]));
}
function endorsed(item: WeaponItem, source: CleanupWishlist, mode: "pve" | "pvp"): boolean | undefined {
  const record = source.items[item.itemHash]; const bucket = record?.[mode];
  if (!record || !bucket?.recommendations) return undefined;
  if (record.disliked) return false;
  const canonical = (hash: string) => source.perkAliases?.[hash] || hash;
  const columns = [0, 1, 2, 3].map((index) => new Set(item.perkColumns.filter((c) => c.ratingColumn === index).flatMap((c) => c.selectablePlugHashes || []).map(canonical)));
  if (columns.some((column) => column.size === 0)) return undefined;
  const attachments = [0, 1].every((index) => !bucket.columns[index]?.length || bucket.columns[index]!.some((hash) => columns[index]!.has(canonical(hash))));
  if (!bucket.traitPairs?.length) return undefined;
  return attachments && bucket.traitPairs.some((pair) => pair.split(",").every((hash, index) => !hash || columns[index + 2]?.has(canonical(hash))));
}
function comparison(candidate: Item, keeper: Item, settings: CleanupSettings, sources: CleanupWishlist[]): { confidence: 99 | 95 | 70; reason: string } | undefined {
  if (comparisonFamily(candidate, settings) !== comparisonFamily(keeper, settings) || keeper.power < candidate.power || (candidate.masterworked && !keeper.masterworked)) return;
  if (weapon(candidate) && weapon(keeper)) {
    if ((candidate.trackerValue || 0) > (keeper.trackerValue || 0)) return;
    if (roll(candidate) !== roll(keeper)) {
      const superset = keeper.perkColumns.length === candidate.perkColumns.length && candidate.perkColumns.every((column) => {
        const kept = keeper.perkColumns.find((other) => other.socketIndex === column.socketIndex && other.kind === column.kind);
        return kept && (column.selectablePlugHashes || []).every((hash) => kept.selectablePlugHashes?.includes(hash));
      });
      if (settings.dominance && superset && JSON.stringify(candidate.stats) === JSON.stringify(keeper.stats)) return { confidence: 95, reason: "The kept copy offers every selectable option on this roll, plus more, with matching stats and no lower investment." };
      const modes = settings.focus === "both" ? ["pve", "pvp"] as const : [settings.focus];
      if (settings.preferences && sources.length === new Set(settings.sources).size && sources.every((source) => modes.every((mode) => endorsed(keeper, source, mode) === true && endorsed(candidate, source, mode) === false))) return { confidence: 70, reason: `Selected sources prefer an available roll on the kept copy for ${settings.focus}. This is a preference, not proof this roll is bad.` };
      return;
    }
    // Different stat outcomes may represent investments or mod effects: do not assume equivalence.
    if (JSON.stringify(candidate.stats) !== JSON.stringify(keeper.stats)) return;
    return settings.exact ? { confidence: 99, reason: "Identical selectable roll; keeping the equal or better-invested copy." } : undefined;
  }
  if (weapon(candidate) || weapon(keeper)) return;
  const equal = stats.every((key) => candidate.baseStats[key] === keeper.baseStats[key]);
  if (equal && settings.exact) return { confidence: 99, reason: "Identical armor fit and base stats; keeping the equal or better-invested copy." };
  if (!equal && settings.dominance && stats.every((key) => keeper.baseStats[key] >= candidate.baseStats[key])) return { confidence: 95, reason: "Same armor fit; the kept copy has no lower base stat and at least one higher stat." };
  if (settings.preferences && stats.some((key) => settings.priorities[key] > 0) && stats.every((key) => !settings.priorities[key] || keeper.baseStats[key] >= candidate.baseStats[key]) && stats.some((key) => settings.priorities[key] > 0 && keeper.baseStats[key] > candidate.baseStats[key])) return { confidence: 70, reason: "Same armor fit; the kept copy improves your chosen stats. Ignored stats may be worse." };
}

export function analyzeCleanup(gear: GearData, settings: CleanupSettings, saved: Set<string>, protectionComplete: boolean, sources: CleanupWishlist[] = []): { recommendations: CleanupRecommendation[]; insufficient: string[] } {
  const items: Item[] = [...gear.items, ...(gear.weapons || [])];
  const highest = new Map<string, string>();
  [...items].sort((a, b) => b.power - a.power || Number(b.locked || b.equipped || Boolean(b.tag) || saved.has(b.instanceId)) - Number(a.locked || a.equipped || Boolean(a.tag) || saved.has(a.instanceId)) || Number(b.masterworked) - Number(a.masterworked) || a.instanceId.localeCompare(b.instanceId)).forEach((item) => { if (!highest.has(slotKey(item))) highest.set(slotKey(item), item.instanceId); });
  const protections = new Map(items.map((item) => [item.instanceId, cleanupProtections(item, highest, saved)]));
  const insufficient = items.filter((item) => !protectionComplete || !complete(item)).map((item) => item.instanceId);
  const incomplete = new Set(insufficient);
  const usable = items.filter((item) => !incomplete.has(item.instanceId));
  // Fixed ordering plus candidate/keeper reservation prevents cycles and keeper chains.
  usable.sort((a, b) => Number(Boolean(protections.get(b.instanceId)?.length)) - Number(Boolean(protections.get(a.instanceId)?.length)) || b.power - a.power || Number(b.masterworked) - Number(a.masterworked) || a.instanceId.localeCompare(b.instanceId));
  const positions = new Map(usable.map((item, index) => [item.instanceId, index]));
  const families = new Map<string, Item[]>();
  for (const item of usable) { const key = comparisonFamily(item, settings); const group = families.get(key) || []; group.push(item); families.set(key, group); }
  const candidates = new Set<string>(); const keepers = new Set<string>(); const recommendations: CleanupRecommendation[] = [];
  for (let i = usable.length - 1; i >= 0; i--) {
    const item = usable[i]!;
    if (keepers.has(item.instanceId) || (settings.location === "vault" && item.location !== "vault")) continue;
    const protectedBy = protections.get(item.instanceId) || [];
    if (protectedBy.length && !settings.aggressive) continue;
    for (const keeper of families.get(comparisonFamily(item, settings)) || []) {
      if (keeper.instanceId === item.instanceId || candidates.has(keeper.instanceId)) continue;
      const match = comparison(item, keeper, settings, sources);
      if (!match) continue;
      // Equivalent ties always preserve the same deterministic keeper.
      if (match.confidence === 99 && positions.get(keeper.instanceId)! > i) continue;
      candidates.add(item.instanceId); keepers.add(keeper.instanceId);
      recommendations.push({ itemId: item.instanceId, keeperId: keeper.instanceId, ...match, protections: protectedBy, actionable: protectedBy.length === 0, key: JSON.stringify([item.instanceId, keeper.instanceId, match.confidence, evidence(item), evidence(keeper), settings]) });
      break;
    }
  }
  // Older armor is a separate review queue, not proof of redundancy. Preserve every proposed replacement.
  if (settings.legacyReview) for (const item of usable) {
    if (weapon(item) || item.armorSystem !== "legacy" || item.rarity === "Exotic" || candidates.has(item.instanceId) || keepers.has(item.instanceId) || (settings.location === "vault" && item.location !== "vault")) continue;
    const protectedBy = protections.get(item.instanceId) || [];
    if (protectedBy.length && !settings.aggressive) continue;
    const keeper = usable.find((other) => !weapon(other) && other.armorSystem === "tiered" && other.className === item.className && other.slot === item.slot && other.rarity !== "Exotic" && !candidates.has(other.instanceId) && other.power >= item.power && stats.every((key) => other.baseStats[key] >= item.baseStats[key]));
    if (!keeper) continue;
    candidates.add(item.instanceId); keepers.add(keeper.instanceId);
    recommendations.push({ itemId: item.instanceId, keeperId: keeper.instanceId, confidence: 70, reason: "Older armor: this owned tiered piece has no lower base stats or Power. Review special mod slots and build uses before replacing it.", protections: [...protectedBy, "Legacy comparison: special capabilities require manual review"], actionable: false, key: JSON.stringify(["legacy-review", evidence(item), evidence(keeper), settings]) });
  }
  return { recommendations, insufficient };
}
