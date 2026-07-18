import type { CompactManifest, CompanionManifest, FireteamContact, FireteamSocialData, GearManifest, RewardsManifest, RewardsPassProgress } from "@guardian-nexus/contracts";
import type { Env, SessionRow } from "./types";
import { decrypt, encrypt, httpError } from "./security";
import { imageUrl } from "@guardian-nexus/domain";

const API_ROOT = "https://www.bungie.net/Platform";
const TOKEN_URL = `${API_ROOT}/App/OAuth/Token/`;
let manifestCache: { value: CompactManifest; expiresAt: number } | null = null;
let gearManifestCache: { value: GearManifest; expiresAt: number } | null = null;
let activityManifestCache: { value: CompactManifest; expiresAt: number } | null = null;
let questManifestCache: { value: CompactManifest; expiresAt: number } | null = null;
let rewardsManifestCache: { value: RewardsManifest; expiresAt: number } | null = null;
let rewardCodeManifestCache: { value: RewardCodeManifest; expiresAt: number } | null = null;
let companionManifestCache: { value: CompanionManifest; expiresAt: number } | null = null;
const companionDefinitionCache = new Map<string, { value: Record<string, unknown>; expiresAt: number }>();
const emblemCache = new Map<string, { path?: string; expiresAt: number }>();
const publicProfileCache = new Map<string, { profile?: any; membershipType?: number; expiresAt: number }>();
const publicMembershipTypeCache = new Map<string, number>();
const xurInventoryCache = new Map<string, { state: "available" | "away" | "unavailable"; itemHashes: string[]; offers?: any[]; checkedAt: string; nextRefreshAt?: string; warning?: string; expiresAt: number }>();
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

export async function xurInventoryFor(row: SessionRow, characterId: string, env: Env, accessToken: string, includeDetails = false): Promise<{
  state: "available" | "away" | "unavailable";
  itemHashes: string[];
  checkedAt: string;
  nextRefreshAt?: string;
  warning?: string;
  offers?: any[];
}> {
  const cacheKey = `${row.membership_type}:${row.membership_id}:${characterId}:${includeDetails ? "details" : "hashes"}`;
  const cached = xurInventoryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached;
  const checkedAt = new Date().toISOString();
  try {
    const response = await bungieGet(`/Destiny2/${row.membership_type}/Profile/${row.membership_id}/Character/${characterId}/Vendors/${XUR_VENDOR_HASH}/?components=400,402`, env, accessToken);
    const enabled = Boolean(response?.vendor?.data?.enabled);
    const sales = enabled ? Object.entries(response?.sales?.data || {}) as Array<[string, any]> : [];
    const itemHashes = enabled
      ? [...new Set(sales.map(([, sale]) => String(sale?.itemHash || "")).filter(Boolean))]
      : [];
    let offers: any[] | undefined;
    if (enabled && includeDetails) {
      const [definitions, exoticManifest] = await Promise.all([companionItemDefinitionsFor(env, itemHashes), loadManifest(env)]);
      const classes = ["Titan", "Hunter", "Warlock"] as const;
      offers = sales.flatMap(([saleIndex, sale]) => {
        const hash = String(sale?.itemHash || "");
        const definition: any = definitions[hash];
        if (!hash || !definition) return [];
        const rarity = String(definition.inventory?.tierTypeName || "Unknown");
        const itemType = Number(definition.itemType);
        const category = rarity === "Exotic" && itemType === 3 ? "exotic-weapon" : rarity === "Exotic" && itemType === 2 ? "exotic-armor" : itemType === 3 ? "legendary-weapon" : itemType === 2 ? "legendary-armor" : "other";
        const classType = Number(definition.classType ?? (exoticManifest.itemDefinitions[hash] as any)?.classType);
        return [{
          saleIndex, itemHash: hash, name: String(definition.displayProperties?.name || "Unknown offer"), description: String(definition.displayProperties?.description || ""),
          icon: imageUrl(definition.displayProperties?.icon), rarity, itemType: String(definition.itemTypeDisplayName || "Vendor item"), slot: String(definition.equipmentSlot || "Miscellaneous"),
          ...(classType >= 0 && classType <= 2 ? { className: classes[classType] } : {}), quantity: Math.max(1, Number(sale?.quantity || 1)), category
        }];
      });
    }
    const result = {
      state: enabled ? "available" as const : "away" as const,
      itemHashes,
      ...(offers ? { offers } : {}),
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

export async function profileFor(row: SessionRow, env: Env, mode: "full" | "session" | "gear" | "mailbox" | "loadouts" | "collectibles" = "full"): Promise<{ profile: any; accessToken: string }> {
  const accessToken = await accessTokenFor(row, env);
  const components = mode === "session"
    ? "100,200,201,202,204,1000"
    : mode === "mailbox"
      ? "100,200,201"
      : mode === "loadouts"
        ? "100,102,200,201,205,206"
        : mode === "collectibles"
          ? "100,200,800"
    : `100,102,103,104,200,201,202,204,205,300,301,304,305,307${mode === "gear" ? ",310" : ""},800,900,1000,1200`;
  const profile = await bungieGet(`/Destiny2/${row.membership_type}/Profile/${row.membership_id}/?components=${components}`, env, accessToken);
  return { profile, accessToken };
}

export async function loadCompanionManifest(env: Env): Promise<CompanionManifest> {
  if (companionManifestCache && companionManifestCache.expiresAt > Date.now()) return companionManifestCache.value;
  const url = env.GAME_DATA_URL.replace(/manifest\.json(?:\?.*)?$/, "companion-manifest.json");
  try {
    const response = await fetch(url, { cf: { cacheTtl: 300, cacheEverything: true } });
    if (!response.ok) throw new Error(`Companion manifest request returned ${response.status}.`);
    const index = await response.json() as CompanionManifest;
    if (!index?.version || !index.itemDefinitions || !index.bucketDefinitions) throw new Error("Companion manifest artifact is invalid.");
    const chunks = await Promise.all((index.itemDefinitionChunks || []).map(async (path) => {
      const chunkResponse = await fetch(new URL(path, url).toString(), { cf: { cacheTtl: 300, cacheEverything: true } });
      if (!chunkResponse.ok) throw new Error(`Companion manifest chunk request returned ${chunkResponse.status}.`);
      const chunk = await chunkResponse.json() as Pick<CompanionManifest, "itemDefinitions">;
      if (!chunk?.itemDefinitions) throw new Error("Companion manifest chunk is invalid.");
      return chunk.itemDefinitions;
    }));
    const value = { ...index, itemDefinitions: Object.assign({}, index.itemDefinitions, ...chunks) };
    companionManifestCache = { value, expiresAt: Date.now() + 300_000 };
    return value;
  } catch {
    return {
      version: "unavailable",
      generatedAt: new Date().toISOString(),
      itemDefinitions: {},
      bucketDefinitions: {},
      loadoutNameDefinitions: {},
      loadoutIconDefinitions: {},
      loadoutColorDefinitions: {}
    };
  }
}

async function companionItemDefinitionsFor(env: Env, itemHashes: string[]): Promise<Record<string, Record<string, unknown>>> {
  const now = Date.now();
  const output: Record<string, Record<string, unknown>> = {};
  const missing = itemHashes.filter((hash) => {
    const cached = companionDefinitionCache.get(hash);
    if (cached && cached.expiresAt > now) { output[hash] = cached.value; return false; }
    return true;
  });
  if (!missing.length) return output;
  const url = env.GAME_DATA_URL.replace(/manifest\.json(?:\?.*)?$/, "companion-manifest.json");
  const response = await fetch(url, { cf: { cacheTtl: 300, cacheEverything: true } });
  if (!response.ok) throw new Error(`Companion manifest request returned ${response.status}.`);
  const index = await response.json() as CompanionManifest;
  const chunks = index.itemDefinitionChunks || [];
  if (!chunks.length) return { ...output, ...index.itemDefinitions };
  const wanted = new Set(missing);
  const chunkIndexes = [...new Set(missing.map((hash) => Number(hash) % chunks.length))];
  for (const chunkIndex of chunkIndexes) {
    const chunkResponse = await fetch(new URL(chunks[chunkIndex]!, url).toString(), { cf: { cacheTtl: 300, cacheEverything: true } });
    if (!chunkResponse.ok) continue;
    const chunk = await chunkResponse.json() as Pick<CompanionManifest, "itemDefinitions">;
    for (const [hash, definition] of Object.entries(chunk.itemDefinitions || {})) {
      if (!wanted.has(hash)) continue;
      output[hash] = definition;
      companionDefinitionCache.set(hash, { value: definition, expiresAt: now + 300_000 });
    }
  }
  return output;
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

export async function loadRewardsManifest(env: Env): Promise<RewardsManifest> {
  if (rewardsManifestCache && rewardsManifestCache.expiresAt > Date.now()) return rewardsManifestCache.value;
  const url = env.GAME_DATA_URL.replace(/manifest\.json(?:\?.*)?$/, "rewards-manifest.json");
  try {
    const response = await fetch(url, { cf: { cacheTtl: 300, cacheEverything: true } });
    if (!response.ok) throw new Error(`Rewards manifest request returned ${response.status}.`);
    const value = await response.json() as RewardsManifest;
    if (!value?.version || !value.seasonPassDefinitions || !value.progressionDefinitions || !value.itemDefinitions) throw new Error("Rewards manifest artifact is invalid.");
    rewardsManifestCache = { value, expiresAt: Date.now() + 300_000 };
    return value;
  } catch {
    return { version: "unavailable", generatedAt: new Date().toISOString(), seasonPassDefinitions: {}, progressionDefinitions: {}, itemDefinitions: {} };
  }
}

export interface RewardCodeManifest {
  version: string;
  generatedAt: string;
  definitions: Record<string, {
    reward: string;
    items: Array<{ itemHash: string; collectibleHash: string; name: string; icon: string; itemType: string }>;
  }>;
}

export async function loadRewardCodeManifest(env: Env): Promise<RewardCodeManifest> {
  if (rewardCodeManifestCache && rewardCodeManifestCache.expiresAt > Date.now()) return rewardCodeManifestCache.value;
  const url = env.GAME_DATA_URL.replace(/manifest\.json(?:\?.*)?$/, "reward-code-manifest.json");
  try {
    const response = await fetch(url, { cf: { cacheTtl: 300, cacheEverything: true } });
    if (!response.ok) throw new Error(`Reward-code manifest request returned ${response.status}.`);
    const value = await response.json() as RewardCodeManifest;
    if (!value?.version || !value.definitions) throw new Error("Reward-code manifest artifact is invalid.");
    rewardCodeManifestCache = { value, expiresAt: Date.now() + 300_000 };
    return value;
  } catch {
    return { version: "unavailable", generatedAt: new Date().toISOString(), definitions: {} };
  }
}

interface SeasonPassSnapshot {
  rank: number;
  progress: RewardsPassProgress;
}

export async function seasonPassProgress(profile: any, accessToken: string, env: Env, characterId?: string): Promise<SeasonPassSnapshot> {
  const hash = String(profile?.profile?.data?.currentSeasonPassHash || "");
  const unavailable = (reason: string): SeasonPassSnapshot => ({
    rank: 0,
    progress: { state: "unavailable", source: "bungie-profile-character-progressions", ...(hash ? { passHash: hash } : {}), reason }
  });
  if (!hash) return unavailable("Bungie did not include currentSeasonPassHash in the profile component.");
  if (profile?.characterProgressions?.disabled) return unavailable("Bungie marked characterProgressions (component 202) as disabled for this profile.");
  if (!profile?.characterProgressions?.data) return unavailable("Bungie did not return characterProgressions (component 202). Check Destiny data permissions and profile privacy.");
  try {
    const definition = await bungieGet(`/Destiny2/Manifest/DestinySeasonPassDefinition/${encodeURIComponent(hash)}/?lc=en`, env, accessToken);
    const rewardProgressionHash = String(definition?.rewardProgressionHash || "");
    const prestigeProgressionHash = String(definition?.prestigeProgressionHash || "");
    const hashes = [rewardProgressionHash, prestigeProgressionHash].filter((value) => value && value !== "0");
    if (!hashes.length) return unavailable("The current DestinySeasonPassDefinition did not identify a reward progression.");
    const progressionRows = hashes.map((progressionHash) => {
      const selected = characterId ? profile.characterProgressions.data?.[characterId]?.progressions?.[progressionHash] : undefined;
      const rows = selected ? [selected] : Object.values(profile.characterProgressions.data || {})
        .map((component: any) => component?.progressions?.[progressionHash])
        .filter(Boolean)
        .sort((a: any, b: any) => Number(b?.level || 0) - Number(a?.level || 0) || Number(b?.progressToNextLevel || 0) - Number(a?.progressToNextLevel || 0));
      return rows[0] ? { hash: progressionHash, value: rows[0] } : undefined;
    }).filter((entry): entry is { hash: string; value: any } => Boolean(entry));
    if (!progressionRows.length) return unavailable("Bungie's characterProgressions component did not contain the current Rewards Pass progression.");
    const rank = progressionRows.reduce((total, entry) => total + Math.max(0, Number(entry.value?.level || 0)), 0);
    const rewardProgression = progressionRows.find((entry) => entry.hash === rewardProgressionHash);
    const prestigeProgression = progressionRows.find((entry) => entry.hash === prestigeProgressionHash);
    const rewardLevel = Math.max(0, Number(rewardProgression?.value?.level || 0));
    const rewardLevelCap = Math.max(0, Number(rewardProgression?.value?.levelCap || 0));
    const rewardTrackComplete = Boolean(rewardProgression) && (
      Number(rewardProgression?.value?.nextLevelAt || 0) <= 0
      || (rewardLevelCap > 0 && rewardLevel >= rewardLevelCap)
    );
    const active = rewardTrackComplete && prestigeProgression && Number(prestigeProgression.value?.nextLevelAt || 0) > 0
      ? prestigeProgression
      : rewardProgression && Number(rewardProgression.value?.nextLevelAt || 0) > 0
        ? rewardProgression
        : progressionRows.find((entry) => Number(entry.value?.nextLevelAt || 0) > 0) || progressionRows[0]!;
    const progressToNextLevel = Math.max(0, Number(active.value?.progressToNextLevel || 0));
    const nextLevelAt = Math.max(0, Number(active.value?.nextLevelAt || 0));
    const currentProgress = Math.max(0, Number(active.value?.currentProgress || 0));
    const base = {
      source: "bungie-profile-character-progressions" as const,
      passHash: hash,
      rewardProgressionHash: rewardProgressionHash || undefined,
      prestigeProgressionHash: prestigeProgressionHash || undefined,
      activeProgressionHash: active.hash,
      currentProgress,
      progressToNextLevel,
      nextLevelAt: nextLevelAt || undefined,
      percent: nextLevelAt ? Math.max(0, Math.min(100, Math.round((progressToNextLevel / nextLevelAt) * 100))) : undefined
    };
    return nextLevelAt
      ? { rank, progress: { ...base, state: "available" } }
      : { rank, progress: { ...base, state: "partial", reason: "Bungie returned the Rewards Pass rank but no nextLevelAt XP threshold." } };
  } catch (error: any) {
    return unavailable(`The current DestinySeasonPassDefinition could not be loaded: ${String(error?.message || "Bungie request failed.")}`);
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
        onlineState: Number(friend?.onlineStatus || 0) === 1 ? "online" : "unknown",
        inDestiny2: (Number(friend?.onlineTitle || 0) & 2) !== 0
      });
    }
  } catch (error: any) {
    reauthorizationRequired = Number(error?.status || 0) === 401 || Number(error?.status || 0) === 403 || /scope|permission|authorization/i.test(String(error?.message || ""));
  }

  try {
    const groups = await bungieGet(`/GroupV2/User/${row.membership_type}/${row.membership_id}/0/1/`, env, accessToken);
    for (const membership of groups?.results || []) {
      const groupId = String(membership?.group?.groupId || "");
      const clanName = String(membership?.group?.name || membership?.group?.about || "Clan").trim();
      if (!groupId) continue;
      for (let page = 1; page <= 20; page += 1) {
        const response = await bungieGet(`/GroupV2/${groupId}/Members/?currentpage=${page}`, env, accessToken);
        clanAvailable = true;
        for (const member of response?.results || []) {
          const user = member?.destinyUserInfo || member?.bungieNetUserInfo || {};
          const membershipId = String(user?.membershipId || "");
          const name = destinyDisplayName(user) || "Clan member";
          if (!membershipId || membershipId === row.membership_id) continue;
          const existing = contacts.get(membershipId);
          const clanOnlineState = typeof member?.isOnline === "boolean" ? member.isOnline ? "online" : "offline" : "unknown";
          contacts.set(membershipId, {
            membershipId,
            membershipType: Number(user?.membershipType || 0) || existing?.membershipType,
            displayName: existing?.displayName || name,
            source: existing?.source === "friend" || existing?.source === "friend-and-clan" ? "friend-and-clan" : "clan",
            clanName: mergeClanNames(existing?.clanName, clanName),
            onlineState: existing?.onlineState === "online" || clanOnlineState === "online"
              ? "online"
              : existing?.onlineState === "offline" || clanOnlineState === "offline"
                ? "offline"
                : "unknown",
            inDestiny2: existing?.inDestiny2 || false
          });
        }
        if (!response?.hasMore) break;
      }
    }
  } catch {
    clanAvailable = false;
  }

  const available = friendsAvailable || clanAvailable;
  const value: FireteamSocialData = {
    state: available ? "available" : reauthorizationRequired ? "reauthorization-required" : "unavailable",
    friendsState: friendsAvailable ? "available" : reauthorizationRequired ? "reauthorization-required" : "unavailable",
    clanState: clanAvailable ? "available" : "unavailable",
    contacts: [...contacts.values()].sort((a, b) => socialOrder(a) - socialOrder(b) || a.displayName.localeCompare(b.displayName)),
    ...(!friendsAvailable && reauthorizationRequired
      ? { warning: "Bungie friends require the ReadUserData app permission and a fresh authorization." }
      : !available ? { warning: "Bungie friends and clan presence are temporarily unavailable." } : {})
  };
  socialRosterCache.set(row.membership_id, { value, expiresAt: Date.now() + 2 * 60_000 });
  return value;
}

function mergeClanNames(existing: string | undefined, next: string): string {
  return [...new Set([...(existing || "").split(" · "), next].filter(Boolean))].join(" · ");
}

function socialOrder(contact: FireteamContact): number {
  if (contact.onlineState === "online" && contact.inDestiny2) return 0;
  if (contact.onlineState === "online") return 1;
  if (contact.onlineState === "unknown") return 2;
  return 3;
}
