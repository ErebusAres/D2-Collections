import type { AudienceDetailData, AudienceMetrics, GuardianNotification, GuardianSummary } from "@guardian-nexus/contracts";
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
    env.DB.prepare("SELECT COUNT(*) AS total FROM users WHERE audience_removed_at IS NULL").first<{ total: number }>()
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
  const previous = await env.DB.prepare(`
    SELECT last_guardian_rank, last_rewards_pass_rank FROM users WHERE membership_id = ?
  `).bind(guardian.membershipId).first<{ last_guardian_rank: number | null; last_rewards_pass_rank: number | null }>();
  const notifications = rankUpNotifications(previous, guardian, now);
  await env.DB.batch([
    ...notifications.map((notification) => env.DB.prepare(`
      INSERT OR IGNORE INTO guardian_notifications (
        id, event_key, type, category, scope, account_membership_id, priority, title, subtitle,
        badge, destination_url, created_at, updated_at, expires_at, dismissible, auto_dismiss,
        auto_dismiss_ms, repeatable, source, source_label, source_confidence, metadata_json
      ) VALUES (?, ?, ?, 'completion', 'account', ?, 'high', ?, ?, 'RANK UP', ?, ?, ?, ?, 1, 1, 14000, 0, 'bungie-profile', 'Live Bungie profile', 'live-api', ?)
    `).bind(
      notification.id,
      notification.eventKey,
      notification.type,
      guardian.membershipId,
      notification.title,
      notification.subtitle || null,
      notification.destinationUrl || null,
      notification.createdAt,
      notification.updatedAt || notification.createdAt,
      notification.expiresAt || null,
      JSON.stringify(notification.metadata || {})
    )),
    env.DB.prepare(`UPDATE users SET last_profile_at = ?, last_character_class = ?, last_power = ?, last_guardian_rank = ?, last_rewards_pass_rank = ?, last_emblem_path = ?
      WHERE membership_id = ?`)
      .bind(now.toISOString(), selected?.className || null, guardian.stats.power, guardian.stats.guardianRank, guardian.stats.rewardsPassRank, selected?.emblemPath || null, guardian.membershipId)
  ]);
}

export function rankUpNotifications(
  previous: { last_guardian_rank: number | null; last_rewards_pass_rank: number | null } | null | undefined,
  guardian: GuardianSummary,
  now = new Date()
): GuardianNotification[] {
  if (!previous) return [];
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60_000).toISOString();
  const entries: GuardianNotification[] = [];
  const add = (kind: "guardian-rank" | "rewards-pass", oldValue: number | null, newValue: number, destinationUrl: string) => {
    if (oldValue == null || !Number.isFinite(oldValue) || newValue <= oldValue) return;
    const guardianRank = kind === "guardian-rank";
    entries.push({
      id: `account:${guardian.membershipId}:${kind}:${newValue}`,
      eventKey: `${kind}-up:${newValue}`,
      type: `${kind}-up`,
      category: "completion",
      scope: "account",
      priority: "high",
      status: "active",
      title: guardianRank ? `Guardian Rank ${newValue} reached` : `Rewards Pass rank ${newValue} reached`,
      subtitle: guardianRank
        ? `Advanced from Guardian Rank ${oldValue}`
        : `Advanced from Rewards Pass rank ${oldValue}`,
      badge: "RANK UP",
      destinationUrl,
      createdAt,
      updatedAt: createdAt,
      expiresAt,
      dismissible: true,
      autoDismiss: true,
      autoDismissMs: 14_000,
      repeatable: false,
      source: "bungie-profile",
      sourceLabel: "Live Bungie profile",
      sourceConfidence: "live-api",
      metadata: { fanfare: "rank-up", previousRank: oldValue, currentRank: newValue }
    });
  };
  add("guardian-rank", previous.last_guardian_rank, guardian.stats.guardianRank, "/journey/guardian-rank");
  add("rewards-pass", previous.last_rewards_pass_rank, guardian.stats.rewardsPassRank, "/rewards");
  return entries;
}

export async function readAudienceDetails(env: Env): Promise<AudienceDetailData> {
  const [metrics, logins, visitors] = await Promise.all([
    readAudienceMetrics(env),
    env.DB.prepare(`SELECT membership_id, membership_type, display_name, bungie_name, created_at, updated_at,
      last_profile_at, last_character_class, last_power, last_guardian_rank, last_rewards_pass_rank, last_emblem_path
      , (SELECT COUNT(*) FROM oauth_sessions WHERE oauth_sessions.membership_id = users.membership_id) AS active_sessions
      FROM users WHERE audience_removed_at IS NULL ORDER BY updated_at DESC`).all<any>(),
    env.DB.prepare("SELECT substr(visitor_hash, 1, 12) AS visitor_id, created_at FROM audience_visitors ORDER BY created_at DESC LIMIT 500").all<any>()
  ]);
  return {
    ...metrics,
    logins: (logins.results || []).map((row: any) => ({
      membershipId: String(row.membership_id), membershipType: Number(row.membership_type), displayName: String(row.display_name), bungieName: String(row.bungie_name || ""),
      firstLoginAt: String(row.created_at), lastLoginAt: String(row.updated_at), lastProfileAt: row.last_profile_at || undefined,
      characterClass: row.last_character_class || undefined, power: row.last_power == null ? undefined : Number(row.last_power), guardianRank: row.last_guardian_rank == null ? undefined : Number(row.last_guardian_rank),
      rewardsPassRank: row.last_rewards_pass_rank == null ? undefined : Number(row.last_rewards_pass_rank), emblemPath: row.last_emblem_path || undefined,
      activeSessions: Math.max(0, Number(row.active_sessions || 0))
    })),
    visitors: (visitors.results || []).map((row: any) => ({ visitorId: String(row.visitor_id), firstSeenAt: String(row.created_at) }))
  };
}
