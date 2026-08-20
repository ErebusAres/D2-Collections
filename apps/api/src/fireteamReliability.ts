export type GuardianSessionCacheState = "missing" | "fresh" | "stale" | "expired";

export interface SavedPartyMember {
  membershipId: string;
  membershipType?: number;
  displayName: string;
  status: number;
  observedInParty: boolean;
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

export function guardianSessionCacheState(refreshedAt?: string, now = Date.now()): GuardianSessionCacheState {
  if (!refreshedAt || !Number.isFinite(Date.parse(refreshedAt))) return "missing";
  const ageMs = Math.max(0, now - Date.parse(refreshedAt));
  if (ageMs <= 2 * 60_000) return "fresh";
  if (ageMs <= 24 * 60 * 60_000) return "stale";
  return "expired";
}
