import type { CompactManifest } from "@guardian-nexus/contracts";
import type { Env, SessionRow } from "./types";
import { decrypt, encrypt, httpError } from "./security";

const API_ROOT = "https://www.bungie.net/Platform";
const TOKEN_URL = `${API_ROOT}/App/OAuth/Token/`;
let manifestCache: { value: CompactManifest; expiresAt: number } | null = null;

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
    throw httpError(response.status === 429 ? 429 : response.status || 502, response.status === 429 ? "bungie_throttled" : "bungie_request_failed", body.Message || "Bungie request failed.", throttle || undefined);
  }
  return body.Response;
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

export async function profileFor(row: SessionRow, env: Env): Promise<{ profile: any; accessToken: string }> {
  const accessToken = await accessTokenFor(row, env);
  const components = "100,102,103,104,200,201,202,204,205,301,800,900,1000,1200";
  const profile = await bungieGet(`/Destiny2/${row.membership_type}/Profile/${row.membership_id}/?components=${components}`, env, accessToken);
  return { profile, accessToken };
}

export async function loadManifest(env: Env): Promise<CompactManifest> {
  if (manifestCache && manifestCache.expiresAt > Date.now()) return manifestCache.value;
  try {
    const response = await fetch(env.GAME_DATA_URL, { cf: { cacheTtl: 300, cacheEverything: true } });
    if (!response.ok) throw new Error(`Manifest request returned ${response.status}.`);
    const value = await response.json() as CompactManifest;
    if (!value?.version || !Array.isArray(value.items)) throw new Error("Manifest artifact is invalid.");
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

export async function seasonPassRank(profile: any, accessToken: string, env: Env): Promise<number> {
  const hash = String(profile?.profile?.data?.currentSeasonPassHash || "");
  if (!hash) return 0;
  try {
    const definition = await bungieGet(`/Destiny2/Manifest/DestinySeasonPassDefinition/${encodeURIComponent(hash)}/?lc=en`, env, accessToken);
    const hashes = [definition?.rewardProgressionHash, definition?.prestigeProgressionHash].filter(Boolean).map(String);
    return hashes.reduce((total, progressionHash) => {
      const levels = Object.values(profile?.characterProgressions?.data || {}).map((component: any) => Number(component?.progressions?.[progressionHash]?.level || 0));
      return total + Math.max(0, ...levels);
    }, 0);
  } catch {
    return 0;
  }
}
