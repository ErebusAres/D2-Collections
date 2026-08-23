import type { ArmorItem, CollectionData, CompanionManifest, RecentItemEvent, RecentItemTimelineData, WeaponItem } from "@guardian-nexus/contracts";
import { imageUrl } from "@guardian-nexus/domain";
import type { Env } from "./types";

type GearLoot = ({ kind: "armor" } & ArmorItem) | ({ kind: "weapon" } & WeaponItem);

interface Observation {
  key: string;
  kind: "gear" | "catalyst" | "inventory";
  state: string;
  quantity: number;
  metadata: Record<string, unknown>;
}

interface ObservationRow {
  observation_key: string;
  observation_kind: Observation["kind"];
  state_value: string | null;
  quantity: number;
  metadata_json: string;
  observed_at: string;
  updated_at: string;
}

const COALESCE_MS = 10 * 60_000;
const RETENTION_DAYS = 30;
const MAX_EVENTS = 200;
const RAW_EVENT_SCAN_LIMIT = MAX_EVENTS * 5;
export const RECENT_ITEM_REFRESH_INTERVAL_MS = 5 * 60_000;

export function recentItemObservationDue(data: Pick<RecentItemTimelineData, "firstObservationEstablished" | "observedAt">, now = Date.now()): boolean {
  if (!data.firstObservationEstablished) return true;
  const refreshedAt = Date.parse(data.observedAt);
  return !Number.isFinite(refreshedAt) || now - refreshedAt >= RECENT_ITEM_REFRESH_INTERVAL_MS;
}

export async function readRecentItems(membershipId: string, env: Env, now = new Date().toISOString()): Promise<RecentItemTimelineData> {
  const [observationSummary, refreshState, rows] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS observation_count, MAX(updated_at) AS observed_at FROM recent_item_observations WHERE membership_id = ?")
      .bind(membershipId).first<{ observation_count: number; observed_at: string | null }>(),
    env.DB.prepare("SELECT refreshed_at FROM recent_item_refresh_state WHERE membership_id = ?").bind(membershipId).first<{ refreshed_at: string }>(),
    env.DB.prepare("SELECT * FROM recent_item_events WHERE membership_id = ? ORDER BY last_observed_at DESC, id DESC LIMIT ?")
      .bind(membershipId, RAW_EVENT_SCAN_LIMIT).all<any>()
  ]);
  const events = coalesceTimelineEvents((rows.results || []).map(recentItemEventFromRow)).slice(0, MAX_EVENTS);
  const instanceIds = [...new Set(events.flatMap((event) => event.instanceId ? [event.instanceId] : []))];
  const currentGear = new Map<string, GearLoot>();
  for (let offset = 0; offset < instanceIds.length; offset += 80) {
    const batch = instanceIds.slice(offset, offset + 80);
    if (!batch.length) continue;
    const placeholders = batch.map(() => "?").join(",");
    const observations = await env.DB.prepare(`SELECT observation_key, metadata_json FROM recent_item_observations WHERE membership_id = ? AND observation_key IN (${placeholders})`)
      .bind(membershipId, ...batch.map((instanceId) => `gear:${instanceId}`)).all<{ observation_key: string; metadata_json: string }>();
    for (const observation of observations.results || []) {
      try {
        const metadata = JSON.parse(observation.metadata_json || "{}");
        const instanceId = String(metadata?.instanceId || metadata?.gear?.instanceId || observation.observation_key.replace(/^gear:/, ""));
        if (instanceId && metadata?.gear) currentGear.set(instanceId, metadata.gear);
      } catch { /* A malformed observation must not hide the rest of the saved timeline. */ }
    }
  }
  return {
    timelineSchemaVersion: 1,
    events: events.map((event) => event.instanceId && currentGear.has(event.instanceId) ? { ...event, gear: currentGear.get(event.instanceId) } : event),
    retentionDays: RETENTION_DAYS,
    firstObservationEstablished: Number(observationSummary?.observation_count || 0) > 0,
    observedAt: refreshState?.refreshed_at || observationSummary?.observed_at || now
  };
}

export async function observeRecentItems(input: {
  membershipId: string;
  profile: any;
  companionManifest: CompanionManifest;
  collection: CollectionData;
  armor: ArmorItem[];
  weapons: WeaponItem[];
  env: Env;
  now?: string;
}): Promise<RecentItemTimelineData> {
  const now = input.now || new Date().toISOString();
  const gear: GearLoot[] = [
    ...input.armor.map((item) => ({ ...item, kind: "armor" as const })),
    ...input.weapons.map((item) => ({ ...item, kind: "weapon" as const }))
  ];
  const inventoryAvailable = inventorySnapshotAvailable(input.profile, input.companionManifest);
  const observations: Observation[] = [
    ...gear.map(gearObservation),
    ...catalystObservations(input.collection),
    ...(inventoryAvailable ? inventoryObservations(input.profile, input.companionManifest) : [])
  ];
  const previousResult = await input.env.DB.prepare("SELECT * FROM recent_item_observations WHERE membership_id = ?")
    .bind(input.membershipId).all<ObservationRow>();
  const previous = new Map((previousResult.results || []).map((row) => [row.observation_key, row]));
  const firstAccountObservation = previous.size === 0;
  const currentKeys = new Set(observations.map((observation) => observation.key));
  const missingGearKeys = missingGearObservationKeys(previous.values(), currentKeys);
  for (let offset = 0; offset < missingGearKeys.length; offset += 40) {
    await input.env.DB.batch(missingGearKeys.slice(offset, offset + 40).flatMap((key) => [
      input.env.DB.prepare("DELETE FROM recent_item_events WHERE membership_id = ? AND source_key = ?").bind(input.membershipId, key),
      input.env.DB.prepare("DELETE FROM recent_item_observations WHERE membership_id = ? AND observation_key = ?").bind(input.membershipId, key)
    ]));
  }
  missingGearKeys.forEach((key) => previous.delete(key));
  for (const prior of previous.values()) {
    if (!inventoryAvailable || prior.observation_kind !== "inventory" || currentKeys.has(prior.observation_key)) continue;
    let metadata: Record<string, unknown> = {};
    try { metadata = JSON.parse(prior.metadata_json || "{}"); } catch { metadata = {}; }
    observations.push({ key: prior.observation_key, kind: "inventory", state: "absent", quantity: 0, metadata });
  }

  for (const observation of observations) {
    const prior = previous.get(observation.key);
    if (observation.kind === "catalyst" && prior?.state_value === "missing" && observation.state === "complete") {
      const found = eventForTransition({ ...observation, state: "obtained" }, prior, firstAccountObservation, now);
      if (found) await saveEvent(input.env, input.membershipId, found, await eventId(input.membershipId, found, observation, prior));
      const completed = eventForTransition(observation, { ...prior, state_value: "obtained" }, firstAccountObservation, now);
      if (completed) await saveEvent(input.env, input.membershipId, completed, await eventId(input.membershipId, completed, observation, prior));
    } else {
      const event = eventForTransition(observation, prior, firstAccountObservation, now);
      if (event) await saveEvent(input.env, input.membershipId, event, await eventId(input.membershipId, event, observation, prior));
    }
  }

  const changedObservations = observations.filter((observation) => observationChanged(observation, previous.get(observation.key)));
  for (let offset = 0; offset < changedObservations.length; offset += 80) {
    await input.env.DB.batch(changedObservations.slice(offset, offset + 80).map((observation) => input.env.DB.prepare(`INSERT INTO recent_item_observations
      (membership_id, observation_key, observation_kind, state_value, quantity, metadata_json, observed_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(membership_id, observation_key) DO UPDATE SET observation_kind = excluded.observation_kind, state_value = excluded.state_value,
        quantity = excluded.quantity, metadata_json = excluded.metadata_json, updated_at = excluded.updated_at`)
      .bind(input.membershipId, observation.key, observation.kind, observation.state, observation.quantity, JSON.stringify(observation.metadata), priorObservedAt(previous.get(observation.key), now), now)));
  }

  const cutoff = new Date(Date.parse(now) - RETENTION_DAYS * 86_400_000).toISOString();
  await input.env.DB.prepare("DELETE FROM recent_item_events WHERE membership_id = ? AND last_observed_at < ?").bind(input.membershipId, cutoff).run();
  const rows = await input.env.DB.prepare("SELECT * FROM recent_item_events WHERE membership_id = ? ORDER BY last_observed_at DESC, id DESC LIMIT ?")
    .bind(input.membershipId, RAW_EVENT_SCAN_LIMIT).all<any>();
  const currentGear = new Map(gear.map((item) => [item.instanceId, item]));
  const events = coalesceTimelineEvents((rows.results || []).map(recentItemEventFromRow))
    .slice(0, MAX_EVENTS)
    .map((event) => event.instanceId && currentGear.has(event.instanceId) ? { ...event, gear: currentGear.get(event.instanceId) } : event);
  return {
    timelineSchemaVersion: 1,
    events,
    retentionDays: RETENTION_DAYS,
    firstObservationEstablished: firstAccountObservation,
    observedAt: now
  };
}

export function missingGearObservationKeys(previous: Iterable<Pick<ObservationRow, "observation_key" | "observation_kind">>, currentKeys: ReadonlySet<string>): string[] {
  return [...previous]
    .filter((row) => row.observation_kind === "gear" && !currentKeys.has(row.observation_key))
    .map((row) => row.observation_key);
}

export async function removeRecentGearItem(membershipId: string, instanceId: string, env: Env): Promise<void> {
  const sourceKey = `gear:${instanceId}`;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM recent_item_events WHERE membership_id = ? AND source_key = ?").bind(membershipId, sourceKey),
    env.DB.prepare("DELETE FROM recent_item_observations WHERE membership_id = ? AND observation_key = ?").bind(membershipId, sourceKey)
  ]);
}

export function observationChanged(observation: Pick<Observation, "kind" | "state" | "quantity" | "metadata">, prior?: Pick<ObservationRow, "observation_kind" | "state_value" | "quantity" | "metadata_json">): boolean {
  if (!prior) return true;
  return prior.observation_kind !== observation.kind
    || prior.state_value !== observation.state
    || Number(prior.quantity) !== observation.quantity
    || prior.metadata_json !== JSON.stringify(observation.metadata);
}

function gearObservation(item: GearLoot): Observation {
  return { key: `gear:${item.instanceId}`, kind: "gear", state: item.kind, quantity: 1, metadata: { itemHash: item.itemHash, instanceId: item.instanceId, name: item.name, icon: item.icon, gear: item } };
}

function catalystObservations(collection: CollectionData): Observation[] {
  return collection.entries.flatMap((entry) => (entry.catalysts || []).map((catalyst) => ({
    key: `catalyst:${catalyst.recordHash}`,
    kind: "catalyst" as const,
    state: catalyst.state,
    quantity: catalyst.state === "missing" ? 0 : 1,
    metadata: { recordHash: catalyst.recordHash, name: catalyst.name, description: catalyst.description, icon: catalyst.icon, percent: catalyst.percent }
  })));
}

export function inventoryObservations(profile: any, manifest: CompanionManifest): Observation[] {
  const totals = new Map<string, number>();
  const collect = (container: any) => {
    for (const item of container?.items || []) {
      if (item?.itemInstanceId) continue;
      const itemHash = String(Number(item?.itemHash) >>> 0);
      const definition: any = manifest.itemDefinitions[itemHash];
      const quantity = Math.max(0, Number(item?.quantity || 0));
      if (!definition || !quantity || [2, 3].includes(Number(definition.itemType))) continue;
      totals.set(itemHash, (totals.get(itemHash) || 0) + quantity);
    }
  };
  collect(profile?.profileInventory?.data);
  for (const container of Object.values(profile?.characterInventories?.data || {}) as any[]) collect(container);
  return [...totals].flatMap(([itemHash, quantity]) => {
    const definition: any = manifest.itemDefinitions[itemHash];
    const name = String(definition?.displayProperties?.name || "").trim();
    if (!name) return [];
    return [{ key: `inventory:${itemHash}`, kind: "inventory" as const, state: "owned", quantity, metadata: {
      itemHash, name, description: String(definition?.displayProperties?.description || ""), icon: imageUrl(definition?.displayProperties?.icon),
      itemType: String(definition?.itemTypeDisplayName || "Inventory item"), rarity: String(definition?.inventory?.tierTypeName || "Unknown"),
      exoticEngram: isExoticEngramDefinition(definition)
    } }];
  });
}

export function isExoticEngramDefinition(definition: any): boolean {
  const name = String(definition?.displayProperties?.name || "").trim().toLowerCase();
  const type = String(definition?.itemTypeDisplayName || "").trim().toLowerCase();
  const rarity = String(definition?.inventory?.tierTypeName || "").trim().toLowerCase();
  return rarity === "exotic" && (type === "engram" || name === "exotic engram");
}

export function inventorySnapshotAvailable(profile: any, manifest: CompanionManifest): boolean {
  return manifest.version !== "unavailable"
    && Array.isArray(profile?.profileInventory?.data?.items)
    && Boolean(profile?.characterInventories?.data && typeof profile.characterInventories.data === "object")
    && uninstancedInventoryHashes(profile).every((hash) => Boolean(manifest.itemDefinitions[hash]));
}

function uninstancedInventoryHashes(profile: any): string[] {
  const hashes = new Set<string>();
  const collect = (container: any) => {
    for (const item of container?.items || []) {
      if (item?.itemInstanceId) continue;
      const hash = String(Number(item?.itemHash) >>> 0);
      if (hash && hash !== "0" && Number(item?.quantity || 0) > 0) hashes.add(hash);
    }
  };
  collect(profile?.profileInventory?.data);
  Object.values(profile?.characterInventories?.data || {}).forEach(collect);
  return [...hashes];
}

export function eventForTransition(observation: Observation, prior: Pick<ObservationRow, "state_value" | "quantity" | "observed_at"> | undefined, firstAccountObservation: boolean, now: string): Omit<RecentItemEvent, "id"> | undefined {
  const metadata = observation.metadata as any;
  if (observation.kind === "gear") {
    if (prior) return undefined;
    if (firstAccountObservation) return undefined;
    const firstSeenAt = String(metadata.gear?.firstSeenAt || now);
    return { kind: observation.state === "weapon" ? "weapon-found" : "armor-found", sourceKey: observation.key, itemHash: metadata.itemHash, instanceId: metadata.instanceId, name: metadata.name, description: "", icon: metadata.icon, quantity: 1, observedAt: firstSeenAt, lastObservedAt: firstSeenAt, gear: metadata.gear };
  }
  if (!prior || firstAccountObservation) return undefined;
  if (observation.kind === "inventory") {
    const gained = observation.quantity - Number(prior.quantity || 0);
    if (gained <= 0) return undefined;
    return { kind: metadata.exoticEngram ? "exotic-engram-found" : "inventory-gained", sourceKey: observation.key, itemHash: metadata.itemHash, name: metadata.name, description: metadata.description, icon: metadata.icon, quantity: gained, observedAt: now, lastObservedAt: now, itemType: metadata.itemType, rarity: metadata.rarity };
  }
  if (prior.state_value === "missing" && (observation.state === "obtained" || observation.state === "complete")) {
    return { kind: "catalyst-found", sourceKey: observation.key, recordHash: metadata.recordHash, name: metadata.name, description: metadata.description, icon: metadata.icon, quantity: 1, observedAt: now, lastObservedAt: now, percent: metadata.percent };
  }
  if (prior.state_value !== "complete" && observation.state === "complete") {
    return { kind: "catalyst-completed", sourceKey: observation.key, recordHash: metadata.recordHash, name: metadata.name, description: metadata.description, icon: metadata.icon, quantity: 1, observedAt: now, lastObservedAt: now, percent: 100 };
  }
}

async function saveEvent(env: Env, membershipId: string, event: Omit<RecentItemEvent, "id">, id: string): Promise<void> {
  const metadata = { ...event };
  await env.DB.prepare(`INSERT OR IGNORE INTO recent_item_events
    (id, membership_id, event_kind, source_key, item_hash, instance_id, record_hash, name, description, icon, quantity, metadata_json, observed_at, last_observed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, membershipId, event.kind, event.sourceKey, event.itemHash || null, event.instanceId || null, event.recordHash || null, event.name, event.description || "", event.icon || "", event.quantity, JSON.stringify(metadata), event.observedAt, event.lastObservedAt).run();
}

export async function eventId(membershipId: string, event: Omit<RecentItemEvent, "id">, observation: Observation, prior: ObservationRow | undefined): Promise<string> {
  const transition = event.kind === "inventory-gained" || event.kind === "exotic-engram-found"
    ? `${prior?.updated_at || prior?.observed_at || "initial"}:${prior?.quantity || 0}->${observation.quantity}`
    : event.kind;
  const bytes = new TextEncoder().encode(`${membershipId}|${event.sourceKey}|${transition}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function coalesceTimelineEvents(input: RecentItemEvent[]): RecentItemEvent[] {
  const ascending = [...input].sort((left, right) => Date.parse(left.observedAt) - Date.parse(right.observedAt));
  const output: RecentItemEvent[] = [];
  const lastInventoryBySource = new Map<string, RecentItemEvent>();
  for (const event of ascending) {
    if (event.kind !== "inventory-gained" && event.kind !== "exotic-engram-found") {
      output.push(event);
      continue;
    }
    const prior = lastInventoryBySource.get(event.sourceKey);
    if (prior && Date.parse(event.observedAt) - Date.parse(prior.lastObservedAt) <= COALESCE_MS) {
      prior.quantity += event.quantity;
      prior.lastObservedAt = event.lastObservedAt > prior.lastObservedAt ? event.lastObservedAt : prior.lastObservedAt;
      continue;
    }
    const copy = { ...event };
    output.push(copy);
    lastInventoryBySource.set(event.sourceKey, copy);
  }
  return output.sort((left, right) => {
    const time = Date.parse(right.lastObservedAt) - Date.parse(left.lastObservedAt);
    if (time) return time;
    const priority = eventPriority(right.kind) - eventPriority(left.kind);
    return priority || right.id.localeCompare(left.id);
  });
}

function eventPriority(kind: RecentItemEvent["kind"]): number {
  if (kind === "catalyst-completed") return 2;
  if (kind === "catalyst-found") return 1;
  return 0;
}

export function recentItemEventFromRow(row: any): RecentItemEvent {
  let metadata: any = {};
  try { metadata = JSON.parse(row.metadata_json || "{}"); } catch { metadata = {}; }
  return { ...metadata, id: String(row.id), kind: row.event_kind, sourceKey: row.source_key, itemHash: row.item_hash || undefined, instanceId: row.instance_id || undefined, recordHash: row.record_hash || undefined, name: row.name, description: row.description, icon: row.icon, quantity: Number(row.quantity || 1), observedAt: row.observed_at, lastObservedAt: row.last_observed_at };
}

function priorObservedAt(prior: ObservationRow | undefined, now: string): string { return prior?.observed_at || now; }
