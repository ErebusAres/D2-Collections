export type FireteamSocialCacheState = "missing" | "fresh" | "stale" | "expired";
export type GuardianSessionCacheState = "missing" | "fresh" | "stale" | "expired";

export interface SavedPartyMember {
  membershipId: string;
  membershipType?: number;
  displayName: string;
  status: number;
  observedInParty: boolean;
}

export interface PartyObservation {
  members: SavedPartyMember[];
  consecutiveSoloObservations: number;
}

export type GuardianPresenceState = "online" | "offline" | "unknown";

export interface GuardianSessionEvidence {
  sourceObservedAt: string;
  minutesByCharacter: Record<string, number>;
  lastAdvancedAt?: string;
  activeCharacterId?: string;
}

export interface GuardianSessionObservation {
  evidence: GuardianSessionEvidence;
  onlineState: GuardianPresenceState;
  activeCharacterId?: string;
}

// Bungie's profile response can repeat the same source snapshot for several
// presence refreshes. Keep the activity proof aligned with the existing
// ten-minute party-snapshot usability window so repeated snapshots cannot
// alternate the same Fireteam between visible and hidden.
const SESSION_ADVANCE_GRACE_MS = 2 * 60_000;
const SESSION_CONFIRMATION_MAX_AGE_MS = 2 * 60_000;

export function sourceObservationTimestamp(sourceObservedAt: unknown, now = Date.now()): string {
  const parsed = typeof sourceObservedAt === "string" ? Date.parse(sourceObservedAt) : Number.NaN;
  return Number.isFinite(parsed) && parsed <= now + 60_000
    ? new Date(parsed).toISOString()
    : new Date(now).toISOString();
}

/**
 * Character session totals are not a presence flag: Bungie can retain a
 * non-zero total after sign-out. Only movement between ordered source
 * snapshots proves a live session. A short grace covers snapshots taken on
 * opposite sides of the minute counter without turning a frozen total into
 * durable online presence.
 */
export function observeGuardianSession(
  characters: Array<{ characterId: string; minutesPlayedThisSession?: number; dateLastPlayed?: string }>,
  previous: GuardianSessionEvidence | undefined,
  sourceObservedAt: string,
  advanceGraceMs = SESSION_ADVANCE_GRACE_MS
): GuardianSessionObservation {
  const minutesByCharacter: Record<string, number> = {};
  for (const character of characters) {
    const characterId = String(character.characterId || "");
    if (!characterId) continue;
    minutesByCharacter[characterId] = Math.max(0, Number(character.minutesPlayedThisSession || 0));
  }

  const sourceMs = Date.parse(sourceObservedAt);
  const previousSourceMs = Date.parse(previous?.sourceObservedAt || "");
  const ordered = Number.isFinite(sourceMs) && (!previous || Number.isFinite(previousSourceMs) && sourceMs > previousSourceMs);
  let activeCharacterId: string | undefined;
  let largestAdvance = 0;
  let sessionClockConfirmed = false;
  let sessionClockCharacterId: string | undefined;
  for (const character of characters) {
    const playedAt = Date.parse(String(character.dateLastPlayed || ""));
    const minutes = Math.max(0, Number(character.minutesPlayedThisSession || 0));
    // Bungie defines dateLastPlayed as the last play timestamp and
    // minutesPlayedThisSession as the current session duration. While the
    // character is actually online, their sum follows the source timestamp to
    // within the minute-level precision of the duration counter.
    if (Number.isFinite(sourceMs) && Number.isFinite(playedAt) && Math.abs(sourceMs - (playedAt + minutes * 60_000)) <= 90_000) {
      sessionClockConfirmed = true;
      sessionClockCharacterId = String(character.characterId || "") || undefined;
    }
  }
  if (previous && ordered) {
    for (const [characterId, minutes] of Object.entries(minutesByCharacter)) {
      const advance = minutes - Number(previous.minutesByCharacter?.[characterId] || 0);
      if (advance > largestAdvance) {
        largestAdvance = advance;
        activeCharacterId = characterId;
      }
    }
  }

  const advanced = largestAdvance > 0;
  const lastAdvancedAt = advanced || sessionClockConfirmed ? sourceObservedAt : previous?.lastAdvancedAt;
  const lastAdvancedMs = Date.parse(lastAdvancedAt || "");
  const withinAdvanceGrace = ordered
    && Number.isFinite(lastAdvancedMs)
    && sourceMs >= lastAdvancedMs
    && sourceMs - lastAdvancedMs <= advanceGraceMs;
  const hasCharacters = Object.keys(minutesByCharacter).length > 0;
  const allZero = hasCharacters && Object.values(minutesByCharacter).every((minutes) => minutes <= 0);
  const onlineState: GuardianPresenceState = sessionClockConfirmed
    ? "online"
    : allZero
    ? "offline"
    : advanced || withinAdvanceGrace
      ? "online"
      : "unknown";

  const nextEvidence: GuardianSessionEvidence = ordered || !previous
    ? {
      sourceObservedAt,
      minutesByCharacter,
      ...(lastAdvancedAt ? { lastAdvancedAt } : {}),
      ...(activeCharacterId || previous?.activeCharacterId ? { activeCharacterId: activeCharacterId || previous?.activeCharacterId } : {})
    }
    : previous;
  return { evidence: nextEvidence, onlineState, activeCharacterId: activeCharacterId || sessionClockCharacterId || nextEvidence.activeCharacterId };
}

export function sessionPresenceConfirmed(
  evidence: GuardianSessionEvidence | undefined,
  presenceRefreshedAt: string | undefined,
  now = Date.now(),
  maxAgeMs = SESSION_CONFIRMATION_MAX_AGE_MS
): boolean {
  const sourceMs = Date.parse(evidence?.sourceObservedAt || "");
  const refreshedMs = Date.parse(presenceRefreshedAt || "");
  const advancedMs = Date.parse(evidence?.lastAdvancedAt || "");
  return Number.isFinite(sourceMs)
    && Number.isFinite(refreshedMs)
    && Number.isFinite(advancedMs)
    && refreshedMs >= sourceMs - 1_000
    && now >= refreshedMs
    && now - refreshedMs <= maxAgeMs
    && now >= sourceMs
    && now - sourceMs <= maxAgeMs
    && now >= advancedMs
    && now - advancedMs <= maxAgeMs;
}

export function reciprocalPartyObserved(payload: any, viewerMembershipId: string): boolean {
  const party = Array.isArray(payload?.activityPartyMembers) ? payload.activityPartyMembers : [];
  return party.some((member: any) => String(member?.membershipId || "") === viewerMembershipId && member?.observedInParty === true);
}

export function syncedTeammatePresenceConfirmed(
  payload: any,
  viewerMembershipId: string,
  presenceRefreshedAt: string | undefined,
  now = Date.now()
): boolean {
  return payload?.onlineState === "online"
    && sessionPresenceConfirmed(payload?.sessionPresenceEvidence, presenceRefreshedAt, now)
    && reciprocalPartyObserved(payload, viewerMembershipId);
}

export function fireteamSocialCacheState(refreshedAt?: string, now = Date.now()): FireteamSocialCacheState {
  if (!refreshedAt || !Number.isFinite(Date.parse(refreshedAt))) return "missing";
  const ageMs = Math.max(0, now - Date.parse(refreshedAt));
  if (ageMs <= 10 * 60_000) return "fresh";
  if (ageMs <= 24 * 60 * 60_000) return "stale";
  return "expired";
}

export function guardianSessionCacheState(refreshedAt?: string, now = Date.now()): GuardianSessionCacheState {
  if (!refreshedAt || !Number.isFinite(Date.parse(refreshedAt))) return "missing";
  const ageMs = Math.max(0, now - Date.parse(refreshedAt));
  if (ageMs <= 2 * 60_000) return "fresh";
  if (ageMs <= 24 * 60 * 60_000) return "stale";
  return "expired";
}

export function resolvePartyObservation(
  observed: SavedPartyMember[],
  previous: SavedPartyMember[],
  transitoryAvailable: boolean,
  consecutiveSoloObservations = 0
): PartyObservation {
  if (!transitoryAvailable) return { members: previous.length ? previous.slice(0, 12) : observed, consecutiveSoloObservations };
  if (observed.length > 1) return { members: observed, consecutiveSoloObservations: 0 };
  if (previous.length <= 1) return { members: observed, consecutiveSoloObservations: 0 };
  const nextSoloObservations = Math.max(0, consecutiveSoloObservations) + 1;
  return nextSoloObservations < 3
    ? {
      members: previous.slice(0, 12).map((member) => ({
        ...member,
        observedInParty: observed.some((candidate) => candidate.membershipId === member.membershipId && candidate.observedInParty)
      })),
      consecutiveSoloObservations: nextSoloObservations
    }
    : { members: observed, consecutiveSoloObservations: 0 };
}

export function partyObservationForProgressRefresh(
  previous: SavedPartyMember[] | undefined,
  previousConsecutiveSoloObservations: number,
  initial: PartyObservation
): PartyObservation {
  return previous === undefined
    ? initial
    : { members: previous.slice(0, 12), consecutiveSoloObservations: Math.max(0, previousConsecutiveSoloObservations) };
}

export function fireteamPresenceRefreshDue(refreshedAt?: string, now = Date.now(), intervalMs = 60_000): boolean {
  if (!refreshedAt || !Number.isFinite(Date.parse(refreshedAt))) return true;
  return now - Date.parse(refreshedAt) >= intervalMs;
}

export function fireteamPresenceUsable(refreshedAt?: string, now = Date.now(), maxAgeMs = 2 * 60_000): boolean {
  if (!refreshedAt) return false;
  const observedAt = Date.parse(refreshedAt);
  return Number.isFinite(observedAt) && now - observedAt <= maxAgeMs;
}

export function offlineViewerParty(observed: SavedPartyMember[], previous: SavedPartyMember[], selfMembershipId: string): SavedPartyMember[] {
  const self = observed.find((member) => member.membershipId === selfMembershipId)
    || previous.find((member) => member.membershipId === selfMembershipId);
  return self ? [{ ...self, observedInParty: false, status: 0 }] : [];
}

export function resolveViewerPartyObservation(
  observed: SavedPartyMember[],
  previous: SavedPartyMember[],
  transitoryAvailable: boolean,
  consecutiveSoloObservations: number,
  selfMembershipId: string,
  viewerDirectlyOffline: boolean
): PartyObservation {
  return viewerDirectlyOffline
    ? { members: offlineViewerParty(observed, previous, selfMembershipId), consecutiveSoloObservations: 0 }
    : resolvePartyObservation(observed, previous, transitoryAvailable, consecutiveSoloObservations);
}

export function visiblePartyMembers<T extends { membershipId: string; observedInParty?: boolean }>(
  members: T[],
  selfMembershipId: string,
  presenceFresh: boolean
): T[] {
  return members.filter((member) => member.membershipId === selfMembershipId
    || presenceFresh && member.observedInParty !== false);
}


export async function mapWithConcurrency<T, R>(values: T[], concurrency: number, mapper: (value: T, index: number) => Promise<R>): Promise<R[]> {
  const output = new Array<R>(values.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      output[index] = await mapper(values[index]!, index);
    }
  }));
  return output;
}
