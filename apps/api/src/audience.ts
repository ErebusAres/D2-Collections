import type { AudienceMetrics } from "@guardian-nexus/contracts";
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
