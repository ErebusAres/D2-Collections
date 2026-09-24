import type { CleanupAnalysis, CleanupAnalyzeData, CleanupSettings, GearData } from "@guardian-nexus/contracts";
import { analyzeCleanup, CLEANUP_DEFAULTS, type CleanupWishlist } from "@guardian-nexus/domain";
import { z } from "zod";
import { loadGearManifest, profileFor } from "./bungie";
import { gearActionItemsFromProfile, normalizeGear, type GearStateRow } from "./gear";
import { httpError, sha256 } from "./security";
import type { Env, SessionRow } from "./types";
import { cosmeticChoices, cosmeticSetChoices } from "./cleanupCosmetics";

const weight = z.number().int().min(0).max(1);
const cosmeticsSchema = z.object({ enabled: z.boolean(), weaponShader: z.string().regex(/^\d+$/).optional(), armorShader: z.string().regex(/^\d+$/).optional(), ornaments: z.record(z.union([z.string().regex(/^\d+$/), z.literal("")])), classStyles: z.record(z.string().max(80)).optional() });
export const cleanupSettingsSchema = z.object({ cosmetics: cosmeticsSchema.optional(), fullComparison: z.boolean().default(true), legacyReview: z.boolean().default(true), focus: z.enum(["pve", "pvp", "both"]), location: z.enum(["vault", "all"]), exact: z.boolean(), dominance: z.boolean(), preferences: z.boolean(), aggressive: z.boolean(), sources: z.array(z.enum(["voltron", "choosy-voltron", "just-another-team"])).min(1).max(3), priorities: z.object({ health: weight, melee: weight, grenade: weight, super: weight, class: weight, weapons: weight }) });
const CLEANUP_CACHE_TTL_MS = 10 * 60_000;
const CLEANUP_REFRESH_LEASE_MS = 4 * 60_000;

export interface StoredCleanupAnalysis {
  settingsKey: string;
  settings: CleanupSettings;
  analysis?: CleanupAnalysis;
  refreshedAt?: string;
  expiresAt?: string;
  requestedAt: string;
  refreshStartedAt?: string;
  lastError?: string;
}

export async function cleanupSettingsKey(settings: CleanupSettings): Promise<string> {
  return sha256(JSON.stringify(cleanupSettingsSchema.parse(settings)));
}

function storedCleanup(row: any): StoredCleanupAnalysis | undefined {
  if (!row?.settings_json) return undefined;
  try {
    return {
      settingsKey: String(row.settings_key),
      settings: cleanupSettingsSchema.parse(JSON.parse(row.settings_json)),
      ...(row.analysis_json ? { analysis: JSON.parse(row.analysis_json) as CleanupAnalysis } : {}),
      refreshedAt: row.refreshed_at || undefined,
      expiresAt: row.expires_at || undefined,
      requestedAt: String(row.requested_at),
      refreshStartedAt: row.refresh_started_at || undefined,
      lastError: row.last_error || undefined
    };
  } catch { return undefined; }
}

export async function readCleanupAnalysisCache(membershipId: string, env: Env, settingsKey?: string): Promise<StoredCleanupAnalysis | undefined> {
  const query = settingsKey
    ? "SELECT * FROM guardian_cleanup_analysis_cache WHERE membership_id = ? AND settings_key = ?"
    : "SELECT * FROM guardian_cleanup_analysis_cache WHERE membership_id = ? AND analysis_json IS NOT NULL ORDER BY refreshed_at DESC LIMIT 1";
  const value = settingsKey
    ? await env.DB.prepare(query).bind(membershipId, settingsKey).first<any>()
    : await env.DB.prepare(query).bind(membershipId).first<any>();
  return storedCleanup(value);
}

export async function requestCleanupAnalysisRefresh(membershipId: string, env: Env, settings: CleanupSettings): Promise<string> {
  const parsed = cleanupSettingsSchema.parse(settings);
  const key = await cleanupSettingsKey(parsed);
  await env.DB.prepare(`INSERT INTO guardian_cleanup_analysis_cache
    (membership_id, settings_key, settings_json, requested_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(membership_id, settings_key) DO UPDATE SET settings_json = excluded.settings_json, requested_at = excluded.requested_at`)
    .bind(membershipId, key, JSON.stringify(parsed), new Date().toISOString()).run();
  await env.DB.prepare(`DELETE FROM guardian_cleanup_analysis_cache WHERE membership_id = ? AND settings_key NOT IN
    (SELECT settings_key FROM guardian_cleanup_analysis_cache WHERE membership_id = ? ORDER BY requested_at DESC LIMIT 8)`)
    .bind(membershipId, membershipId).run();
  return key;
}

export async function ensureCleanupAnalysisRefresh(membershipId: string, env: Env, settings: CleanupSettings): Promise<string> {
  const parsed = cleanupSettingsSchema.parse(settings);
  const key = await cleanupSettingsKey(parsed);
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO guardian_cleanup_analysis_cache
    (membership_id, settings_key, settings_json, requested_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(membership_id, settings_key) DO UPDATE SET settings_json = excluded.settings_json, requested_at = excluded.requested_at
    WHERE guardian_cleanup_analysis_cache.expires_at <= excluded.requested_at
      AND guardian_cleanup_analysis_cache.requested_at <= excluded.requested_at
      AND guardian_cleanup_analysis_cache.requested_at <= guardian_cleanup_analysis_cache.refreshed_at`)
    .bind(membershipId, key, JSON.stringify(parsed), now).run();
  return key;
}

export async function refreshCleanupAnalysisCacheWithLease(row: SessionRow, env: Env, settingsKey: string): Promise<void> {
  const startedAt = new Date().toISOString();
  const claim = await env.DB.prepare(`UPDATE guardian_cleanup_analysis_cache SET refresh_started_at = ?, last_error = NULL
    WHERE membership_id = ? AND settings_key = ? AND (refresh_started_at IS NULL OR refresh_started_at < ?)`)
    .bind(startedAt, row.membership_id, settingsKey, new Date(Date.now() - CLEANUP_REFRESH_LEASE_MS).toISOString()).run();
  if (Number(claim.meta?.changes || 0) < 1) return;
  const cached = await readCleanupAnalysisCache(row.membership_id, env, settingsKey);
  if (!cached) return;
  try {
    const { analysis } = await cleanupSnapshot(row, env, cached.settings);
    const refreshedAt = new Date().toISOString();
    await env.DB.prepare(`UPDATE guardian_cleanup_analysis_cache SET analysis_json = ?, source_minted_at = ?,
      refreshed_at = ?, expires_at = ?, requested_at = ?, refresh_started_at = NULL, last_error = NULL
      WHERE membership_id = ? AND settings_key = ? AND refresh_started_at = ?`)
      .bind(JSON.stringify(analysis), analysis.observedAt, refreshedAt, new Date(Date.now() + CLEANUP_CACHE_TTL_MS).toISOString(), refreshedAt, row.membership_id, settingsKey, startedAt).run();
  } catch (error: any) {
    await env.DB.prepare(`UPDATE guardian_cleanup_analysis_cache SET refresh_started_at = NULL, last_error = ?, requested_at = ?
      WHERE membership_id = ? AND settings_key = ? AND refresh_started_at = ?`)
      .bind(String(error?.code || error?.message || "Cleanup refresh failed.").slice(0, 240), new Date(Date.now() + 2 * 60_000).toISOString(), row.membership_id, settingsKey, startedAt).run().catch(() => undefined);
    throw error;
  }
}

export function cleanupAnalyzeData(cached: StoredCleanupAnalysis | undefined, requestedSettings: CleanupSettings): CleanupAnalyzeData {
  const refreshing = Boolean(cached?.refreshStartedAt) || !cached?.analysis;
  const fresh = Boolean(cached?.analysis && cached.expiresAt && Date.parse(cached.expiresAt) > Date.now());
  return {
    ...(cached?.analysis ? { analysis: cached.analysis } : {}),
    status: fresh ? "current" : refreshing ? "refreshing" : cached?.lastError ? "failed" : "saved",
    requestedSettings,
    refreshedAt: cached?.refreshedAt,
    lastError: cached?.lastError
  };
}
export async function cleanupMarks(membershipId: string, env: Env): Promise<NonNullable<GearData["cleanup"]>> {
  const rows = await env.DB.prepare("SELECT item_id, batch_id, reason, confidence FROM cleanup_marks WHERE membership_id = ?").bind(membershipId).all<{ item_id: string; batch_id: string; reason: string; confidence: number }>();
  return Object.fromEntries((rows.results || []).map((r) => [r.item_id, { batchId: r.batch_id, reason: r.reason, confidence: r.confidence }]));
}
export async function cleanupSettings(membershipId: string, env: Env): Promise<CleanupSettings> {
  const row = await env.DB.prepare("SELECT settings_json FROM cleanup_preferences WHERE membership_id = ?").bind(membershipId).first<{ settings_json: string }>();
  if (row) { try {
    const saved = JSON.parse(row.settings_json);
    // Upgrade the original narrow defaults once; later explicit rule choices remain intact.
    return cleanupSettingsSchema.parse(saved.fullComparison === undefined ? { ...saved, fullComparison: true, legacyReview: true, preferences: true } : saved);
  } catch { /* obsolete settings */ } }
  const rating = await env.DB.prepare("SELECT preference_value FROM user_preferences WHERE membership_id = ? AND preference_key = 'weapons.ratingSource.v1'").bind(membershipId).first<{ preference_value: string }>();
  const source = rating?.preference_value === "choosy-voltron" || rating?.preference_value === "just-another-team" ? rating.preference_value : "voltron";
  return { ...CLEANUP_DEFAULTS, sources: [source] };
}
function savedReferences(value: unknown, owned: Set<string>, result: Set<string>): void {
  if ((typeof value === "string" || typeof value === "number") && owned.has(String(value))) result.add(String(value));
  else if (Array.isArray(value)) value.forEach((entry) => savedReferences(entry, owned, result));
  else if (value && typeof value === "object") Object.values(value).forEach((entry) => savedReferences(entry, owned, result));
}
export async function cleanupSnapshot(row: SessionRow, env: Env, settings: CleanupSettings): Promise<{ analysis: CleanupAnalysis; profile: any }> {
  // Canonical field order/defaults keep preview, approval and pull evidence identical.
  settings = cleanupSettingsSchema.parse(settings);
  const [{ profile }, manifest, stateRows, builds, drafts, marks, dismissals] = await Promise.all([
    profileFor(row, env, "cleanup", true), loadGearManifest(env),
    env.DB.prepare("SELECT * FROM gear_item_state WHERE membership_id = ?").bind(row.membership_id).all<GearStateRow>(),
    env.DB.prepare("SELECT build_json FROM builds WHERE author_membership_id = ?").bind(row.membership_id).all<{ build_json: string }>(),
    env.DB.prepare("SELECT build_json FROM build_working_drafts WHERE editor_membership_id = ?").bind(row.membership_id).all<{ build_json: string }>(),
    cleanupMarks(row.membership_id, env),
    env.DB.prepare("SELECT recommendation_key FROM cleanup_dismissals WHERE membership_id = ?").bind(row.membership_id).all<{ recommendation_key: string }>()
  ]);
  const characters = Object.keys(profile?.characters?.data || {});
  const characterId = characters[0];
  if (!characterId) throw httpError(409, "cleanup_inventory_incomplete", "Your character inventory is unavailable. No cleanup recommendations were made.");
  const states = new Map((stateRows.results || []).map((s) => [s.item_instance_id, s]));
  const gear = normalizeGear(profile, manifest, characterId, "Unknown", states, new Date().toISOString());
  for (const item of gear.items) {
    const sockets: any[] = profile?.itemComponents?.sockets?.data?.[item.instanceId]?.sockets || [];
    const definition = manifest.gearItemDefinitions[item.itemHash] as any;
    const capability = definition?.cleanupCapabilities;
    const energy = profile?.itemComponents?.instances?.data?.[item.instanceId]?.energy;
    if (!capability?.socketTypes?.length || !sockets.length || !sockets.every((socket) => !socket.plugHash || manifest.plugDefinitions[String(socket.plugHash)])) continue;
    const capabilities = sockets.flatMap((socket, index) => {
      const plug = manifest.plugDefinitions[String(socket.plugHash)] as any;
      if (/shader|ornament|skin|tracker/i.test(String(plug?.plug?.plugCategoryIdentifier || ""))) return [];
      return [[index, String(socket.plugHash || ""), (profile?.itemComponents?.reusablePlugs?.data?.[item.instanceId]?.plugs?.[String(index)] || []).map((entry: any) => String(entry.plugItemHash)).sort()]];
    });
    // Equality evidence only; hashing every armor item adds avoidable Worker CPU.
    item.cleanupSocketKey = JSON.stringify([capability, energy?.energyCapacity, capabilities]);
  }
  const all = [...gear.items, ...(gear.weapons || [])].sort((a, b) => a.instanceId.localeCompare(b.instanceId));
  const owned = new Set(all.map((item) => item.instanceId)); const saved = new Set<string>();
  let complete = manifest.version !== "unavailable" && Array.isArray(profile?.profileInventory?.data?.items) && characters.every((id) => Array.isArray(profile?.characterInventories?.data?.[id]?.items) && Array.isArray(profile?.characterEquipment?.data?.[id]?.items) && Array.isArray(profile?.characterLoadouts?.data?.[id]?.loadouts));
  savedReferences(profile?.characterLoadouts?.data, owned, saved);
  const inventoryRows: any[] = [...(profile?.profileInventory?.data?.items || []), ...Object.values(profile?.characterInventories?.data || {}).flatMap((c: any) => c.items || []), ...Object.values(profile?.characterEquipment?.data || {}).flatMap((c: any) => c.items || [])];
  const rawItems = new Map(inventoryRows.filter((item) => item.itemInstanceId).map((item) => [String(item.itemInstanceId), item]));
  const minted = Date.parse(profile?.responseMintedTimestamp || "");
  complete = complete && Number.isFinite(minted) && Date.now() - minted < 120_000;
  const incompleteIds = new Set(all.filter((item) => {
    const components = profile?.itemComponents;
    const raw = rawItems.get(item.instanceId);
    return !Number.isFinite(components?.state?.data?.[item.instanceId]?.state ?? raw?.state)
      || !components?.instances?.data?.[item.instanceId]
      || !components?.stats?.data?.[item.instanceId]?.stats
      || !components?.reusablePlugs?.data
      || !Array.isArray(components?.sockets?.data?.[item.instanceId]?.sockets)
      || ("perkColumns" in item && !components?.objectives?.data);
  }).map((item) => item.instanceId));
  // Armor normalization exposes active tuning; also require equal physical socket choices.
  // This conservatively preserves different available tuning/mod combinations.
  const armorSockets = new Map(gear.items.map((item) => [item.instanceId, JSON.stringify((profile?.itemComponents?.sockets?.data?.[item.instanceId]?.sockets || []).map((socket: any, index: number) => [socket.plugHash, (profile?.itemComponents?.reusablePlugs?.data?.[item.instanceId]?.plugs?.[String(index)] || []).map((plug: any) => String(plug.plugItemHash)).sort()]))]));
  for (const build of [...(builds.results || []), ...(drafts.results || [])]) {
    try {
      const parsed = JSON.parse(build.build_json);
      savedReferences(parsed, owned, saved);
      // Builds without physical IDs can still reserve a named item hash: protect all owned copies.
      const hashes = new Set(all.map((item) => item.itemHash)); const referencedHashes = new Set<string>();
      savedReferences(parsed, hashes, referencedHashes);
      all.filter((item) => referencedHashes.has(item.itemHash)).forEach((item) => saved.add(item.instanceId));
    } catch { complete = false; }
  }
  const sources: CleanupWishlist[] = [];
  if (settings.preferences) for (const id of [...new Set(settings.sources)]) {
    try {
      const file = id === "voltron" ? "weapon-value.v4.json" : `weapon-value.${id}.v4.json`;
      const response = await fetch(new URL(file, env.GAME_DATA_URL), { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) continue;
      const data = await response.json() as any;
      if (data.schemaVersion === 4 && data.items && data.reviewedAt && data.source?.name) sources.push({ id, name: data.source.name, reviewedAt: data.reviewedAt, items: Object.fromEntries(all.filter((item) => data.items[item.itemHash]).map((item) => [item.itemHash, data.items[item.itemHash]])), perkAliases: data.perkAliases });
    } catch { /* A missing catalog must not become a negative rating. */ }
  }
  const result = analyzeCleanup({ ...gear, items: gear.items.filter((item) => !incompleteIds.has(item.instanceId)), weapons: gear.weapons?.filter((item) => !incompleteIds.has(item.instanceId)) }, settings, saved, complete, sources);
  result.insufficient.push(...incompleteIds);
  const cosmetics = cosmeticChoices(profile, gear, manifest);
  const sourceVersions = await Promise.all(sources.map((source) => sha256(JSON.stringify(source))));
  const version = await sha256(JSON.stringify(["cleanup-v1", manifest.version, settings, sourceVersions, [...saved].sort(), complete, [...incompleteIds].sort(), [...armorSockets], all.map(({ firstSeenAt: _first, isNew: _new, dismissedAt: _dismissed, ...item }) => item)]));
  const recommendations = await Promise.all(result.recommendations.filter((entry) => !marks[entry.keeperId] && (!entry.actionable || (settings.fullComparison && gear.items.find((item) => item.instanceId === entry.itemId)?.cleanupSocketKey) || armorSockets.get(entry.itemId) === armorSockets.get(entry.keeperId))).map(async (entry) => ({ ...entry, key: await sha256(JSON.stringify([entry.key, armorSockets.get(entry.itemId), entry.confidence === 70 ? sourceVersions : []])) })));
  const cosmeticSets = cosmeticSetChoices(manifest, cosmetics, settings.cosmetics?.classStyles);
  return { profile, analysis: { cosmeticSets, cosmetics, version, observedAt: String(profile?.responseMintedTimestamp || new Date().toISOString()), settings, gear, recommendations, insufficient: result.insufficient, marks, dismissed: (dismissals.results || []).map((r) => r.recommendation_key), sources: sources.map(({ id, name, reviewedAt }) => ({ id, name, reviewedAt })), warnings: [
    ...(!complete ? ["Inventory or saved-loadout protection data is incomplete or more than two minutes old. Tagging is disabled; try analyzing again."] : []),
    ...(settings.preferences && sources.length !== new Set(settings.sources).size ? ["One or more selected rating catalogs are unavailable. Source-based weapon recommendations are disabled."] : [])
  ] } };
}
export async function validateCleanupPull(request: Request, row: SessionRow, env: Env) {
  const input = z.object({ itemId: z.string().regex(/^\d+$/), characterId: z.string().regex(/^\d+$/), settings: cleanupSettingsSchema }).parse(await request.json());
  const { analysis, profile } = await cleanupSnapshot(row, env, input.settings);
  const entry = analysis.recommendations.find((r) => r.itemId === input.itemId);
  const approval = await env.DB.prepare("SELECT recommendation_key FROM cleanup_marks WHERE membership_id = ? AND item_id = ?").bind(row.membership_id, input.itemId).first<{ recommendation_key: string }>();
  if (!entry?.actionable || approval?.recommendation_key !== entry.key || analysis.dismissed.includes(entry.key)) throw httpError(409, "cleanup_changed", "This item is no longer an approved, unprotected cleanup candidate. Analyze again.");
  if (!profile.characters.data[input.characterId]) throw httpError(403, "character_invalid", "Choose one of your characters.");
  const item = gearActionItemsFromProfile(profile).get(input.itemId);
  if (!item?.bucketHash) throw httpError(409, "cleanup_capacity_unknown", "Cannot verify the destination slot.");
  if (item.ownerCharacterId !== input.characterId) {
    const used = (profile.characterInventories.data[input.characterId]?.items || []).filter((other: any) => String(other.bucketHash) === item.bucketHash).length;
    if (used >= 9) throw httpError(409, "character_full", "That character's inventory slot is full. Free a slot before pulling.");
  }
  return { action: "transfer" as const, itemInstanceId: input.itemId, target: "character" as const, targetCharacterId: input.characterId };
}
const mutation = z.object({ action: z.enum(["approve", "dismiss", "undo"]), version: z.string().optional(), settings: cleanupSettingsSchema, itemIds: z.array(z.string().regex(/^\d+$/)).max(50).default([]), batchId: z.string().uuid() });
export async function mutateCleanup(request: Request, row: SessionRow, env: Env) {
  const input = mutation.parse(await request.json());
  const existing = await env.DB.prepare("SELECT result_json, undone FROM cleanup_batches WHERE membership_id = ? AND batch_id = ?").bind(row.membership_id, input.batchId).first<{ result_json: string; undone: number }>();
  if (input.action === "undo") {
    if (!existing) throw httpError(404, "cleanup_batch_missing", "That cleanup batch was not found.");
    await env.DB.batch([
      env.DB.prepare("DELETE FROM cleanup_marks WHERE membership_id = ? AND batch_id = ?").bind(row.membership_id, input.batchId),
      env.DB.prepare("UPDATE cleanup_batches SET undone = 1 WHERE membership_id = ? AND batch_id = ?").bind(row.membership_id, input.batchId)
    ]);
    return { batchId: input.batchId, undone: true, marks: await cleanupMarks(row.membership_id, env) };
  }
  if (existing) {
    const result = JSON.parse(existing.result_json);
    const marks = await cleanupMarks(row.membership_id, env);
    return { ...result, ...(result.action === "approve" ? { itemIds: Object.keys(marks).filter((id) => marks[id]?.batchId === input.batchId) } : {}), undone: Boolean(existing.undone), marks };
  }
  const { analysis } = await cleanupSnapshot(row, env, input.settings);
  if (analysis.version !== input.version) throw httpError(409, "cleanup_changed", "Your gear, protections, or settings changed. Analyze again before approving.");
  const chosen = [...new Set(input.itemIds)].map((id) => analysis.recommendations.find((r) => r.itemId === id));
  if (chosen.some((entry) => !entry || (input.action === "approve" && (!entry.actionable || analysis.dismissed.includes(entry.key))))) throw httpError(409, "cleanup_protected", "A selected item is protected, dismissed, or no longer recommended.");
  const keeperIds = new Set(analysis.recommendations.map((r) => r.keeperId));
  if (input.action === "approve" && input.itemIds.some((id) => keeperIds.has(id))) throw httpError(409, "cleanup_keeper", "A retained keeper cannot be tagged for cleanup.");
  const result = { batchId: input.batchId, itemIds: chosen.map((r) => r!.itemId), action: input.action };
  await env.DB.batch([
    ...chosen.map((entry) => input.action === "dismiss" ? env.DB.prepare("INSERT OR IGNORE INTO cleanup_dismissals (membership_id, recommendation_key) VALUES (?, ?)").bind(row.membership_id, entry!.key) : env.DB.prepare(`INSERT INTO cleanup_marks (membership_id, item_id, batch_id, reason, confidence, recommendation_key) SELECT ?, ?, ?, ?, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM gear_item_state WHERE membership_id = ? AND item_instance_id = ? AND tag IS NOT NULL AND tag != '')
      AND NOT EXISTS (SELECT 1 FROM cleanup_marks WHERE membership_id = ? AND item_id = ?)
      AND NOT EXISTS (SELECT 1 FROM cleanup_batches WHERE membership_id = ? AND batch_id = ?)
      ON CONFLICT(membership_id, item_id) DO NOTHING`).bind(row.membership_id, entry!.itemId, input.batchId, entry!.reason, entry!.confidence, entry!.key, row.membership_id, entry!.itemId, row.membership_id, entry!.keeperId, row.membership_id, input.batchId)),
    ...(input.action === "dismiss" ? chosen.map((entry) => env.DB.prepare("DELETE FROM cleanup_marks WHERE membership_id = ? AND item_id = ? AND recommendation_key = ?").bind(row.membership_id, entry!.itemId, entry!.key)) : []),
    env.DB.prepare("INSERT INTO cleanup_batches (membership_id, batch_id, result_json) VALUES (?, ?, ?) ON CONFLICT DO NOTHING").bind(row.membership_id, input.batchId, JSON.stringify(result))
  ]);
  const marks = await cleanupMarks(row.membership_id, env);
  const actual = { ...result, itemIds: input.action === "approve" ? Object.keys(marks).filter((id) => marks[id]?.batchId === input.batchId) : result.itemIds };
  await env.DB.prepare("UPDATE cleanup_batches SET result_json = ? WHERE membership_id = ? AND batch_id = ?").bind(JSON.stringify(actual), row.membership_id, input.batchId).run();
  return { ...actual, marks };
}
