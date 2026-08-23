import type { QuestProgress } from "@guardian-nexus/contracts";
import type { SavedPartyMember, GuardianPresenceState } from "./fireteamReliability";

export const FIRETEAM_REFRESH_INTERVAL_MS = 5 * 60_000;
export const FIRETEAM_ACTIVE_WINDOW_MS = 10 * 60_000;
export const FIRETEAM_SNAPSHOT_GRACE_MS = 75_000;
export const FIRETEAM_REFRESH_LEASE_MS = 2 * 60_000;
export const FIRETEAM_RETRY_MS = 60_000;
// Scheduled refresh work is bounded, but retains enough capacity to keep a
// normal multi-member Fireteam on the advertised five-minute cadence.
export const FIRETEAM_MAX_REFRESHES_PER_CRON = 8;
export const FIRETEAM_SOURCE_MAX_AGE_MS = 2 * 60_000;

export type FireteamRefreshState = "waiting" | "current" | "refreshing" | "delayed";

export function nextFireteamRefreshAt(committedAt: string | undefined): string | undefined {
  const committedMs = Date.parse(committedAt || "");
  return Number.isFinite(committedMs)
    ? new Date(committedMs + FIRETEAM_REFRESH_INTERVAL_MS).toISOString()
    : undefined;
}

export function fireteamSnapshotUsable(
  committedAt: string | undefined,
  now = Date.now(),
  intervalMs = FIRETEAM_REFRESH_INTERVAL_MS,
  graceMs = FIRETEAM_SNAPSHOT_GRACE_MS
): boolean {
  const committedMs = Date.parse(committedAt || "");
  return Number.isFinite(committedMs)
    && committedMs <= now
    && now - committedMs <= intervalMs + graceMs;
}

export function fireteamRefreshState(input: {
  committedAt?: string;
  nextRefreshAt?: string;
  refreshStartedAt?: string;
  lastErrorCode?: string;
}, now = Date.now()): FireteamRefreshState {
  if (!input.committedAt) return input.lastErrorCode ? "delayed" : "waiting";
  const dueMs = Date.parse(input.nextRefreshAt || "");
  if (input.refreshStartedAt || Number.isFinite(dueMs) && dueMs <= now) {
    return input.lastErrorCode ? "delayed" : "refreshing";
  }
  return "current";
}

export function fireteamRefreshDue(input: {
  nextRefreshAt?: string;
  retryAfterAt?: string;
  refreshStartedAt?: string;
}, now = Date.now()): boolean {
  const dueMs = Date.parse(input.nextRefreshAt || "");
  if (!Number.isFinite(dueMs) || dueMs > now) return false;
  const retryMs = Date.parse(input.retryAfterAt || "");
  if (Number.isFinite(retryMs) && retryMs > now) return false;
  const startedMs = Date.parse(input.refreshStartedAt || "");
  return !Number.isFinite(startedMs) || startedMs <= now - FIRETEAM_REFRESH_LEASE_MS;
}

/**
 * The roster is produced from one Bungie source snapshot. It never merges a
 * prior roster into a newer player-state observation. A fresh transitory roster
 * containing another Guardian is itself direct evidence of an active Fireteam;
 * otherwise the viewer still needs positive session evidence.
 */
export function authoritativeFireteamParty(
  observed: SavedPartyMember[],
  selfMembershipId: string,
  onlineState: GuardianPresenceState,
  transitoryAvailable: boolean
): SavedPartyMember[] {
  const self = observed.find((member) => member.membershipId === selfMembershipId)
    || { membershipId: selfMembershipId, displayName: "", status: 0, observedInParty: false };
  const hasObservedTeammate = observed.some((member) => member.membershipId !== selfMembershipId && member.observedInParty);
  // A fresh transitory party roster is direct presence evidence. Do not hide it
  // merely because the slower character-session heuristic has not advanced yet.
  if (!transitoryAvailable || onlineState !== "online" && !hasObservedTeammate) {
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

export function fireteamRetryAfter(error: unknown, now = Date.now()): string {
  const retryAfterSeconds = Math.max(0, Number((error as any)?.retryAfterSeconds || (error as any)?.throttleSeconds || 0));
  return new Date(now + Math.max(FIRETEAM_RETRY_MS, retryAfterSeconds * 1_000)).toISOString();
}

export function fireteamSnapshotAdvanced(previousVersion: number | undefined, nextVersion: number | undefined): boolean {
  return Number.isFinite(nextVersion) && Number(nextVersion) > Number(previousVersion || 0);
}

/**
 * The Fireteam rail owns Seasonal Hub Order visibility, so every order in the
 * current pursuit inventory must be present in the committed snapshot. Other
 * pursuits remain opt-in through Destiny or Guardian Nexus tracking.
 */
export function fireteamSharedQuests(quests: QuestProgress[], trackedQuestIds: ReadonlySet<string>): QuestProgress[] {
  return quests
    .filter((quest) => quest.category === "order" || trackedQuestIds.has(quest.instanceId))
    .map((quest) => ({ ...quest, steps: undefined }));
}

export function fireteamSourceAdvanced(
  previousSourceAt: string | undefined,
  candidateSourceAt: string | undefined,
  now = Date.now(),
  maxAgeMs = FIRETEAM_SOURCE_MAX_AGE_MS
): boolean {
  const candidateMs = Date.parse(candidateSourceAt || "");
  if (!Number.isFinite(candidateMs) || candidateMs > now || now - candidateMs > maxAgeMs) return false;
  const previousMs = Date.parse(previousSourceAt || "");
  return !Number.isFinite(previousMs) || candidateMs > previousMs;
}
