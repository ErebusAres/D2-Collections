import type { GearData } from "@guardian-nexus/contracts";
import type { Env } from "./types";
import type { GearStateRow } from "./gear";

export const GEAR_SNAPSHOT_FRESH_MS = 10 * 60_000;

export interface StoredGearSnapshot {
  data: GearData;
  sourceMintedAt: string;
  refreshedAt: string;
}

export async function readGearSnapshot(membershipId: string, env: Env): Promise<StoredGearSnapshot | undefined> {
  const row = await env.DB.prepare("SELECT data_json, source_minted_at, refreshed_at FROM guardian_gear_cache WHERE membership_id = ?")
    .bind(membershipId).first<{ data_json: string; source_minted_at: string; refreshed_at: string }>();
  if (!row) return undefined;
  try {
    const data = JSON.parse(row.data_json) as GearData;
    if (data?.gearSchemaVersion !== 2 || !Array.isArray(data.items) || !Array.isArray(data.weapons)) return undefined;
    return { data, sourceMintedAt: row.source_minted_at, refreshedAt: row.refreshed_at };
  } catch { return undefined; }
}

export async function saveGearSnapshot(membershipId: string, data: GearData, sourceMintedAt: string, refreshedAt: string, env: Env): Promise<void> {
  await env.DB.prepare(`INSERT INTO guardian_gear_cache (membership_id, data_json, source_minted_at, refreshed_at)
    VALUES (?, ?, ?, ?) ON CONFLICT(membership_id) DO UPDATE SET data_json = excluded.data_json,
      source_minted_at = excluded.source_minted_at, refreshed_at = excluded.refreshed_at`)
    .bind(membershipId, JSON.stringify(data), sourceMintedAt, refreshedAt).run();
}

export function hydrateGearSnapshot(data: GearData, characterId: string | undefined, states: Map<string, GearStateRow>, cleanup: NonNullable<GearData["cleanup"]>): GearData {
  const items = data.items.map((item) => hydrateItem(item, states.get(item.instanceId), cleanup));
  const weapons = (data.weapons || []).map((item) => hydrateItem(item, states.get(item.instanceId), cleanup));
  const selectedClass = characterId ? items.find((item) => item.ownerCharacterId === characterId)?.className || data.selectedClass : data.selectedClass;
  const all = [...items, ...weapons];
  return {
    ...data,
    ...(characterId ? { selectedCharacterId: characterId, selectedClass } : {}),
    items,
    weapons,
    cleanup,
    totals: {
      ...data.totals,
      armor: items.length,
      weapons: weapons.length,
      vault: all.filter((item) => item.location === "vault").length,
      equipped: all.filter((item) => item.equipped).length,
      locked: all.filter((item) => item.locked).length,
      newItems: all.filter((item) => item.isNew).length
    }
  };
}

function hydrateItem<T extends GearData["items"][number] | NonNullable<GearData["weapons"]>[number]>(item: T, state: GearStateRow | undefined, cleanup: NonNullable<GearData["cleanup"]>): T {
  return {
    ...item,
    tag: state?.tag,
    firstSeenAt: state?.first_seen_at || item.firstSeenAt,
    dismissedAt: state?.dismissed_at,
    isNew: !state?.dismissed_at && !state?.tag,
    cleanupRecommendation: cleanup[item.instanceId]
  };
}
