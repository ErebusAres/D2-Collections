import type { XurData, XurOffer } from "@guardian-nexus/contracts";
import type { Env } from "./types";

type StoredXurSnapshotRow = {
  captured_at?: unknown;
  next_refresh_at?: unknown;
  offers_json?: unknown;
};

export type StoredXurSnapshot = {
  capturedAt: string;
  nextRefreshAt?: string;
  offers: XurOffer[];
};

export function parseStoredXurSnapshot(row: StoredXurSnapshotRow | null | undefined): StoredXurSnapshot | undefined {
  if (!row || typeof row.captured_at !== "string" || !Number.isFinite(Date.parse(row.captured_at)) || typeof row.offers_json !== "string") return undefined;
  try {
    const offers = JSON.parse(row.offers_json);
    if (!Array.isArray(offers) || offers.length === 0 || offers.some((offer) => !offer || typeof offer !== "object" || typeof offer.itemHash !== "string" || typeof offer.name !== "string")) return undefined;
    return {
      capturedAt: row.captured_at,
      ...(typeof row.next_refresh_at === "string" && Number.isFinite(Date.parse(row.next_refresh_at)) ? { nextRefreshAt: row.next_refresh_at } : {}),
      offers: offers as XurOffer[]
    };
  } catch {
    return undefined;
  }
}

export async function saveLatestXurShipment(env: Env, data: XurData): Promise<void> {
  if (data.offers.length === 0) return;
  try {
    await env.DB.prepare(`
      INSERT INTO xur_inventory_snapshot (snapshot_key, captured_at, next_refresh_at, offers_json)
      VALUES ('latest', ?, ?, ?)
      ON CONFLICT(snapshot_key) DO UPDATE SET captured_at = excluded.captured_at, next_refresh_at = excluded.next_refresh_at, offers_json = excluded.offers_json
    `).bind(data.checkedAt, data.nextRefreshAt || null, JSON.stringify(data.offers)).run();
  } catch {
    // Do not take the storefront down while a migration is rolling out or D1 is briefly unavailable.
  }
}

export async function readLatestXurShipment(env: Env): Promise<StoredXurSnapshot | undefined> {
  try {
    const row = await env.DB.prepare("SELECT captured_at, next_refresh_at, offers_json FROM xur_inventory_snapshot WHERE snapshot_key = 'latest'").first<StoredXurSnapshotRow>();
    return parseStoredXurSnapshot(row);
  } catch {
    return undefined;
  }
}
