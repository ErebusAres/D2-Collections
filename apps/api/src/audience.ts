import type { AudienceDetailData, AudienceMetrics, GuardianSummary } from "@guardian-nexus/contracts";
import { allowlist, cookie, parseCookies, randomToken, sha256 } from "./security";
import type { Env, RequestContext } from "./types";

const VISITOR_COOKIE = "gn_visitor";
const VISITOR_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 2;

export function validVisitorToken(value: string | undefined): value is string {
  return Boolean(value && /^[A-Za-z0-9_-]{20,128}$/.test(value));
}

export function canViewAudienceMetrics(membershipId: string, configuredMembershipIds: string | undefined): boolean {
  return allowlist(configuredMembershipIds).has(membershipId);
}

export async function recordAudienceVisitor(request: Request, env: Env, context: RequestContext): Promise<string | undefined> {
  if (validVisitorToken(parseCookies(request)[VISITOR_COOKIE])) return undefined;
  const token = randomToken(24);
  const visitorHash = await sha256(`${token}:guardian-nexus-audience:${env.OAUTH_ENCRYPTION_KEY}`);
  await env.DB.prepare("INSERT OR IGNORE INTO audience_visitors (visitor_hash) VALUES (?)").bind(visitorHash).run();
  return cookie(VISITOR_COOKIE, token, { maxAge: VISITOR_MAX_AGE_SECONDS, secure: context.url.protocol === "https:" });
}

export async function readAudienceMetrics(env: Env): Promise<AudienceMetrics> {
  const [visitors, logins] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS total, MIN(created_at) AS tracking_since FROM audience_visitors").first<{ total: number; tracking_since: string | null }>(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM users").first<{ total: number }>()
  ]);
  return {
    uniqueVisitors: Number(visitors?.total || 0),
    uniqueLogins: Number(logins?.total || 0),
    visitorsTrackingSince: visitors?.tracking_since || new Date().toISOString()
  };
}

export async function rememberAudienceGuardian(env: Env, guardian: GuardianSummary): Promise<void> {
  const selected = guardian.characters.find((character) => character.characterId === guardian.selectedCharacterId);
  const now = new Date();
  await env.DB.prepare(`UPDATE users SET last_profile_at = ?, last_character_class = ?, last_power = ?, last_guardian_rank = ?, last_rewards_pass_rank = ?, last_emblem_path = ?
    WHERE membership_id = ?`)
    .bind(now.toISOString(), selected?.className || null, guardian.stats.power, guardian.stats.guardianRank, guardian.stats.rewardsPassRank, selected?.emblemPath || null, guardian.membershipId).run();
}

export async function readAudienceDetails(env: Env): Promise<AudienceDetailData> {
  const [metrics, logins, visitors] = await Promise.all([
    readAudienceMetrics(env),
    env.DB.prepare(`SELECT membership_id, membership_type, display_name, bungie_name, created_at, updated_at,
      last_profile_at, last_character_class, last_power, last_guardian_rank, last_rewards_pass_rank, last_emblem_path
      FROM users ORDER BY updated_at DESC`).all<any>(),
    env.DB.prepare("SELECT substr(visitor_hash, 1, 12) AS visitor_id, created_at FROM audience_visitors ORDER BY created_at DESC LIMIT 500").all<any>()
  ]);
  return {
    ...metrics,
    logins: (logins.results || []).map((row: any) => ({
      membershipId: String(row.membership_id), membershipType: Number(row.membership_type), displayName: String(row.display_name), bungieName: String(row.bungie_name || ""),
      firstLoginAt: String(row.created_at), lastLoginAt: String(row.updated_at), lastProfileAt: row.last_profile_at || undefined,
      characterClass: row.last_character_class || undefined, power: row.last_power == null ? undefined : Number(row.last_power), guardianRank: row.last_guardian_rank == null ? undefined : Number(row.last_guardian_rank),
      rewardsPassRank: row.last_rewards_pass_rank == null ? undefined : Number(row.last_rewards_pass_rank), emblemPath: row.last_emblem_path || undefined
    })),
    visitors: (visitors.results || []).map((row: any) => ({ visitorId: String(row.visitor_id), firstSeenAt: String(row.created_at) }))
  };
}
