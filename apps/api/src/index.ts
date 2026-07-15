import type {
  ApiEnvelope,
  CollectionData,
  DevProbeKey,
  DevProbeResult,
  FireteamData,
  FireteamMember,
  FireteamSharingMode,
  GearActionRequest,
  GearActionResult,
  GearData,
  MatrixData,
  MatrixSnapshot,
  QuestData,
  SessionData
} from "@guardian-nexus/contracts";
import { z } from "zod";
import { accessTokenFor, bungieGet, bungiePost, destinyDisplayName, emblemPathFor, exchangeCode, loadGearManifest, loadManifest, membershipsFor, primaryMembership, profileFor, publicProfileFor, seasonPassRank, xurInventoryFor } from "./bungie";
import { partyPresenceLabel } from "@guardian-nexus/domain";
import { activityName, charactersFromProfile, guardianOnlineState, normalizeCollection, normalizeGuardian, normalizeQuests, selectedCharacter } from "./normalize";
import { allowlist, cookie, csrfToken, encrypt, httpError, parseCookies, randomToken, redact, requireCsrf, sessionFromRequest, sha256 } from "./security";
import type { Env, RequestContext, SessionRow } from "./types";
import { normalizeGear, type GearStateRow } from "./gear";

const shareSchema = z.object({
  characterId: z.string().min(1),
  sitePinnedQuestIds: z.array(z.string()).max(40).default([]),
  mode: z.enum(["temporary", "persistent"]).default("temporary")
});

const probeSchema = z.object({
  probe: z.enum(["memberships", "profile", "character", "item", "collectible", "public-milestones", "manifest"]),
  characterId: z.string().optional(),
  hash: z.string().regex(/^\d+$/).optional(),
  components: z.array(z.number().int().nonnegative()).max(20).optional()
});

const gearStateSchema = z.object({ itemInstanceId: z.string().regex(/^\d+$/), tag: z.enum(["favorite", "keep", "junk", "infuse", "archive"]).nullable().optional(), dismissed: z.boolean().optional() });
const gearActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("transfer"), itemInstanceId: z.string().regex(/^\d+$/), target: z.enum(["vault", "character"]), targetCharacterId: z.string().regex(/^\d+$/).optional() }),
  z.object({ action: z.literal("equip"), itemInstanceId: z.string().regex(/^\d+$/), characterId: z.string().regex(/^\d+$/) }),
  z.object({ action: z.literal("setLock"), itemInstanceId: z.string().regex(/^\d+$/), locked: z.boolean(), characterId: z.string().regex(/^\d+$/).optional() }),
  z.object({ action: z.literal("groupPull"), itemInstanceIds: z.array(z.string().regex(/^\d+$/)).min(1).max(20), characterId: z.string().regex(/^\d+$/) })
]);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const context: RequestContext = {
      requestId: crypto.randomUUID(),
      url: new URL(request.url),
      origin: request.headers.get("Origin") || ""
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(env, context.origin) });
    try {
      return await route(request, env, context);
    } catch (error: any) {
      const status = Number(error?.status || 500);
      return json({
        code: error?.code || "server_error",
        message: status >= 500 && !error?.code ? "Guardian Nexus could not complete the request." : error?.message || "Request failed.",
        ...(error?.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
        requestId: context.requestId
      }, status, env, context.origin, error?.retryAfterSeconds);
    }
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM fireteam_shares WHERE sharing_mode = 'temporary' AND expires_at <= ?").bind(now),
      env.DB.prepare("DELETE FROM oauth_sessions WHERE refresh_expires_at <= ?").bind(Math.floor(Date.now() / 1000))
    ]);
    await refreshPersistentShares(env);
  }
};

async function route(request: Request, env: Env, context: RequestContext): Promise<Response> {
  const path = context.url.pathname.replace(/\/$/, "") || "/";
  if (path === "/api/v1/health" && request.method === "GET") {
    return envelope({ service: "guardian-nexus-api", oauth: Boolean(env.BUNGIE_CLIENT_SECRET), database: "guardian-nexus-v1" }, env, context);
  }
  if (path === "/api/v1/auth/start" && request.method === "GET") return startAuth(request, env, context);
  if (path === "/api/v1/auth/callback" && request.method === "GET") return finishAuth(request, env, context);
  if (path === "/api/v1/session" && request.method === "GET") return readSession(request, env, context);
  if (path === "/api/v1/session" && request.method === "DELETE") return deleteSession(request, env, context);

  const session = await requireSession(request, env);
  if (path === "/api/v1/me/overview" && request.method === "GET") return overview(session.row, env, context);
  if (path === "/api/v1/me/collection" && request.method === "GET") return collection(session.row, env, context);
  if (path === "/api/v1/me/quests" && request.method === "GET") return quests(session.row, env, context);
  if (path === "/api/v1/me/gear" && request.method === "GET") return gear(session.row, env, context);
  if (path === "/api/v1/me/gear/item-state" && request.method === "PUT") { await requireCsrf(request, session.token, env); return updateGearState(request, session.row, env, context); }
  if (path === "/api/v1/me/gear/action" && request.method === "POST") { await requireCsrf(request, session.token, env); return gearAction(request, session.row, env, context); }
  if (path === "/api/v1/fireteam" && request.method === "GET") return fireteam(session.row, env, context);
  if (path === "/api/v1/fireteam/share" && request.method === "PUT") {
    await requireCsrf(request, session.token, env);
    return upsertShare(request, session.row, env, context);
  }
  if (path === "/api/v1/fireteam/share" && request.method === "DELETE") {
    await requireCsrf(request, session.token, env);
    await env.DB.prepare("DELETE FROM fireteam_shares WHERE membership_id = ?").bind(session.row.membership_id).run();
    return envelope({ sharing: false }, env, context);
  }
  if (path === "/api/v1/matrix" && request.method === "GET") return matrix(session.row, env, context);
  if (path === "/api/v1/matrix/sync" && request.method === "POST") {
    await requireCsrf(request, session.token, env);
    return syncMatrix(session.row, env, context);
  }
  if (path === "/api/v1/dev/probe" && request.method === "POST") {
    await requireCsrf(request, session.token, env);
    return devProbe(request, session.row, env, context);
  }
  if (path === "/api/v1/dev/manifest/search" && request.method === "GET") return manifestSearch(session.row, env, context);
  throw httpError(404, "not_found", "This Guardian Nexus endpoint does not exist.");
}

function corsHeaders(env: Env, origin: string): HeadersInit {
  const allowed = new Set([env.ALLOWED_ORIGIN, env.WEB_ORIGIN].flatMap((value) => (value || "").split(",")).map((value) => value.trim()).filter(Boolean));
  const accepted = allowed.has(origin) ? origin : env.WEB_ORIGIN;
  return {
    "Access-Control-Allow-Origin": accepted,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type,X-CSRF-Token",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    Vary: "Origin"
  };
}

function json(value: unknown, status: number, env: Env, origin: string, retryAfter?: number, extraHeaders?: HeadersInit): Response {
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...corsHeaders(env, origin), ...extraHeaders });
  if (retryAfter) headers.set("Retry-After", String(retryAfter));
  return new Response(JSON.stringify(value), { status, headers });
}

function envelope<T>(data: T, env: Env, context: RequestContext, options: { warnings?: string[]; observedAt?: string; sourceMintedAt?: string; state?: ApiEnvelope<T>["freshness"]["state"] } = {}): Response {
  const observedAt = options.observedAt || new Date().toISOString();
  const sourceTime = options.sourceMintedAt ? Date.parse(options.sourceMintedAt) : Date.parse(observedAt);
  const ageSeconds = Math.max(0, Math.round((Date.now() - sourceTime) / 1000));
  const body: ApiEnvelope<T> = {
    data,
    freshness: {
      state: options.state || (ageSeconds > 180 ? "stale" : "fresh"),
      observedAt,
      sourceMintedAt: options.sourceMintedAt,
      ageSeconds
    },
    warnings: options.warnings || [],
    requestId: context.requestId
  };
  return json(body, 200, env, context.origin);
}

async function requireSession(request: Request, env: Env): Promise<{ token: string; row: SessionRow }> {
  const session = await sessionFromRequest(request, env);
  if (!session) throw httpError(401, "authentication_required", "Sign in with Bungie to continue.");
  return session;
}

function secureCookies(context: RequestContext): boolean {
  return context.url.protocol === "https:";
}

async function startAuth(_request: Request, env: Env, context: RequestContext): Promise<Response> {
  if (!env.BUNGIE_CLIENT_ID) throw httpError(503, "oauth_unconfigured", "Bungie OAuth is not configured.");
  const state = randomToken(24);
  const returnTo = sanitizeReturnTo(context.url.searchParams.get("returnTo"));
  const target = new URL("https://www.bungie.net/en/OAuth/Authorize");
  target.searchParams.set("client_id", env.BUNGIE_CLIENT_ID);
  target.searchParams.set("response_type", "code");
  target.searchParams.set("state", state);
  return new Response(null, {
    status: 302,
    headers: {
      Location: target.toString(),
      "Set-Cookie": cookie("gn_oauth_state", `${state}.${base64Text(returnTo)}`, { maxAge: 600, secure: secureCookies(context) }),
      ...corsHeaders(env, context.origin)
    }
  });
}

async function finishAuth(request: Request, env: Env, context: RequestContext): Promise<Response> {
  const code = context.url.searchParams.get("code") || "";
  const state = context.url.searchParams.get("state") || "";
  const stateCookie = parseCookies(request).gn_oauth_state || "";
  const [expectedState, encodedReturn] = stateCookie.split(".");
  if (!code || !state || !expectedState || state !== expectedState) throw httpError(400, "oauth_state_invalid", "Bungie sign-in state could not be verified.");
  const token = await exchangeCode(code, env);
  if (!token.refresh_token) throw httpError(503, "refresh_token_missing", "The Bungie application must be configured as a confidential OAuth client.");
  const memberships = await membershipsFor(token.access_token, env);
  const membership = primaryMembership(memberships);
  if (!membership?.membershipId) throw httpError(400, "destiny_membership_missing", "This Bungie account has no Destiny membership.");
  const membershipId = String(membership.membershipId);
  const membershipType = Number(membership.membershipType);
  const displayName = membership.displayName || memberships?.bungieNetUser?.displayName || "Guardian";
  const bungieName = memberships?.bungieNetUser?.uniqueName || memberships?.bungieNetUser?.displayName || displayName;
  const now = Math.floor(Date.now() / 1000);
  const sessionToken = randomToken();
  const sessionHash = await sha256(sessionToken);
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO users (membership_id, membership_type, display_name, bungie_name, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(membership_id) DO UPDATE SET membership_type = excluded.membership_type, display_name = excluded.display_name, bungie_name = excluded.bungie_name, updated_at = excluded.updated_at
    `).bind(membershipId, membershipType, displayName, bungieName, new Date().toISOString()),
    env.DB.prepare(`
      INSERT INTO oauth_sessions (session_hash, membership_id, access_token_cipher, refresh_token_cipher, access_expires_at, refresh_expires_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      sessionHash,
      membershipId,
      await encrypt(token.access_token, env.OAUTH_ENCRYPTION_KEY),
      await encrypt(token.refresh_token, env.OAUTH_ENCRYPTION_KEY),
      now + Number(token.expires_in || 3600),
      now + Number(token.refresh_expires_in || 7_776_000),
      new Date().toISOString()
    )
  ]);
  const returnTo = sanitizeReturnTo(decodeText(encodedReturn || ""));
  return new Response(null, {
    status: 302,
    headers: {
      Location: new URL(returnTo, env.WEB_ORIGIN).toString(),
      "Set-Cookie": cookie("gn_session", sessionToken, { maxAge: Number(token.refresh_expires_in || 7_776_000), secure: secureCookies(context) }),
      ...corsHeaders(env, context.origin)
    }
  });
}

async function readSession(request: Request, env: Env, context: RequestContext): Promise<Response> {
  const session = await sessionFromRequest(request, env);
  if (!session) return envelope<SessionData>({ authenticated: false, roles: { dev: false, matrixWriter: false } }, env, context);
  const { profile, accessToken } = await profileFor(session.row, env);
  const manifest = await loadManifest(env);
  const guardian = normalizeGuardian({
    profile,
    membershipId: session.row.membership_id,
    membershipType: session.row.membership_type,
    displayName: session.row.display_name,
    bungieName: session.row.bungie_name,
    requestedCharacterId: context.url.searchParams.get("characterId") || undefined,
    rewardsPassRank: await seasonPassRank(profile, accessToken, env),
    manifest
  });
  return envelope<SessionData>({
    authenticated: true,
    guardian,
    csrfToken: await csrfToken(session.token, env),
    roles: {
      dev: allowlist(env.DEV_MEMBERSHIP_IDS).has(session.row.membership_id),
      matrixWriter: allowlist(env.MATRIX_MEMBERSHIP_IDS).has(session.row.membership_id)
    }
  }, env, context, { sourceMintedAt: profile?.responseMintedTimestamp });
}

async function deleteSession(request: Request, env: Env, context: RequestContext): Promise<Response> {
  const session = await requireSession(request, env);
  await requireCsrf(request, session.token, env);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM fireteam_shares WHERE membership_id = ?").bind(session.row.membership_id),
    env.DB.prepare("DELETE FROM oauth_sessions WHERE session_hash = ?").bind(session.row.session_hash)
  ]);
  return json({ data: { authenticated: false }, freshness: { state: "fresh", observedAt: new Date().toISOString() }, warnings: [], requestId: context.requestId }, 200, env, context.origin, undefined, {
    "Set-Cookie": cookie("gn_session", "", { maxAge: 0, secure: secureCookies(context) })
  });
}

async function overview(row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const { profile, accessToken } = await profileFor(row, env);
  const manifest = await loadManifest(env);
  const guardian = normalizeGuardian({
    profile,
    membershipId: row.membership_id,
    membershipType: row.membership_type,
    displayName: row.display_name,
    bungieName: row.bungie_name,
    requestedCharacterId: context.url.searchParams.get("characterId") || undefined,
    rewardsPassRank: await seasonPassRank(profile, accessToken, env),
    manifest
  });
  return envelope(guardian, env, context, { sourceMintedAt: profile?.responseMintedTimestamp, warnings: transitoryWarning(profile) });
}

async function collection(row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const { profile, accessToken } = await profileFor(row, env);
  const manifest = await loadManifest(env);
  const character = selectedCharacter(charactersFromProfile(profile), context.url.searchParams.get("characterId") || undefined);
  const xur = character?.characterId
    ? await xurInventoryFor(row, character.characterId, env, accessToken)
    : { state: "unavailable" as const, itemHashes: [], checkedAt: new Date().toISOString(), warning: "Xûr inventory requires a selected character." };
  const data = normalizeCollection(profile, manifest, character?.className || "Unknown", new Set(xur.itemHashes));
  data.xur = { state: xur.state, checkedAt: xur.checkedAt, nextRefreshAt: xur.nextRefreshAt };
  const warnings = [
    ...(manifest.version === "unavailable" ? ["Current manifest data is unavailable; run the manifest sync before production deployment."] : []),
    ...(xur.warning ? [xur.warning] : [])
  ];
  return envelope<CollectionData>(data, env, context, { sourceMintedAt: profile?.responseMintedTimestamp, warnings });
}

async function quests(row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const { profile } = await profileFor(row, env);
  const manifest = await loadManifest(env);
  const character = selectedCharacter(charactersFromProfile(profile), context.url.searchParams.get("characterId") || undefined);
  if (!character) throw httpError(404, "character_missing", "No Destiny character is available.");
  const pinned = new Set((context.url.searchParams.get("pinned") || "").split(",").filter(Boolean));
  return envelope<QuestData>(normalizeQuests(profile, manifest, character.characterId, pinned), env, context, { sourceMintedAt: profile?.responseMintedTimestamp });
}

async function gear(row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const { profile } = await profileFor(row, env, true);
  const manifest = await loadGearManifest(env);
  const character = selectedCharacter(charactersFromProfile(profile), context.url.searchParams.get("characterId") || undefined);
  if (!character) throw httpError(404, "character_missing", "No Destiny character is available.");
  const states = await gearStates(row.membership_id, env);
  const now = new Date().toISOString();
  const data = normalizeGear(profile, manifest, character.characterId, character.className, states, now);
  const missing = data.items.filter((item) => !states.has(item.instanceId));
  for (let offset = 0; offset < missing.length; offset += 80) {
    await env.DB.batch(missing.slice(offset, offset + 80).map((item) => env.DB.prepare("INSERT OR IGNORE INTO gear_item_state (membership_id, item_instance_id, first_seen_at, updated_at) VALUES (?, ?, ?, ?)").bind(row.membership_id, item.instanceId, now, now)));
  }
  return envelope<GearData>(data, env, context, { sourceMintedAt: profile?.responseMintedTimestamp, warnings: manifest.version !== "unavailable" ? [] : ["Armor manifest data is unavailable; refresh the deployment manifest before using Gear."] });
}

async function updateGearState(request: Request, row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const input = gearStateSchema.parse(await request.json());
  const { profile, accessToken } = await profileFor(row, env, true);
  const manifest = await loadGearManifest(env);
  const character = selectedCharacter(charactersFromProfile(profile));
  if (!character) throw httpError(404, "character_missing", "No Destiny character is available.");
  const states = await gearStates(row.membership_id, env);
  const item = normalizeGear(profile, manifest, character.characterId, character.className, states, new Date().toISOString()).items.find((entry) => entry.instanceId === input.itemInstanceId);
  if (!item) throw httpError(404, "gear_item_missing", "That armor item does not belong to this Guardian.");
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO gear_item_state (membership_id, item_instance_id, tag, first_seen_at, dismissed_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(membership_id, item_instance_id) DO UPDATE SET tag = excluded.tag, dismissed_at = excluded.dismissed_at, updated_at = excluded.updated_at`)
    .bind(row.membership_id, item.instanceId, input.tag ?? item.tag ?? null, item.firstSeenAt || now, input.dismissed ? now : item.dismissedAt || null, now).run();
  let warning: string | undefined;
  if ((input.tag === "favorite" || input.tag === "keep") && !item.locked) {
    try { await bungiePost("/Destiny2/Actions/Items/SetLockState/", { state: true, itemId: item.instanceId, characterId: item.ownerCharacterId || character.characterId, membershipType: row.membership_type }, env, accessToken); }
    catch (error: any) { warning = `Tag saved, but Bungie could not lock the item: ${error.message}`; }
  }
  return envelope({ itemInstanceId: item.instanceId, tag: input.tag, dismissed: Boolean(input.dismissed) }, env, context, { warnings: warning ? [warning] : [] });
}

async function gearAction(request: Request, row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const input = gearActionSchema.parse(await request.json()) as GearActionRequest;
  const started = performance.now();
  const { profile, accessToken } = await profileFor(row, env, true);
  const manifest = await loadGearManifest(env);
  const characters = charactersFromProfile(profile);
  const selected = selectedCharacter(characters, "characterId" in input ? input.characterId : "targetCharacterId" in input ? input.targetCharacterId : undefined) || characters[0];
  if (!selected) throw httpError(404, "character_missing", "No Destiny character is available.");
  const items = normalizeGear(profile, manifest, selected.characterId, selected.className, await gearStates(row.membership_id, env), new Date().toISOString()).items;
  const byId = new Map(items.map((item) => [item.instanceId, item]));
  const requested = input.action === "groupPull" ? input.itemInstanceIds : [input.itemInstanceId];
  const result: GearActionResult = { action: input.action, succeeded: [], skipped: [], failed: [] };
  for (const instanceId of requested) {
    const item = byId.get(instanceId);
    const targetId = input.action === "equip" || input.action === "groupPull" ? input.characterId : input.action === "transfer" ? input.targetCharacterId : input.characterId;
    const target = targetId ? characters.find((character) => character.characterId === targetId) : undefined;
    if (!item) { result.failed.push({ itemInstanceId: instanceId, code: "ownership_invalid", message: "Item is not owned by this Guardian." }); continue; }
    if (targetId && !target) { result.failed.push({ itemInstanceId: instanceId, code: "character_invalid", message: "Target character is not owned by this Guardian." }); continue; }
    try {
      if (input.action === "setLock") {
        await bungiePost("/Destiny2/Actions/Items/SetLockState/", { state: input.locked, itemId: instanceId, characterId: input.characterId || item.ownerCharacterId || selected.characterId, membershipType: row.membership_type }, env, accessToken);
      } else if (input.action === "transfer") {
        if (input.target === "vault") {
          if (item.equipped) { result.skipped.push({ itemInstanceId: instanceId, reason: "Equip another item before vaulting this one." }); continue; }
          if (item.location === "vault") { result.skipped.push({ itemInstanceId: instanceId, reason: "Already in vault." }); continue; }
          await transfer(item, true, item.ownerCharacterId || selected.characterId, row, env, accessToken);
        } else {
          if (!target) throw httpError(400, "character_required", "Choose a target character.");
          await moveToCharacter(item, target.characterId, row, env, accessToken);
        }
      } else if (input.action === "groupPull") {
        if (item.location !== "vault") { result.skipped.push({ itemInstanceId: instanceId, reason: "Item is already outside the vault." }); continue; }
        await transfer(item, false, input.characterId, row, env, accessToken);
      } else if (input.action === "equip") {
        await moveToCharacter(item, input.characterId, row, env, accessToken);
        await bungiePost("/Destiny2/Actions/Items/EquipItem/", { itemId: instanceId, characterId: input.characterId, membershipType: row.membership_type }, env, accessToken);
      }
      result.succeeded.push(instanceId);
      await auditGear(row, env, input.action, instanceId, targetId, 200, undefined, performance.now() - started);
    } catch (error: any) {
      result.failed.push({ itemInstanceId: instanceId, code: String(error?.code || "action_failed"), message: String(error?.message || "Bungie action failed.") });
      await auditGear(row, env, input.action, instanceId, targetId, Number(error?.status || 500), String(error?.code || "action_failed"), performance.now() - started);
    }
  }
  return envelope(result, env, context, { warnings: result.failed.length ? ["One or more Gear actions failed. Inventory was refreshed from Bungie after the completed steps."] : [] });
}

async function gearStates(membershipId: string, env: Env): Promise<Map<string, GearStateRow>> {
  const { results = [] } = await env.DB.prepare("SELECT item_instance_id, tag, first_seen_at, dismissed_at FROM gear_item_state WHERE membership_id = ?").bind(membershipId).all<GearStateRow>();
  return new Map(results.map((row) => [String(row.item_instance_id), row]));
}

async function transfer(item: any, toVault: boolean, characterId: string, row: SessionRow, env: Env, accessToken: string): Promise<void> {
  await bungiePost("/Destiny2/Actions/Items/TransferItem/", { itemReferenceHash: Number(item.itemHash), stackSize: 1, transferToVault: toVault, itemId: item.instanceId, characterId, membershipType: row.membership_type }, env, accessToken);
}
async function moveToCharacter(item: any, characterId: string, row: SessionRow, env: Env, accessToken: string): Promise<void> {
  if (item.location === "vault") return transfer(item, false, characterId, row, env, accessToken);
  if (item.ownerCharacterId === characterId) return;
  if (item.equipped) throw httpError(409, "item_equipped", "Equip another item before moving this equipped armor.");
  await transfer(item, true, item.ownerCharacterId, row, env, accessToken);
  await transfer(item, false, characterId, row, env, accessToken);
}
async function auditGear(row: SessionRow, env: Env, action: string, itemId: string, target: string | undefined, status: number, code: string | undefined, duration: number): Promise<void> {
  await env.DB.prepare("INSERT INTO gear_action_audit (membership_id, action, item_instance_id, target_character_id, status, error_code, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(row.membership_id, action, itemId, target || null, status, code || null, Math.round(duration)).run();
}

async function upsertShare(request: Request, row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const input = shareSchema.parse(await request.json());
  const result = await storeShare(row, env, input.characterId, input.sitePinnedQuestIds, input.mode);
  return envelope({ sharing: true, mode: input.mode, expiresAt: input.mode === "temporary" ? result.expiresAt : undefined, sharedQuestCount: result.sharedQuestCount }, env, context, { sourceMintedAt: result.sourceMintedAt });
}

async function storeShare(row: SessionRow, env: Env, characterId: string, sitePinnedQuestIds: string[], mode: FireteamSharingMode): Promise<{ expiresAt: string; sharedQuestCount: number; sourceMintedAt?: string }> {
  const { profile } = await profileFor(row, env);
  const manifest = await loadManifest(env);
  const character = selectedCharacter(charactersFromProfile(profile), characterId);
  if (!character || character.characterId !== characterId) throw httpError(400, "character_invalid", "The selected character does not belong to this Guardian.");
  const allQuests = normalizeQuests(profile, manifest, character.characterId, new Set(sitePinnedQuestIds));
  const allowedIds = new Set(allQuests.quests.map((quest) => quest.instanceId));
  const questsToShare = allQuests.quests.filter((quest) => quest.inGameTracked || (quest.sitePinned && allowedIds.has(quest.instanceId)));
  const updatedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  const payload = { character, activity: allQuests.currentActivity, quests: questsToShare };
  await env.DB.prepare(`
    INSERT INTO fireteam_shares (membership_id, display_name, character_id, updated_at, expires_at, payload_json, sharing_mode, site_pinned_quest_ids_json, last_error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
    ON CONFLICT(membership_id) DO UPDATE SET display_name = excluded.display_name, character_id = excluded.character_id, updated_at = excluded.updated_at, expires_at = excluded.expires_at, payload_json = excluded.payload_json, sharing_mode = excluded.sharing_mode, site_pinned_quest_ids_json = excluded.site_pinned_quest_ids_json, last_error = NULL
  `).bind(row.membership_id, row.display_name, character.characterId, updatedAt, expiresAt, JSON.stringify(payload), mode, JSON.stringify(sitePinnedQuestIds)).run();
  return { expiresAt, sharedQuestCount: questsToShare.length, sourceMintedAt: profile?.responseMintedTimestamp };
}

async function refreshPersistentShares(env: Env): Promise<void> {
  const { results = [] } = await env.DB.prepare("SELECT membership_id, character_id, site_pinned_quest_ids_json FROM fireteam_shares WHERE sharing_mode = 'persistent'").all<any>();
  for (const share of results) {
    const row = await env.DB.prepare(`
      SELECT s.session_hash, s.membership_id, u.membership_type, u.display_name, u.bungie_name,
        s.access_token_cipher, s.refresh_token_cipher, s.access_expires_at, s.refresh_expires_at
      FROM oauth_sessions s JOIN users u ON u.membership_id = s.membership_id
      WHERE s.membership_id = ? AND s.refresh_expires_at > ?
      ORDER BY s.updated_at DESC LIMIT 1
    `).bind(String(share.membership_id), Math.floor(Date.now() / 1000)).first<SessionRow>();
    if (!row) {
      await env.DB.prepare("UPDATE fireteam_shares SET last_error = ? WHERE membership_id = ?").bind("Bungie authorization must be renewed.", String(share.membership_id)).run();
      continue;
    }
    let pinnedIds: string[] = [];
    try { pinnedIds = z.array(z.string()).max(40).parse(JSON.parse(String(share.site_pinned_quest_ids_json || "[]"))); } catch { pinnedIds = []; }
    try {
      await storeShare(row, env, String(share.character_id), pinnedIds, "persistent");
    } catch (error: any) {
      await env.DB.prepare("UPDATE fireteam_shares SET last_error = ? WHERE membership_id = ?").bind(String(error?.message || "Background refresh failed.").slice(0, 240), String(share.membership_id)).run();
    }
  }
}

async function fireteam(row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const { profile, accessToken } = await profileFor(row, env);
  const manifest = await loadManifest(env);
  const transitory = profile?.profileTransitoryData?.data || profile?.profileTransitory?.data || {};
  const now = new Date().toISOString();
  const { results = [] } = await env.DB.prepare("SELECT membership_id, display_name, updated_at, expires_at, payload_json, sharing_mode, last_error FROM fireteam_shares WHERE sharing_mode = 'persistent' OR expires_at > ?").bind(now).all<any>();
  const shares = new Map(results.map((result: any) => [String(result.membership_id), result]));
  const party = (transitory.partyMembers || []).map((member: any) => ({
    membershipId: String(member.membershipId || member.destinyMembershipId || ""),
    displayName: String(member.displayName || member.bungieGlobalDisplayName || "").trim(),
    emblemHash: String(member.emblemHash || ""),
    status: Number(member.status || 0)
  })).filter((member: any) => member.membershipId);
  if (!party.some((member: any) => member.membershipId === row.membership_id)) party.unshift({ membershipId: row.membership_id, displayName: row.bungie_name || row.display_name, emblemHash: "", status: 1 });
  const ownCharacter = selectedCharacter(charactersFromProfile(profile), context.url.searchParams.get("characterId") || undefined);
  const fireteamActivity = activityName(profile, manifest, ownCharacter?.characterId);
  const questCounts = new Map<string, number>();
  for (const member of party) {
    const share: any = shares.get(member.membershipId);
    const payload = share ? JSON.parse(share.payload_json) : null;
    for (const quest of payload?.quests || []) questCounts.set(String(quest.itemHash), (questCounts.get(String(quest.itemHash)) || 0) + 1);
  }
  const members: FireteamMember[] = await Promise.all(party.map(async (member: any) => {
    const share: any = shares.get(member.membershipId);
    let payload: any = null;
    try { payload = share ? JSON.parse(share.payload_json) : null; } catch { payload = null; }
    const memberQuests = payload?.quests || [];
    const isSelf = member.membershipId === row.membership_id;
    const publicProfile = !isSelf && (!share || !member.displayName)
      ? (await publicProfileFor(member.membershipId, row.membership_type, env, accessToken)).profile
      : undefined;
    const publicCharacters = publicProfile ? charactersFromProfile(publicProfile) : [];
    const publicCharacter = publicCharacters.find((entry) => entry.minutesPlayedThisSession > 0) || publicCharacters[0];
    const publicActivity = publicProfile ? activityName(publicProfile, manifest, publicCharacter?.characterId) : undefined;
    const character = payload?.character || publicCharacter || (isSelf ? ownCharacter : undefined);
    const directActivity = publicActivity || (isSelf ? fireteamActivity : undefined) || payload?.activity;
    const onlineState = guardianOnlineState(character, directActivity, isSelf || Boolean(publicProfile));
    const activity = onlineState === "offline" ? undefined : directActivity || fireteamActivity;
    const publicName = destinyDisplayName(publicProfile?.profile?.data?.userInfo);
    const inGameName = member.displayName || publicName || (isSelf ? row.bungie_name || row.display_name : share?.display_name) || "Unknown Guardian";
    return {
      membershipId: member.membershipId,
      displayName: inGameName,
      inGameName,
      emblemPath: character?.emblemPath || await emblemPathFor(member.emblemHash, env),
      presenceLabel: partyPresenceLabel(member.status),
      onlineState,
      character,
      activity,
      activitySource: publicActivity ? "public" : fireteamActivity ? "fireteam" : payload?.activity ? "shared" : "unavailable",
      isSelf,
      isLeader: (member.status & 8) !== 0,
      syncState: share ? "synced" : "not-synced",
      sharing: Boolean(share),
      sharingMode: share?.sharing_mode,
      expiresAt: share?.sharing_mode === "temporary" ? share?.expires_at : undefined,
      quests: memberQuests,
      overlaps: memberQuests.filter((quest: any) => (questCounts.get(String(quest.itemHash)) || 0) > 1).map((quest: any) => quest.name),
      freshness: {
        state: share && Date.now() - Date.parse(share.updated_at) > 15 * 60_000 ? "stale" : "fresh",
        observedAt: share?.updated_at || now,
        ageSeconds: share ? Math.max(0, Math.round((Date.now() - Date.parse(share.updated_at)) / 1000)) : 0
      }
    };
  }));
  const ownShare = shares.get(row.membership_id);
  const data: FireteamData = { sharingEnabled: Boolean(ownShare), sharingMode: ownShare?.sharing_mode || "off", sharingExpiresAt: ownShare?.sharing_mode === "temporary" ? ownShare.expires_at : undefined, activity: fireteamActivity, members };
  return envelope(data, env, context, { sourceMintedAt: profile?.responseMintedTimestamp, warnings: ["Bungie marks party and current-activity data as non-authoritative and potentially stale.", ...(ownShare?.last_error ? [String(ownShare.last_error)] : [])] });
}

async function matrix(row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  const { results = [] } = await env.DB.prepare("SELECT membership_id, display_name, synced_at, manifest_version, payload_json FROM matrix_snapshots ORDER BY display_name").all<any>();
  const snapshots = results.map((result: any) => ({ ...JSON.parse(result.payload_json), membershipId: result.membership_id, displayName: result.display_name, syncedAt: result.synced_at, manifestVersion: result.manifest_version }));
  return envelope<MatrixData>({ snapshots, canSync: allowlist(env.MATRIX_MEMBERSHIP_IDS).has(row.membership_id) }, env, context, {
    warnings: snapshots.some((snapshot: MatrixSnapshot) => Date.now() - Date.parse(snapshot.syncedAt) > 86_400_000) ? ["One or more Guardian snapshots are older than 24 hours."] : []
  });
}

async function syncMatrix(row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  if (!allowlist(env.MATRIX_MEMBERSHIP_IDS).has(row.membership_id)) throw httpError(403, "matrix_update_forbidden", "This Guardian may view but cannot update Guardian Matrix.");
  const { profile } = await profileFor(row, env);
  const manifest = await loadManifest(env);
  const characters = charactersFromProfile(profile);
  const classEntries = characters.flatMap((character) => normalizeCollection(profile, manifest, character.className).entries);
  const byHash = new Map(classEntries.map((entry) => [entry.itemHash, entry]));
  const syncedAt = new Date().toISOString();
  const snapshot: MatrixSnapshot = {
    membershipId: row.membership_id,
    displayName: row.display_name,
    syncedAt,
    manifestVersion: manifest.version,
    entries: [...byHash.values()].map(({ itemHash, name, kind, className: entryClass, owned, catalyst }) => ({ itemHash, name, kind, className: entryClass, owned, catalyst }))
  };
  await env.DB.prepare(`
    INSERT INTO matrix_snapshots (membership_id, display_name, synced_at, manifest_version, payload_json)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(membership_id) DO UPDATE SET display_name = excluded.display_name, synced_at = excluded.synced_at, manifest_version = excluded.manifest_version, payload_json = excluded.payload_json
  `).bind(row.membership_id, row.display_name, syncedAt, manifest.version, JSON.stringify(snapshot)).run();
  return envelope(snapshot, env, context, { sourceMintedAt: profile?.responseMintedTimestamp });
}

async function devProbe(request: Request, row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  requireDev(row, env);
  const input = probeSchema.parse(await request.json());
  const accessToken = await accessTokenFor(row, env);
  const components = (input.components || [100, 200]).join(",");
  const paths: Record<DevProbeKey, string> = {
    memberships: "/User/GetMembershipsForCurrentUser/",
    profile: `/Destiny2/${row.membership_type}/Profile/${row.membership_id}/?components=${components}`,
    character: `/Destiny2/${row.membership_type}/Profile/${row.membership_id}/Character/${required(input.characterId, "characterId")}/?components=${components}`,
    item: `/Destiny2/Manifest/DestinyInventoryItemDefinition/${required(input.hash, "hash")}/?lc=en`,
    collectible: `/Destiny2/Manifest/DestinyCollectibleDefinition/${required(input.hash, "hash")}/?lc=en`,
    "public-milestones": "/Destiny2/Milestones/",
    manifest: "/Destiny2/Manifest/"
  };
  const started = performance.now();
  let status = 200;
  let body: any;
  try {
    body = await bungieGet(paths[input.probe], env, accessToken);
  } catch (error: any) {
    status = Number(error.status || 500);
    body = { code: error.code, message: error.message, retryAfterSeconds: error.retryAfterSeconds };
  }
  const safeBody = redact(body);
  const durationMs = Math.round(performance.now() - started);
  const responseSize = new TextEncoder().encode(JSON.stringify(safeBody)).length;
  await env.DB.prepare("INSERT INTO dev_probe_audit (membership_id, endpoint_key, status, duration_ms, response_size) VALUES (?, ?, ?, ?, ?)").bind(row.membership_id, input.probe, status, durationMs, responseSize).run();
  const result: DevProbeResult = {
    probe: input.probe,
    status,
    durationMs,
    responseSize,
    throttleSeconds: Number(body?.ThrottleSeconds || body?.retryAfterSeconds || 0),
    mintedAt: body?.responseMintedTimestamp,
    body: safeBody
  };
  return envelope(result, env, context, { state: status === 429 ? "throttled" : status >= 400 ? "unavailable" : "fresh" });
}

async function manifestSearch(row: SessionRow, env: Env, context: RequestContext): Promise<Response> {
  requireDev(row, env);
  const query = (context.url.searchParams.get("q") || "").trim().toLowerCase();
  if (query.length < 2) throw httpError(400, "search_too_short", "Manifest search requires at least two characters.");
  const manifest = await loadManifest(env);
  const results = manifest.items.filter((item) => `${item.name} ${item.itemType} ${item.source}`.toLowerCase().includes(query)).slice(0, 50);
  return envelope({ query, manifestVersion: manifest.version, results }, env, context);
}

function requireDev(row: SessionRow, env: Env): void {
  if (!allowlist(env.DEV_MEMBERSHIP_IDS).has(row.membership_id)) throw httpError(403, "dev_access_forbidden", "Developer diagnostics are restricted.");
}

function required(value: string | undefined, name: string): string {
  if (!value) throw httpError(400, `${name}_required`, `${name} is required for this probe.`);
  return encodeURIComponent(value);
}

function transitoryWarning(profile: any): string[] {
  const transitory = profile?.profileTransitoryData?.data || profile?.profileTransitory?.data;
  return transitory?.currentActivity ? ["Current activity is Bungie transitory data and may be stale."] : [];
}

function sanitizeReturnTo(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/collection";
}

function base64Text(value: string): string {
  return btoa(unescape(encodeURIComponent(value))).replace(/=+$/, "");
}

function decodeText(value: string): string {
  try { return decodeURIComponent(escape(atob(value.padEnd(Math.ceil(value.length / 4) * 4, "=")))); } catch { return "/collection"; }
}
