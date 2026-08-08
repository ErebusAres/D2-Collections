import type { WeaponItem } from "@guardian-nexus/contracts";

export type WeaponScoreState = "scored" | "unavailable" | "incomplete";
export type WeaponQuality = "excellent" | "strong" | "mixed" | "weak" | "poor";
export type WeaponRatingConfidence = "high" | "medium" | "low";
export type WeaponRatingBasis = "weapon" | "weapon-type";

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

interface RatingBucket { recommendations: number; columns: string[][]; traitPairs: string[] }
interface RatingRecord { itemType: string; pve: RatingBucket; pvp: RatingBucket }
interface TypeBucket { weapons: number; columns: Array<Record<string, number>> }
interface TypeRecord { pve: TypeBucket; pvp: TypeBucket }
export interface WeaponRatingDatabase {
  schemaVersion: 4;
  reviewedAt: string;
  source: { name: string };
  method: { columnWeights: number[] };
  coverage: { manifestWeapons: number; reviewedWeapons: number; supportedTypes: number; reviewedTypes: number };
  items: Record<string, RatingRecord>;
  types: Record<string, TypeRecord>;
}

interface ModeScore { score: number; compared: number; matched: number }
let loadedDatabase: WeaponRatingDatabase | undefined;
let loadPromise: Promise<WeaponRatingDatabase | undefined> | undefined;

export function loadWeaponRatings(): Promise<WeaponRatingDatabase | undefined> {
  if (loadedDatabase) return Promise.resolve(loadedDatabase);
  loadPromise ||= fetch("/data/weapon-value.v4.json", { cache: "no-cache" })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Weapon ratings returned HTTP ${response.status}.`);
      const candidate = await response.json() as Partial<WeaponRatingDatabase>;
      if (candidate.schemaVersion !== 4 || !candidate.reviewedAt || !candidate.source?.name || !candidate.method?.columnWeights || !candidate.items || !candidate.types) throw new Error("Weapon ratings have an unsupported schema.");
      loadedDatabase = candidate as WeaponRatingDatabase;
      return loadedDatabase;
    })
    .catch(() => {
      loadPromise = undefined;
      return undefined;
    });
  return loadPromise;
}

export function evaluateWeapon(weapon: WeaponItem, database = loadedDatabase): WeaponValue {
  if (weapon.rollDataState !== "complete") return { state: "incomplete", reasons: ["Bungie did not return a complete active roll. Unknown is not a negative rating."], reviewedAt: database?.reviewedAt };
  if (!database) return { state: "unavailable", reasons: ["The community rating catalog is still loading or unavailable. This is not a low score."] };
  const active = alignActiveColumns(weapon);
  const activeCount = active.filter(Boolean).length;
  if (activeCount < 2) return { state: "incomplete", reasons: ["Too few active perk columns were returned to compare this roll safely."], reviewedAt: database.reviewedAt };

  const record = database.items[weapon.itemHash];
  if (record) {
    const pveResult = scoreWeaponMode(record.pve, active, database.method.columnWeights);
    const pvpResult = scoreWeaponMode(record.pvp, active, database.method.columnWeights);
    return scoredValue(pveResult, pvpResult, {
      basis: "weapon",
      confidence: "high",
      reason: `Compared the active perks with DIM recommendations for this exact weapon while preserving curated trait pairings. Each specified perk column has equal weight.`,
      source: database.source.name,
      reviewedAt: database.reviewedAt,
      totalColumns: activeCount
    });
  }

  const type = database.types[weapon.itemType];
  if (!type) return { state: "unavailable", reasons: [`No trustworthy item-specific or ${weapon.itemType || "weapon-type"} comparison evidence is available yet. This is not a low score.`], source: database.source.name, reviewedAt: database.reviewedAt };
  const pveResult = scoreTypeMode(type.pve, active, database.method.columnWeights);
  const pvpResult = scoreTypeMode(type.pvp, active, database.method.columnWeights);
  const compared = Math.max(pveResult?.compared || 0, pvpResult?.compared || 0);
  if (!compared) return { state: "unavailable", reasons: [`DIM has ${weapon.itemType} recommendations, but none provide comparable evidence for this roll's active perks. Unknown is not bad.`], source: database.source.name, reviewedAt: database.reviewedAt };
  const reviewedWeapons = Math.max(type.pve.weapons, type.pvp.weapons);
  const confidence: WeaponRatingConfidence = compared >= 3 && reviewedWeapons >= 20 ? "medium" : "low";
  return scoredValue(pveResult, pvpResult, {
    basis: "weapon-type",
    confidence,
    reason: `No exact DIM entry exists, so this is a lower-confidence ${weapon.itemType} comparison based on perk endorsement strength across ${reviewedWeapons} reviewed weapons.`,
    source: database.source.name,
    reviewedAt: database.reviewedAt,
    totalColumns: activeCount
  });
}

function alignActiveColumns(weapon: WeaponItem): Array<string | undefined> {
  const mapped = weapon.perkColumns.filter((column) => column.ratingColumn !== undefined && column.active?.hash);
  if (mapped.length >= 2) {
    const result: Array<string | undefined> = [undefined, undefined, undefined, undefined];
    mapped.forEach((column) => { if (column.ratingColumn !== undefined) result[column.ratingColumn] = column.active?.hash; });
    return result;
  }
  const hashes = weapon.perkColumns.map((column) => column.active?.hash).filter((hash): hash is string => Boolean(hash)).slice(-4);
  return [...Array(Math.max(0, 4 - hashes.length)).fill(undefined), ...hashes];
}

function scoreWeaponMode(bucket: RatingBucket, active: Array<string | undefined>, weights: number[]): ModeScore | undefined {
  if (!bucket?.recommendations) return undefined;
  const traitPairs = bucket.traitPairs?.length ? bucket.traitPairs : [","];
  const candidates = traitPairs.flatMap((encodedPair) => {
    const traits = encodedPair.split(",");
    const recommended: Array<string | undefined> = [
      active[0] && bucket.columns[0]?.includes(active[0]) ? active[0] : bucket.columns[0]?.[0],
      active[1] && bucket.columns[1]?.includes(active[1]) ? active[1] : bucket.columns[1]?.[0],
      traits[0] || undefined,
      traits[1] || undefined
    ];
    let earned = 0; let possible = 0; let compared = 0; let matched = 0;
    recommended.forEach((perk, index) => {
      if (!perk) return;
      const weight = weights[index] || 1;
      possible += weight; compared += 1;
      if (active[index] === perk) { earned += weight; matched += 1; }
    });
    return possible ? [{ score: Math.round(earned / possible * 100), compared, matched }] : [];
  });
  return candidates.sort((left, right) => right.score - left.score || right.matched - left.matched || right.compared - left.compared)[0];
}

function scoreTypeMode(bucket: TypeBucket, active: Array<string | undefined>, weights: number[]): ModeScore | undefined {
  if (!bucket?.weapons) return undefined;
  let earned = 0; let possible = 0; let compared = 0; let matched = 0;
  active.forEach((perk, index) => {
    const evidence = perk ? bucket.columns[index]?.[perk] : undefined;
    if (evidence === undefined) return;
    const weight = weights[index] || 1;
    possible += weight; earned += weight * evidence / 100; compared += 1;
    if (evidence >= 50) matched += 1;
  });
  return possible ? { score: Math.round(earned / possible * 100), compared, matched } : undefined;
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
    reasons: [meta.reason, `${comparedColumns}/${meta.totalColumns} active columns had applicable evidence. This is a community roll-match score, not the weapon's overall sandbox meta position.`],
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
