import type { Env } from "./types";

export async function recordAudienceSessionSeen(env: Env, membershipId: string, now = new Date()): Promise<void> {
  await env.DB.prepare(`UPDATE users SET last_seen_at = ? WHERE membership_id = ?
    AND (last_seen_at IS NULL OR last_seen_at < ?)`)
    .bind(now.toISOString(), membershipId, new Date(now.getTime() - 5 * 60_000).toISOString()).run();
}
