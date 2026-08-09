export type FireteamSocialCacheState = "missing" | "fresh" | "stale" | "expired";
export type GuardianSessionCacheState = "missing" | "fresh" | "stale" | "expired";

export interface SavedPartyMember {
  membershipId: string;
  membershipType?: number;
  displayName: string;
  status: number;
  observedInParty: boolean;
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

export function preservePartyWhenTransitoryIsMissing(
  observed: SavedPartyMember[],
  previous: SavedPartyMember[],
  transitoryAvailable: boolean
): SavedPartyMember[] {
  if (transitoryAvailable || observed.length > 1 || previous.length <= 1) return observed;
  return previous.slice(0, 12);
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
