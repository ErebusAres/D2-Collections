import type { CompactManifest, FireteamContact, FireteamSocialData, GearManifest } from "@guardian-nexus/contracts";
import type { Env, SessionRow } from "./types";
import { decrypt, encrypt, httpError } from "./security";

const API_ROOT = "https://www.bungie.net/Platform";
const TOKEN_URL = `${API_ROOT}/App/OAuth/Token/`;
let manifestCache: { value: CompactManifest; expiresAt: number } | null = null;
let gearManifestCache: { value: GearManifest; expiresAt: number } | null = null;
let activityManifestCache: { value: CompactManifest; expiresAt: number } | null = null;
let questManifestCache: { value: CompactManifest; expiresAt: number } | null = null;
const emblemCache = new Map<string, { path?: string; expiresAt: number }>();
const publicProfileCache = new Map<string, { profile?: any; membershipType?: number; expiresAt: number }>();
const publicMembershipTypeCache = new Map<string, number>();
const xurInventoryCache = new Map<string, { state: "available" | "away" | "unavailable"; itemHashes: string[]; checkedAt: string; nextRefreshAt?: string; warning?: string; expiresAt: number }>();
const socialRosterCache = new Map<string, { value: FireteamSocialData; expiresAt: number }>();
const XUR_VENDOR_HASH = "2190858386";

export async function bungieGet(path: string, env: Env, accessToken?: string): Promise<any> {
  if (!env.BUNGIE_API_KEY) throw httpError(503, "bungie_api_unconfigured", "Bungie API access is not configured.");
  const response = await fetch(`${API_ROOT}${path}`, {
    headers: {
      "X-API-Key": env.BUNGIE_API_KEY,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    }
  });
  const body = await response.json().catch(() => ({})) as any;
  if (!response.ok || Number(body.ErrorCode || 1) > 1) {
    const throttle = Number(body.ThrottleSeconds || response.headers.get("Retry-After") || 0);
    const throttled = response.status === 429 || throttle > 0;
    const status = throttled ? 429 : response.ok ? 502 : response.status || 502;
    throw httpError(status, throttled ? "bungie_throttled" : "bungie_request_failed", body.Message || "Bungie request failed.", throttle || undefined);
  }
  return body.Response;
}

export async function bungiePost(path: string, bodyValue: unknown, env: Env, accessToken: string): Promise<any> {
  if (!env.BUNGIE_API_KEY) throw httpError(503, "bungie_api_unconfigured", "Bungie API access is not configured.");
  const response = await fetch(`${API_ROOT}${path}`, { method: "POST", headers: { "X-API-Key": env.BUNGIE_API_KEY, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(bodyValue) });
  const body = await response.json().catch(() => ({})) as any;
  if (!response.ok || Number(body.ErrorCode || 1) > 1) {
    const throttle = Number(body.ThrottleSeconds || response.headers.get("Retry-After") || 0);
    throw httpError(response.status === 429 || throttle > 0 ? 429 : response.status || 502, throttle ? "bungie_throttled" : String(body.ErrorStatus || "bungie_action_failed").toLowerCase(), body.Message || "Bungie item action failed.", throttle || undefined);
  }
  return body.Response;
}

export async function emblemPathFor(hash: string, env: Env): Promise<string | undefined> {
  if (!hash || hash === "0") return undefined;
  const cached = emblemCache.get(hash);
  if (cached && cached.expiresAt > Date.now()) return cached.path;
  try {
    const definition = await bungieGet(`/Destiny2/Manifest/DestinyInventoryItemDefinition/${encodeURIComponent(hash)}/?lc=en`, env);
    const icon = String(definition?.displayProperties?.icon || "");
    const path = icon ? (icon.startsWith("/") ? `https://www.bungie.net${icon}` : icon) : undefined;
    emblemCache.set(hash, { path, expiresAt: Date.now() + 6 * 60 * 60_000 });
    return path;
  } catch {
    emblemCache.set(hash, { expiresAt: Date.now() + 5 * 60_000 });
    return undefined;
  }
}

export function destinyDisplayName(userInfo: any): string | undefined {
  const name = String(userInfo?.bungieGlobalDisplayName || userInfo?.displayName || "").trim();
  if (!name) return undefined;
  const code = Number(userInfo?.bungieGlobalDisplayNameCode || 0);
  return code > 0 && !name.includes("#") ? `${name}#${String(code).padStart(4, "0")}` : name;
}

export async function publicProfileFor(
  membershipId: string,
  preferredMembershipType: number,
  env: Env,
  accessToken: string
): Promise<{ profile?: any; membershipType?: number; expiresAt: number }> {
  const cached = publicProfileCache.get(membershipId);
  if (cached && cached.expiresAt > Date.now()) return cached;
  const types = [...new Set([
    publicMembershipTypeCache.get(membershipId),
    preferredMembershipType,
    3,
    2,
    1,
    6
  ].filter((value): value is number => Number.isInteger(value) && Number(value) > 0))];
  for (const membershipType of types) {
    try {
      const profile = await bungieGet(`/Destiny2/${membershipType}/Profile/${membershipId}/?components=100,200,204`, env, accessToken);
      const userInfo = profile?.profile?.data?.userInfo;
      if (!userInfo || String(userInfo.membershipId || membershipId) !== membershipId) continue;
      publicMembershipTypeCache.set(membershipId, membershipType);
      const result = { profile, membershipType, expiresAt: Date.now() + 55_000 };
      publicProfileCache.set(membershipId, result);
      return result;
    } catch (error: any) {
      if (Number(error?.status) === 429) break;
    }
  }
  const unavailable = { expiresAt: Date.now() + 30_000 };
  publicProfileCache.set(membershipId, unavailable);
  return unavailable;
}

export async function xurInventoryFor(row: SessionRow, characterId: string, env: Env, accessToken: string): Promise<{
  state: "available" | "away" | "unavailable";
  itemHashes: string[];
  checkedAt: string;
  nextRefreshAt?: string;
  warning?: string;
}> {
  const cacheKey = `${row.membership_type}:${row.membership_id}:${characterId}`;
  const cached = xurInventoryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached;
  const checkedAt = new Date().toISOString();
  try {
    const response = await bungieGet(`/Destiny2/${row.membership_type}/Profile/${row.membership_id}/Character/${characterId}/Vendors/${XUR_VENDOR_HASH}/?components=400,402`, env, accessToken);
    const enabled = Boolean(response?.vendor?.data?.enabled);
    const itemHashes = enabled
      ? [...new Set(Object.values(response?.sales?.data || {}).map((sale: any) => String(sale?.itemHash || "")).filter(Boolean))]
      : [];
    const result = {
      state: enabled ? "available" as const : "away" as const,
      itemHashes,
      checkedAt,
      nextRefreshAt: response?.vendor?.data?.nextRefreshDate,
      expiresAt: Date.now() + 5 * 60_000
    };
    xurInventoryCache.set(cacheKey, result);
    return result;
  } catch (error: any) {
    const expectedAbsence = /vendor.*(not found|unavailable)|x[uû]r.*(not found|unavailable)/i.test(String(error?.message || ""));
    const result = {
      state: expectedAbsence ? "away" as const : "unavailable" as const,
      itemHashes: [],
      checkedAt,
      ...(expectedAbsence ? {} : { warning: "Xûr's live inventory could not be verified from Bungie." }),
      expiresAt: Date.now() + 2 * 60_000
    };
    xurInventoryCache.set(cacheKey, result);
    return result;
  }
}

export async function exchangeCode(code: string, env: Env): Promise<any> {
  return tokenRequest({ grant_type: "authorization_code", code }, env);
}

async function tokenRequest(fields: Record<string, string>, env: Env): Promise<any> {
  if (!env.BUNGIE_CLIENT_SECRET) throw httpError(503, "oauth_unconfigured", "Bungie OAuth is not configured.");
  const body = new URLSearchParams(fields);
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${env.BUNGIE_CLIENT_ID}:${env.BUNGIE_CLIENT_SECRET}`)}`
    },
    body
  });
  const data = await response.json().catch(() => ({})) as any;
  if (!response.ok || !data.access_token) throw httpError(401, "bungie_oauth_failed", data.error_description || data.error || "Bungie authorization failed.");
  return data;
}

export async function accessTokenFor(row: SessionRow, env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (row.access_expires_at > now + 120) return decrypt(row.access_token_cipher, env.OAUTH_ENCRYPTION_KEY);
  const refreshToken = await decrypt(row.refresh_token_cipher, env.OAUTH_ENCRYPTION_KEY);
  let token: any;
  try {
    token = await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken }, env);
  } catch (error) {
    await env.DB.prepare("DELETE FROM oauth_sessions WHERE session_hash = ?").bind(row.session_hash).run();
    throw error;
  }
  const accessExpiresAt = now + Number(token.expires_in || 3600);
  const refreshExpiresAt = token.refresh_expires_in ? now + Number(token.refresh_expires_in) : row.refresh_expires_at;
  await env.DB.prepare(`
    UPDATE oauth_sessions SET access_token_cipher = ?, refresh_token_cipher = ?, access_expires_at = ?, refresh_expires_at = ?, updated_at = ?
    WHERE session_hash = ?
  `).bind(
    await encrypt(token.access_token, env.OAUTH_ENCRYPTION_KEY),
    await encrypt(token.refresh_token || refreshToken, env.OAUTH_ENCRYPTION_KEY),
    accessExpiresAt,
    refreshExpiresAt,
    new Date().toISOString(),
    row.session_hash
  ).run();
  row.access_token_cipher = await encrypt(token.access_token, env.OAUTH_ENCRYPTION_KEY);
  row.access_expires_at = accessExpiresAt;
  row.refresh_expires_at = refreshExpiresAt;
  return token.access_token;
}

export async function membershipsFor(accessToken: string, env: Env): Promise<any> {
  return bungieGet("/User/GetMembershipsForCurrentUser/", env, accessToken);
}

export function primaryMembership(memberships: any): any {
  const entries = memberships?.destinyMemberships || [];
  return entries.find((entry: any) => String(entry.membershipId) === String(memberships?.primaryMembershipId))
    || entries.find((entry: any) => Number(entry.crossSaveOverride || 0) === Number(entry.membershipType))
    || entries[0];
}

export async function profileFor(row: SessionRow, env: Env, mode: "full" | "session" | "gear" = "full"): Promise<{ profile: any; accessToken: string }> {
  const accessToken = await accessTokenFor(row, env);
  const components = mode === "session"
    ? "100,200,202,204,1000"
    : `100,102,103,104,200,201,202,204,205,300,301,304,305,307${mode === "gear" ? ",310" : ""},800,900,1000,1200`;
  const profile = await bungieGet(`/Destiny2/${row.membership_type}/Profile/${row.membership_id}/?components=${components}`, env, accessToken);
  return { profile, accessToken };
}

export async function loadActivityManifest(env: Env): Promise<CompactManifest> {
  if (activityManifestCache && activityManifestCache.expiresAt > Date.now()) return activityManifestCache.value;
  const url = env.GAME_DATA_URL.replace(/manifest\.json(?:\?.*)?$/, "activity-manifest.json");
  try {
    const response = await fetch(url, { cf: { cacheTtl: 300, cacheEverything: true } });
    if (!response.ok) throw new Error(`Activity manifest request returned ${response.status}.`);
    const value = await response.json() as CompactManifest;
    if (!value?.version || !value.activityDefinitions) throw new Error("Activity manifest artifact is invalid.");
    activityManifestCache = { value, expiresAt: Date.now() + 300_000 };
    return value;
  } catch {
    return { version: "unavailable", generatedAt: new Date().toISOString(), items: [], itemDefinitions: {}, objectiveDefinitions: {}, activityDefinitions: {}, recordDefinitions: {} };
  }
}

export async function loadManifest(env: Env): Promise<CompactManifest> {
  if (manifestCache && manifestCache.expiresAt > Date.now()) return manifestCache.value;
  try {
    const response = await fetch(env.GAME_DATA_URL, { cf: { cacheTtl: 300, cacheEverything: true } });
    if (!response.ok) throw new Error(`Manifest request returned ${response.status}.`);
    const value = await response.json() as CompactManifest;
    if (!value?.version || !Array.isArray(value.items)) throw new Error("Manifest artifact is invalid.");
    try {
      const featureResponse = await fetch(env.GAME_DATA_URL.replace(/manifest\.json(?:\?.*)?$/, "collection-features.json"), { cf: { cacheTtl: 300, cacheEverything: true } });
      const featureValue = featureResponse.ok ? await featureResponse.json() as any : undefined;
      value.collectionFeatureDefinitions = featureValue?.version === value.version ? featureValue.collectionFeatureDefinitions || {} : {};
    } catch { value.collectionFeatureDefinitions = {}; }
    manifestCache = { value, expiresAt: Date.now() + 300_000 };
    return value;
  } catch {
    return {
      version: "unavailable",
      generatedAt: new Date().toISOString(),
      items: [],
      itemDefinitions: {},
      objectiveDefinitions: {},
      activityDefinitions: {},
      recordDefinitions: {}
    };
  }
}

export async function loadQuestManifest(env: Env): Promise<CompactManifest> {
  if (questManifestCache && questManifestCache.expiresAt > Date.now()) return questManifestCache.value;
  const base = await loadManifest(env);
  try {
    const response = await fetch(env.GAME_DATA_URL.replace(/manifest\.json(?:\?.*)?$/, "pursuit-manifest.json"), { cf: { cacheTtl: 300, cacheEverything: true } });
    if (!response.ok) throw new Error(`Pursuit manifest returned ${response.status}.`);
    const overlay = await response.json() as any;
    if (overlay?.version !== base.version) throw new Error("Pursuit manifest version does not match.");
    const value: CompactManifest = {
      ...base,
      itemDefinitions: { ...base.itemDefinitions, ...(overlay.itemDefinitions || {}) },
      objectiveDefinitions: { ...base.objectiveDefinitions, ...(overlay.objectiveDefinitions || {}) }
    };
    questManifestCache = { value, expiresAt: Date.now() + 300_000 };
    return value;
  } catch {
    questManifestCache = { value: base, expiresAt: Date.now() + 60_000 };
    return base;
  }
}

export async function loadGearManifest(env: Env): Promise<GearManifest> {
  if (gearManifestCache && gearManifestCache.expiresAt > Date.now()) return gearManifestCache.value;
  const url = env.GAME_DATA_URL.replace(/manifest\.json(?:\?.*)?$/, "gear-manifest.json");
  try {
    const response = await fetch(url, { cf: { cacheTtl: 300, cacheEverything: true } });
    if (!response.ok) throw new Error(`Gear manifest request returned ${response.status}.`);
    const value = await response.json() as GearManifest;
    if (!value?.version || !value.gearItemDefinitions || !value.plugDefinitions) throw new Error("Gear manifest artifact is invalid.");
    gearManifestCache = { value, expiresAt: Date.now() + 300_000 };
    return value;
  } catch {
    return { version: "unavailable", generatedAt: new Date().toISOString(), gearItemDefinitions: {}, plugDefinitions: {}, statDefinitions: {} };
  }
}

export async function seasonPassProgress(profile: any, accessToken: string, env: Env): Promise<{
  rank: number;
  progress: number;
  nextLevelAt: number;
  percent: number;
}> {
  const hash = String(profile?.profile?.data?.currentSeasonPassHash || "");
  if (!hash) return { rank: 0, progress: 0, nextLevelAt: 0, percent: 0 };
  try {
    const definition = await bungieGet(`/Destiny2/Manifest/DestinySeasonPassDefinition/${encodeURIComponent(hash)}/?lc=en`, env, accessToken);
    const hashes = [definition?.rewardProgressionHash, definition?.prestigeProgressionHash].filter(Boolean).map(String);
    const progressions = hashes.map((progressionHash) => {
      const rows = Object.values(profile?.characterProgressions?.data || {})
        .map((component: any) => component?.progressions?.[progressionHash])
        .filter(Boolean);
      return rows.sort((a: any, b: any) => Number(b?.level || 0) - Number(a?.level || 0) || Number(b?.progressToNextLevel || 0) - Number(a?.progressToNextLevel || 0))[0];
    }).filter(Boolean);
    const rank = progressions.reduce((total: number, progression: any) => total + Math.max(0, Number(progression?.level || 0)), 0);
    const active = [...progressions].reverse().find((progression: any) => Number(progression?.nextLevelAt || 0) > 0) || progressions[0];
    const progress = Math.max(0, Number(active?.progressToNextLevel || 0));
    const nextLevelAt = Math.max(0, Number(active?.nextLevelAt || 0));
    return { rank, progress, nextLevelAt, percent: nextLevelAt ? Math.max(0, Math.min(100, Math.round((progress / nextLevelAt) * 100))) : 0 };
  } catch {
    return { rank: 0, progress: 0, nextLevelAt: 0, percent: 0 };
  }
}

export async function socialRosterFor(row: SessionRow, accessToken: string, env: Env): Promise<FireteamSocialData> {
  const cached = socialRosterCache.get(row.membership_id);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const contacts = new Map<string, FireteamContact>();
  let friendsAvailable = false;
  let clanAvailable = false;
  let reauthorizationRequired = false;

  try {
    const response = await bungieGet("/Social/Friends/", env, accessToken);
    friendsAvailable = true;
    for (const friend of response?.friends || []) {
      const membershipId = String(friend?.lastSeenAsMembershipId || "");
      const name = destinyDisplayName(friend) || destinyDisplayName(friend?.bungieNetUser) || "Bungie friend";
      if (!membershipId && !name) continue;
      const key = membershipId || name.toLocaleLowerCase();
      contacts.set(key, {
        membershipId,
        membershipType: Number(friend?.lastSeenAsBungieMembershipType || 0) || undefined,
        displayName: name,
        source: "friend",
        onlineState: Number(friend?.onlineStatus || 0) === 1 ? "online" : "offline",
        inDestiny2: (Number(friend?.onlineTitle || 0) & 2) !== 0
      });
    }
  } catch (error: any) {
    reauthorizationRequired = Number(error?.status || 0) === 401 || Number(error?.status || 0) === 403 || /scope|permission|authorization/i.test(String(error?.message || ""));
  }

  try {
    const groups = await bungieGet(`/GroupV2/User/${row.membership_type}/${row.membership_id}/0/1/`, env, accessToken);
    const membership = (groups?.results || [])[0];
    const groupId = String(membership?.group?.groupId || "");
    const clanName = String(membership?.group?.name || membership?.group?.about || "Clan").trim();
    if (groupId) {
      const response = await bungieGet(`/GroupV2/${groupId}/Members/?currentpage=1`, env, accessToken);
      clanAvailable = true;
      for (const member of response?.results || []) {
        const user = member?.destinyUserInfo || member?.bungieNetUserInfo || {};
        const membershipId = String(user?.membershipId || "");
        const name = destinyDisplayName(user) || "Clan member";
        if (!membershipId || membershipId === row.membership_id) continue;
        const existing = contacts.get(membershipId);
        contacts.set(membershipId, {
          membershipId,
          membershipType: Number(user?.membershipType || 0) || existing?.membershipType,
          displayName: existing?.displayName || name,
          source: existing ? "friend-and-clan" : "clan",
          clanName,
          onlineState: existing?.onlineState || (typeof member?.isOnline === "boolean" ? member.isOnline ? "online" : "offline" : "unknown"),
          inDestiny2: existing?.inDestiny2 || false
        });
      }
    }
  } catch {
    clanAvailable = false;
  }

  const available = friendsAvailable || clanAvailable;
  const value: FireteamSocialData = {
    state: available ? "available" : reauthorizationRequired ? "reauthorization-required" : "unavailable",
    contacts: [...contacts.values()].sort((a, b) => socialOrder(a) - socialOrder(b) || a.displayName.localeCompare(b.displayName)),
    ...(!friendsAvailable && reauthorizationRequired
      ? { warning: "Bungie friends require the ReadUserData app permission and a fresh authorization." }
      : !available ? { warning: "Bungie friends and clan presence are temporarily unavailable." } : {})
  };
  socialRosterCache.set(row.membership_id, { value, expiresAt: Date.now() + 2 * 60_000 });
  return value;
}

function socialOrder(contact: FireteamContact): number {
  if (contact.onlineState === "online" && contact.inDestiny2) return 0;
  if (contact.onlineState === "online") return 1;
  if (contact.onlineState === "unknown") return 2;
  return 3;
}
