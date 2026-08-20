import type { SavedPartyMember, GuardianPresenceState } from "./fireteamReliability";

export const FIRETEAM_V2_REFRESH_INTERVAL_MS = 5 * 60_000;
export const FIRETEAM_V2_ACTIVE_WINDOW_MS = 10 * 60_000;
export const FIRETEAM_V2_SNAPSHOT_GRACE_MS = 75_000;
export const FIRETEAM_V2_LEASE_MS = 2 * 60_000;
export const FIRETEAM_V2_RETRY_MS = 60_000;
export const FIRETEAM_V2_MAX_REFRESHES_PER_CRON = 8;
export const FIRETEAM_V2_READ_POLL_MS = 5_000;
export const FIRETEAM_V2_SOURCE_MAX_AGE_MS = 2 * 60_000;

export type FireteamV2RefreshState = "waiting" | "current" | "refreshing" | "delayed";

export function nextFireteamV2RefreshAt(committedAt: string | undefined): string | undefined {
  const committedMs = Date.parse(committedAt || "");
  return Number.isFinite(committedMs)
    ? new Date(committedMs + FIRETEAM_V2_REFRESH_INTERVAL_MS).toISOString()
    : undefined;
}

export function fireteamV2SnapshotUsable(
  committedAt: string | undefined,
  now = Date.now(),
  intervalMs = FIRETEAM_V2_REFRESH_INTERVAL_MS,
  graceMs = FIRETEAM_V2_SNAPSHOT_GRACE_MS
): boolean {
  const committedMs = Date.parse(committedAt || "");
  return Number.isFinite(committedMs)
    && committedMs <= now
    && now - committedMs <= intervalMs + graceMs;
}

export function fireteamV2RefreshState(input: {
  committedAt?: string;
  nextRefreshAt?: string;
  refreshStartedAt?: string;
  lastErrorCode?: string;
}, now = Date.now()): FireteamV2RefreshState {
  if (!input.committedAt) return input.lastErrorCode ? "delayed" : "waiting";
  const dueMs = Date.parse(input.nextRefreshAt || "");
  if (input.refreshStartedAt || Number.isFinite(dueMs) && dueMs <= now) {
    return input.lastErrorCode ? "delayed" : "refreshing";
  }
  return "current";
}

/**
 * A v2 roster is produced from one Bungie source snapshot. It never merges a
 * prior roster into a newer player-state observation. If the viewer is not
 * positively in an active Destiny session, teammates are not presented as a
 * current Fireteam.
 */
export function authoritativeFireteamV2Party(
  observed: SavedPartyMember[],
  selfMembershipId: string,
  onlineState: GuardianPresenceState,
  transitoryAvailable: boolean
): SavedPartyMember[] {
  const self = observed.find((member) => member.membershipId === selfMembershipId)
    || { membershipId: selfMembershipId, displayName: "", status: 0, observedInParty: false };
  if (onlineState !== "online" || !transitoryAvailable) {
    return [{ ...self, status: 0, observedInParty: false }];
  }
  const unique = new Map<string, SavedPartyMember>();
  for (const member of observed) {
    if (!member.membershipId) continue;
    unique.set(member.membershipId, member);
  }
  if (!unique.has(selfMembershipId)) unique.set(selfMembershipId, { ...self, observedInParty: false });
  return [...unique.values()].slice(0, 12);
}

export function fireteamV2RetryAfter(error: unknown, now = Date.now()): string {
  const retryAfterSeconds = Math.max(0, Number((error as any)?.retryAfterSeconds || (error as any)?.throttleSeconds || 0));
  return new Date(now + Math.max(FIRETEAM_V2_RETRY_MS, retryAfterSeconds * 1_000)).toISOString();
}

export function fireteamV2SnapshotAdvanced(previousVersion: number | undefined, nextVersion: number | undefined): boolean {
  return Number.isFinite(nextVersion) && Number(nextVersion) > Number(previousVersion || 0);
}

export function fireteamV2SourceAdvanced(
  previousSourceAt: string | undefined,
  candidateSourceAt: string | undefined,
  now = Date.now(),
  maxAgeMs = FIRETEAM_V2_SOURCE_MAX_AGE_MS
): boolean {
  const candidateMs = Date.parse(candidateSourceAt || "");
  if (!Number.isFinite(candidateMs) || candidateMs > now || now - candidateMs > maxAgeMs) return false;
  const previousMs = Date.parse(previousSourceAt || "");
  return !Number.isFinite(previousMs) || candidateMs > previousMs;
}
