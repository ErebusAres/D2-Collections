import type { WeaponItem } from "@guardian-nexus/contracts";
import database from "../../data/weapon-value.v1.json";

export type WeaponScoreState = "scored" | "unavailable" | "incomplete";
export interface WeaponValue { state: WeaponScoreState; pve?: number; pvp?: number; overall?: number; reasons: string[]; source?: string; reviewedAt: string }
interface CuratedRoll { itemHash: string; perks: string[]; pve?: number; pvp?: number; source: string }

export function evaluateWeapon(weapon: WeaponItem): WeaponValue {
  if (weapon.rollDataState !== "complete") return { state: "incomplete", reasons: ["Bungie did not return a complete active roll."], reviewedAt: database.reviewedAt };
  const active = new Set(weapon.perkColumns.map((column) => column.active?.hash).filter((hash): hash is string => Boolean(hash)));
  const matches = (database.rolls as CuratedRoll[]).filter((roll) => roll.itemHash === weapon.itemHash && roll.perks.every((hash) => active.has(hash)));
  if (!matches.length) return { state: "unavailable", reasons: ["No reviewed community entry is loaded for this exact roll. This is not a low score."], reviewedAt: database.reviewedAt };
  const pve = maxDefined(matches.map((entry) => entry.pve));
  const pvp = maxDefined(matches.map((entry) => entry.pvp));
  const available = [pve, pvp].filter((value): value is number => value !== undefined);
  return { state: "scored", ...(pve !== undefined ? { pve } : {}), ...(pvp !== undefined ? { pvp } : {}), overall: available.length ? Math.round(available.reduce((sum, value) => sum + value, 0) / available.length) : undefined, reasons: ["Matched an exact curator-defined roll."], source: matches[0]?.source, reviewedAt: database.reviewedAt };
}

function maxDefined(values: Array<number | undefined>): number | undefined {
  const known = values.filter((value): value is number => Number.isFinite(value));
  return known.length ? Math.max(...known) : undefined;
}
