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

export function visiblePartyMembers<T extends { membershipId: string; observedInParty?: boolean }>(members: T[], selfMembershipId: string, presenceFresh: boolean): T[] {
  return members.filter((member) => member.membershipId === selfMembershipId || presenceFresh && member.observedInParty !== false);
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
