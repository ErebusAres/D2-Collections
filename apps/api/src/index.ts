import type {
  ApiEnvelope,
  CollectionData,
  DevProbeKey,
  DevProbeResult,
  FireteamData,
  FireteamMember,
  FireteamSharingMode,
  MatrixData,
  MatrixSnapshot,
  QuestData,
  SessionData
} from "@guardian-nexus/contracts";
import { z } from "zod";
import { accessTokenFor, bungieGet, exchangeCode, loadManifest, membershipsFor, primaryMembership, profileFor, seasonPassRank } from "./bungie";
import { activityName, charactersFromProfile, normalizeCollection, normalizeGuardian, normalizeQuests, selectedCharacter } from "./normalize";
import { allowlist, cookie, csrfToken, encrypt, httpError, parseCookies, randomToken, redact, requireCsrf, sessionFromRequest, sha256 } from "./security";
import type { Env, RequestContext, SessionRow } from "./types";

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
  const { profile } = await profileFor(row, env);
  const manifest = await loadManifest(env);
  const character = selectedCharacter(charactersFromProfile(profile), context.url.searchParams.get("characterId") || undefined);
  const data = normalizeCollection(profile, manifest, character?.className || "Unknown");
  const warnings = manifest.version === "unavailable" ? ["Current manifest data is unavailable; run the manifest sync before production deployment."] : [];
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
  const { profile } = await profileFor(row, env);
  const manifest = await loadManifest(env);
  const transitory = profile?.profileTransitoryData?.data || profile?.profileTransitory?.data || {};
  const now = new Date().toISOString();
  const { results = [] } = await env.DB.prepare("SELECT membership_id, display_name, updated_at, expires_at, payload_json, sharing_mode, last_error FROM fireteam_shares WHERE sharing_mode = 'persistent' OR expires_at > ?").bind(now).all<any>();
  const shares = new Map(results.map((result: any) => [String(result.membership_id), result]));
  const party = (transitory.partyMembers || []).map((member: any) => ({
    membershipId: String(member.membershipId || member.destinyMembershipId || ""),
    displayName: member.displayName || member.bungieGlobalDisplayName || "Fireteam member"
  })).filter((member: any) => member.membershipId);
  if (!party.some((member: any) => member.membershipId === row.membership_id)) party.unshift({ membershipId: row.membership_id, displayName: row.display_name });
  const questCounts = new Map<string, number>();
  for (const member of party) {
    const share: any = shares.get(member.membershipId);
    const payload = share ? JSON.parse(share.payload_json) : null;
    for (const quest of payload?.quests || []) questCounts.set(String(quest.itemHash), (questCounts.get(String(quest.itemHash)) || 0) + 1);
  }
  const members: FireteamMember[] = party.map((member: any) => {
    const share: any = shares.get(member.membershipId);
    const payload = share ? JSON.parse(share.payload_json) : null;
    const memberQuests = payload?.quests || [];
    return {
      membershipId: member.membershipId,
      displayName: member.displayName,
      character: payload?.character,
      activity: payload?.activity,
      isSelf: member.membershipId === row.membership_id,
      sharing: Boolean(share),
      sharingMode: share?.sharing_mode,
      expiresAt: share?.sharing_mode === "temporary" ? share?.expires_at : undefined,
      quests: memberQuests,
      overlaps: memberQuests.filter((quest: any) => (questCounts.get(String(quest.itemHash)) || 0) > 1).map((quest: any) => quest.name),
      freshness: {
        state: share ? (Date.now() - Date.parse(share.updated_at) > 15 * 60_000 ? "stale" : "fresh") : "privacy-limited",
        observedAt: share?.updated_at || now,
        ageSeconds: share ? Math.max(0, Math.round((Date.now() - Date.parse(share.updated_at)) / 1000)) : 0
      }
    };
  });
  const ownShare = shares.get(row.membership_id);
  const data: FireteamData = { sharingEnabled: Boolean(ownShare), sharingMode: ownShare?.sharing_mode || "off", sharingExpiresAt: ownShare?.sharing_mode === "temporary" ? ownShare.expires_at : undefined, activity: activityName(profile, manifest), members };
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
