import type { WeaponItem } from "@guardian-nexus/contracts";

export type WeaponScoreState = "scored" | "unavailable" | "incomplete";
export interface WeaponValue { state: WeaponScoreState; pve?: number; pvp?: number; overall?: number; reasons: string[]; source?: string; reviewedAt?: string }
interface RatingBucket { rolls: number; perks: string[]; traitPairs: string[] }
interface RatingRecord { pve: RatingBucket; pvp: RatingBucket }
export interface WeaponRatingDatabase {
  schemaVersion: 2;
  reviewedAt: string;
  source: { name: string };
  items: Record<string, RatingRecord>;
}

let loadedDatabase: WeaponRatingDatabase | undefined;
let loadPromise: Promise<WeaponRatingDatabase | undefined> | undefined;

export function loadWeaponRatings(): Promise<WeaponRatingDatabase | undefined> {
  if (loadedDatabase) return Promise.resolve(loadedDatabase);
  loadPromise ||= fetch("/data/weapon-value.v2.json", { cache: "force-cache" })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Weapon ratings returned HTTP ${response.status}.`);
      const candidate = await response.json() as Partial<WeaponRatingDatabase>;
      if (candidate.schemaVersion !== 2 || !candidate.reviewedAt || !candidate.source?.name || !candidate.items) throw new Error("Weapon ratings have an unsupported schema.");
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
  const record = database.items[weapon.itemHash];
  if (!record) return { state: "unavailable", reasons: ["The current DIM community source has no reviewed entry for this weapon. This is not a low score."], reviewedAt: database.reviewedAt };
  const active = weapon.perkColumns.map((column) => column.active?.hash).filter((hash): hash is string => Boolean(hash));
  if (active.length < 2) return { state: "incomplete", reasons: ["Too few active perk columns were returned to compare this roll safely."], reviewedAt: database.reviewedAt };
  const pve = scoreMode(record.pve, active);
  const pvp = scoreMode(record.pvp, active);
  const known = [pve, pvp].filter((value): value is number => value !== undefined);
  if (!known.length) return { state: "unavailable", reasons: ["This weapon is present in the source, but no applicable PvE or PvP curator tags were available."], reviewedAt: database.reviewedAt };
  return {
    state: "scored",
    ...(pve !== undefined ? { pve } : {}),
    ...(pvp !== undefined ? { pvp } : {}),
    overall: Math.round(known.reduce((sum, value) => sum + value, 0) / known.length),
    reasons: ["50% active-perk recommendation coverage plus 50% exact final-trait-pair coverage; PvE and PvP are scored separately."],
    source: database.source.name,
    reviewedAt: database.reviewedAt
  };
}

function scoreMode(bucket: RatingBucket, active: string[]): number | undefined {
  if (!bucket?.rolls) return undefined;
  const recommended = new Set(bucket.perks);
  const coverage = active.filter((hash) => recommended.has(hash)).length / active.length;
  const pair = active.slice(-2).join(",");
  const pairMatch = new Set(bucket.traitPairs).has(pair) ? 1 : 0;
  return Math.round(coverage * 50 + pairMatch * 50);
}
