import type { WeaponItem } from "@guardian-nexus/contracts";

export type WeaponScoreState = "scored" | "unavailable" | "incomplete";
export type WeaponQuality = "excellent" | "strong" | "mixed" | "weak" | "poor";
export type WeaponRatingConfidence = "high" | "medium" | "low";
export type WeaponRatingBasis = "weapon" | "weapon-family" | "weapon-type";
export type WeaponRatingSourceId = "voltron" | "choosy-voltron" | "just-another-team";

export const WEAPON_RATING_SOURCES: ReadonlyArray<{ id: WeaponRatingSourceId; label: string; usedBy: string; note: string }> = [
  { id: "voltron", label: "Voltron", usedBy: "DIM (default), Destiny Recipes", note: "The shared community recommendation catalog. Destiny Recipes loads Voltron and applies its own presentation and scoring." },
  { id: "choosy-voltron", label: "Choosy Voltron", usedBy: "DIM (optional)", note: "Voltron plus explicit negative weapon verdicts, so it can produce genuine dislikes instead of only recommendations." },
  { id: "just-another-team", label: "Just Another Team (MnK)", usedBy: "DIM (suggested option)", note: "DIM's current suggested alternative wishlist for mouse-and-keyboard recommendations." }
];

export function parseWeaponRatingSource(value?: string): WeaponRatingSourceId {
  return WEAPON_RATING_SOURCES.some((source) => source.id === value) ? value as WeaponRatingSourceId : "voltron";
}

export interface WeaponValue {
  state: WeaponScoreState;
  pve?: number;
  pvp?: number;
  overall?: number;
  quality?: WeaponQuality;
  confidence?: WeaponRatingConfidence;
  basis?: WeaponRatingBasis;
  comparedColumns?: number;
  totalColumns?: number;
  reasons: string[];
  source?: string;
  reviewedAt?: string;
}

export interface WeaponTraitValue {
  state: "scored" | "unavailable";
  pve?: number;
  pvp?: number;
  overall?: number;
  recommended: boolean;
  basis?: WeaponRatingBasis;
  confidence?: WeaponRatingConfidence;
  pvePairings?: number;
  pvpPairings?: number;
  reasons: string[];
  source?: string;
  reviewedAt?: string;
}

interface RatingBucket { recommendations: number; columns: string[][]; traitPairs: string[] }
interface RatingRecord { itemType: string; pve: RatingBucket; pvp: RatingBucket; disliked?: boolean }
interface TypeBucket { weapons: number; columns: Array<Record<string, number>> }
interface TypeRecord { pve: TypeBucket; pvp: TypeBucket }
export interface WeaponRatingDatabase {
  schemaVersion: 4;
  reviewedAt: string;
  source: { id?: WeaponRatingSourceId; name: string; url?: string; repository?: string; usedBy?: string[]; note?: string };
  method: { columnWeights: number[] };
  coverage: { manifestWeapons: number; reviewedWeapons: number; supportedTypes: number; reviewedTypes: number };
  perkAliases?: Record<string, string>;
  items: Record<string, RatingRecord>;
  families?: Record<string, TypeRecord>;
  types: Record<string, TypeRecord>;
}

interface ModeScore { score: number; compared: number; matched: number }
const loadedDatabases = new Map<WeaponRatingSourceId, WeaponRatingDatabase>();
const loadPromises = new Map<WeaponRatingSourceId, Promise<WeaponRatingDatabase | undefined>>();

export function loadWeaponRatings(sourceId: WeaponRatingSourceId = "voltron"): Promise<WeaponRatingDatabase | undefined> {
  const loaded = loadedDatabases.get(sourceId);
  if (loaded) return Promise.resolve(loaded);
  const existing = loadPromises.get(sourceId);
  if (existing) return existing;
  const filename = sourceId === "voltron" ? "weapon-value.v4.json" : `weapon-value.${sourceId}.v4.json`;
  const promise = fetch(`/data/${filename}`, { cache: "no-cache" })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Weapon ratings returned HTTP ${response.status}.`);
      const candidate = await response.json() as Partial<WeaponRatingDatabase>;
      if (candidate.schemaVersion !== 4 || !candidate.reviewedAt || !candidate.source?.name || !candidate.method?.columnWeights || !candidate.items || !candidate.types) throw new Error("Weapon ratings have an unsupported schema.");
      const database = candidate as WeaponRatingDatabase;
      loadedDatabases.set(sourceId, database);
      return database;
    })
    .catch(() => {
      loadPromises.delete(sourceId);
      return undefined;
    });
  loadPromises.set(sourceId, promise);
  return promise;
}

export function evaluateWeapon(weapon: WeaponItem, database = loadedDatabases.get("voltron")): WeaponValue {
  if (!database) return { state: "unavailable", reasons: ["The community rating catalog is still loading or unavailable. This is not a low score."] };
  const equipped = alignEquippedColumns(weapon);
  const equippedCount = equipped.filter((column) => column.length).length;
  const partial = weapon.rollDataState !== "complete";
  if (!equippedCount) return { state: "incomplete", reasons: ["Bungie has not returned an identifiable equipped rating perk yet. The weapon will be re-evaluated automatically after a fuller snapshot."], reviewedAt: database.reviewedAt };

  const record = database.items[weapon.itemHash];
  if (record) {
    const pveResult = scoreWeaponMode(record.pve, equipped, database.method.columnWeights, database.perkAliases);
    const pvpResult = scoreWeaponMode(record.pvp, equipped, database.method.columnWeights, database.perkAliases);
    if (!pveResult && !pvpResult && record.disliked) return {
      state: "scored", pve: 0, pvp: 0, overall: 0, quality: "poor", confidence: "high", basis: "weapon",
      comparedColumns: 0, totalColumns: 4,
      reasons: [`${database.source.name} explicitly gives this weapon a negative verdict; this is source evidence, not an inferred penalty for missing data.`],
      source: database.source.name, reviewedAt: database.reviewedAt
    };
    return scoredValue(pveResult, pvpResult, {
      basis: "weapon",
      confidence: partial || equippedCount < 4 ? (equippedCount >= 3 ? "medium" : "low") : "high",
      reason: partial
        ? `Bungie returned only part of the roll, so this provisional score compares the equipped perks in the ${equippedCount} known rating column${equippedCount === 1 ? "" : "s"} with ${database.source.name} recommendations for this exact weapon. It will update when more socket data arrives.`
        : `Compared the equipped roll in the four ${database.source.name} perk columns for this exact weapon while preserving curated trait pairings. Base and enhanced versions of a trait are treated as equivalent.`,
      source: database.source.name,
      reviewedAt: database.reviewedAt,
      totalColumns: 4
    });
  }

  const family = database.families?.[familyKey(weapon)];
  if (family) {
    const pveResult = scoreTypeMode(family.pve, equipped, database.method.columnWeights, database.perkAliases);
    const pvpResult = scoreTypeMode(family.pvp, equipped, database.method.columnWeights, database.perkAliases);
    const compared = Math.max(pveResult?.compared || 0, pvpResult?.compared || 0);
    if (compared) {
      const reviewedWeapons = Math.max(family.pve.weapons, family.pvp.weapons);
      return scoredValue(pveResult, pvpResult, {
        basis: "weapon-family",
        confidence: !partial && compared >= 3 && reviewedWeapons >= 2 ? "medium" : "low",
        reason: partial
          ? `This provisional score uses the visible equipped perks and recommendations for ${reviewedWeapons} reviewed version${reviewedWeapons === 1 ? "" : "s"} of ${weapon.name}. It will update when Bungie returns more socket data.`
          : `No exact ${database.source.name} entry exists for this item hash, so this score uses recommendations for ${reviewedWeapons} reviewed version${reviewedWeapons === 1 ? "" : "s"} of the same named weapon before considering broader ${weapon.itemType} evidence.`,
        source: database.source.name,
        reviewedAt: database.reviewedAt,
        totalColumns: 4
      });
    }
  }

  const type = database.types[weapon.itemType];
  if (!type) return { state: "unavailable", reasons: [`No trustworthy item-specific or ${weapon.itemType || "weapon-type"} comparison evidence is available yet. This is not a low score.`], source: database.source.name, reviewedAt: database.reviewedAt };
  const pveResult = scoreTypeMode(type.pve, equipped, database.method.columnWeights, database.perkAliases);
  const pvpResult = scoreTypeMode(type.pvp, equipped, database.method.columnWeights, database.perkAliases);
  const compared = Math.max(pveResult?.compared || 0, pvpResult?.compared || 0);
  if (!compared) return { state: "unavailable", reasons: [`${database.source.name} has ${weapon.itemType} recommendations, but none provide comparable evidence for this roll's equipped perks. Unknown is not bad.`], source: database.source.name, reviewedAt: database.reviewedAt };
  const reviewedWeapons = Math.max(type.pve.weapons, type.pvp.weapons);
  const confidence: WeaponRatingConfidence = !partial && compared >= 3 && reviewedWeapons >= 20 ? "medium" : "low";
  return scoredValue(pveResult, pvpResult, {
    basis: "weapon-type",
    confidence,
    reason: partial
      ? `This provisional score uses the visible equipped perks and lower-confidence ${weapon.itemType} evidence across ${reviewedWeapons} reviewed weapons. It will update when Bungie returns more socket data.`
      : `No exact ${database.source.name} entry exists, so this is a lower-confidence ${weapon.itemType} comparison based on perk endorsement strength across ${reviewedWeapons} reviewed weapons.`,
    source: database.source.name,
    reviewedAt: database.reviewedAt,
    totalColumns: 4
  });
}

/**
 * Rates one selectable perk independently of the currently selected option.
 * The four DIM wishlist columns are accepted; mods, origin traits, and
 * masterworks deliberately remain outside this evaluator.
 */
export function evaluateWeaponPerk(weapon: WeaponItem, ratingColumn: 0 | 1 | 2 | 3, perkHash: string, database = loadedDatabases.get("voltron")): WeaponTraitValue {
  if (!database) return { state: "unavailable", recommended: false, reasons: ["The community rating catalog is still loading or unavailable. This is not a negative rating."] };

  const record = database.items[weapon.itemHash];
  if (record) {
    const pve = scoreExactPerk(record.pve, ratingColumn, perkHash, database.perkAliases);
    const pvp = scoreExactPerk(record.pvp, ratingColumn, perkHash, database.perkAliases);
    return scoredTraitValue(pve, pvp, {
      basis: "weapon",
      confidence: "high",
      reason: `Compared this selectable perk with ${database.source.name} recommendations for this exact weapon. Base and enhanced versions are treated as equivalent.`,
      source: database.source.name,
      reviewedAt: database.reviewedAt
    });
  }

  const family = database.families?.[familyKey(weapon)];
  if (family) {
    const pve = scoreEvidencePerk(family.pve, ratingColumn, perkHash, database.perkAliases);
    const pvp = scoreEvidencePerk(family.pvp, ratingColumn, perkHash, database.perkAliases);
    if (pve || pvp) return scoredTraitValue(pve, pvp, {
      basis: "weapon-family",
      confidence: "low",
      reason: `No exact ${database.source.name} entry exists for this item hash, so this percentage uses evidence from reviewed versions of the same named weapon.`,
      source: database.source.name,
      reviewedAt: database.reviewedAt
    });
  }

  const type = database.types[weapon.itemType];
  const pve = scoreEvidencePerk(type?.pve, ratingColumn, perkHash, database.perkAliases);
  const pvp = scoreEvidencePerk(type?.pvp, ratingColumn, perkHash, database.perkAliases);
  if (pve || pvp) return scoredTraitValue(pve, pvp, {
    basis: "weapon-type",
    confidence: "low",
    reason: `No item-specific ${database.source.name} recommendation exists, so this is lower-confidence ${weapon.itemType || "weapon-type"} curator evidence.`,
    source: database.source.name,
    reviewedAt: database.reviewedAt
  });

  return {
    state: "unavailable",
    recommended: false,
    reasons: ["No trustworthy curator evidence is available for this selectable perk. Unrated does not mean bad."],
    source: database.source.name,
    reviewedAt: database.reviewedAt
  };
}

function alignEquippedColumns(weapon: WeaponItem): string[][] {
  const mapped = weapon.perkColumns.filter((column) => column.ratingColumn !== undefined);
  if (mapped.length) {
    const result: string[][] = [[], [], [], []];
    mapped.forEach((column) => {
      if (column.ratingColumn === undefined) return;
      result[column.ratingColumn] = column.active?.hash ? [column.active.hash] : [];
    });
    return result;
  }
  const columns = weapon.perkColumns.flatMap((column) => column.active?.hash ? [[column.active.hash]] : []).slice(-4);
  return [...Array.from({ length: Math.max(0, 4 - columns.length) }, () => [] as string[]), ...columns];
}

function familyKey(weapon: WeaponItem): string {
  return `${weapon.itemType}::${(weapon.name || "").trim().toLocaleLowerCase().replace(/\s+/g, " ")}`;
}

function scoreWeaponMode(bucket: RatingBucket, selectable: string[][], weights: number[], aliases?: Record<string, string>): ModeScore | undefined {
  if (!bucket?.recommendations) return undefined;
  const traitPairs = bucket.traitPairs?.length ? bucket.traitPairs : [","];
  const candidates = traitPairs.flatMap((encodedPair) => {
    const traits = encodedPair.split(",");
    const recommended: Array<string[] | undefined> = [
      bucket.columns[0],
      bucket.columns[1],
      traits[0] ? [traits[0]] : undefined,
      traits[1] ? [traits[1]] : undefined
    ];
    let earned = 0; let possible = 0; let compared = 0; let matched = 0;
    recommended.forEach((perks, index) => {
      if (!perks?.length || !selectable[index]?.length) return;
      const weight = weights[index] || 1;
      possible += weight; compared += 1;
      if (perks.some((perk) => selectable[index]!.some((candidate) => hashesEquivalent(candidate, perk, aliases)))) { earned += weight; matched += 1; }
    });
    return possible ? [{ score: Math.round(earned / possible * 100), compared, matched }] : [];
  });
  return candidates.sort((left, right) => right.score - left.score || right.matched - left.matched || right.compared - left.compared)[0];
}

function scoreTypeMode(bucket: TypeBucket, selectable: string[][], weights: number[], aliases?: Record<string, string>): ModeScore | undefined {
  if (!bucket?.weapons) return undefined;
  let earned = 0; let possible = 0; let compared = 0; let matched = 0;
  selectable.forEach((perks, index) => {
    const evidence = Math.max(-1, ...perks.map((perk) => evidenceFor(bucket.columns[index], perk, aliases) ?? -1));
    if (evidence < 0) return;
    const weight = weights[index] || 1;
    possible += weight; earned += weight * evidence / 100; compared += 1;
    if (evidence >= 50) matched += 1;
  });
  return possible ? { score: Math.round(earned / possible * 100), compared, matched } : undefined;
}

interface TraitModeScore { score: number; pairings?: number }

function scoreExactPerk(bucket: RatingBucket, ratingColumn: 0 | 1 | 2 | 3, perkHash: string, aliases?: Record<string, string>): TraitModeScore | undefined {
  if (!bucket?.recommendations || !bucket.columns[ratingColumn]?.length) return undefined;
  const recommended = bucket.columns[ratingColumn]!.some((candidate) => hashesEquivalent(candidate, perkHash, aliases));
  const traitPosition = ratingColumn >= 2 ? ratingColumn - 2 : undefined;
  const pairings = recommended && traitPosition !== undefined
    ? (bucket.traitPairs || []).filter((pair) => hashesEquivalent(pair.split(",")[traitPosition] || "", perkHash, aliases)).length
    : 0;
  return { score: recommended ? 100 : 0, pairings };
}

function scoreEvidencePerk(bucket: TypeBucket | undefined, ratingColumn: 0 | 1 | 2 | 3, perkHash: string, aliases?: Record<string, string>): TraitModeScore | undefined {
  if (!bucket?.weapons) return undefined;
  const score = evidenceFor(bucket.columns[ratingColumn], perkHash, aliases);
  return score === undefined ? undefined : { score };
}

function canonicalHash(hash: string, aliases?: Record<string, string>): string {
  return aliases?.[hash] || hash;
}

function hashesEquivalent(left: string, right: string, aliases?: Record<string, string>): boolean {
  return canonicalHash(left, aliases) === canonicalHash(right, aliases);
}

function evidenceFor(column: Record<string, number> | undefined, perkHash: string, aliases?: Record<string, string>): number | undefined {
  if (!column) return undefined;
  return column[perkHash] ?? column[canonicalHash(perkHash, aliases)];
}

function scoredTraitValue(
  pve: TraitModeScore | undefined,
  pvp: TraitModeScore | undefined,
  meta: { basis: WeaponRatingBasis; confidence: WeaponRatingConfidence; reason: string; source: string; reviewedAt: string }
): WeaponTraitValue {
  const known = [pve?.score, pvp?.score].filter((value): value is number => value !== undefined);
  if (!known.length) return {
    state: "unavailable",
    recommended: false,
    reasons: ["No applicable PvE or PvP curator evidence is available for this selectable perk. Unrated does not mean bad."],
    source: meta.source,
    reviewedAt: meta.reviewedAt
  };
  const overall = Math.round(known.reduce((sum, value) => sum + value, 0) / known.length);
  return {
    state: "scored",
    ...(pve ? { pve: pve.score, pvePairings: pve.pairings } : {}),
    ...(pvp ? { pvp: pvp.score, pvpPairings: pvp.pairings } : {}),
    overall,
    recommended: pve?.score === 100 || pvp?.score === 100,
    basis: meta.basis,
    confidence: meta.confidence,
    reasons: [meta.reason],
    source: meta.source,
    reviewedAt: meta.reviewedAt
  };
}

function scoredValue(pve: ModeScore | undefined, pvp: ModeScore | undefined, meta: { basis: WeaponRatingBasis; confidence: WeaponRatingConfidence; reason: string; source: string; reviewedAt: string; totalColumns: number }): WeaponValue {
  const known = [pve?.score, pvp?.score].filter((value): value is number => value !== undefined);
  if (!known.length) return { state: "unavailable", reasons: ["No applicable PvE or PvP comparison evidence was available. This is not a low score."], source: meta.source, reviewedAt: meta.reviewedAt };
  const overall = Math.round(known.reduce((sum, value) => sum + value, 0) / known.length);
  const comparedColumns = Math.max(pve?.compared || 0, pvp?.compared || 0);
  return {
    state: "scored",
    ...(pve ? { pve: pve.score } : {}),
    ...(pvp ? { pvp: pvp.score } : {}),
    overall,
    quality: qualityFor(overall),
    confidence: meta.confidence,
    basis: meta.basis,
    comparedColumns,
    totalColumns: meta.totalColumns,
    reasons: [meta.reason, `${comparedColumns}/${meta.totalColumns} rating columns currently had applicable evidence. This is a community roll-match score, not the weapon's overall sandbox meta position.`],
    source: meta.source,
    reviewedAt: meta.reviewedAt
  };
}

export function qualityFor(score: number): WeaponQuality {
  if (score >= 90) return "excellent";
  if (score >= 75) return "strong";
  if (score >= 50) return "mixed";
  if (score >= 25) return "weak";
  return "poor";
}

export function qualityLabel(quality?: WeaponQuality): string {
  return quality ? quality.charAt(0).toUpperCase() + quality.slice(1) : "Unrated";
}
