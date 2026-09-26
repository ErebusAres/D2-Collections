// Watchers operate from full Bungie inventory snapshots. Five-minute cadence
// matches Recent Loot freshness while keeping account-wide reads well below D1
// daily limits; explicit settings changes still queue a run immediately.
export const LOOT_WATCHER_INTERVAL_MS = 5 * 60_000;
export const LOOT_WATCHER_LEASE_MS = 2 * 60_000;
// A watcher pass fetches a full inventory and can perform several Bungie item
// actions. Keep each minute's Worker invocation small enough to finish.
export const LOOT_WATCHER_MAX_RUNS_PER_CRON = 2;

export function nextLootWatcherRunAt(now = Date.now()): string {
  return new Date(now + LOOT_WATCHER_INTERVAL_MS).toISOString();
}

export function lootWatcherRetryAt(error: unknown, now = Date.now()): string {
  const retrySeconds = Math.max(60, Number((error as any)?.retryAfterSeconds || (error as any)?.throttleSeconds || 0));
  return new Date(now + retrySeconds * 1_000).toISOString();
}

export function lootWatcherItemIsNew(firstSeenAt: string | undefined, previousSuccessAt: string | undefined): boolean {
  if (!previousSuccessAt) return false;
  const baseline = Date.parse(previousSuccessAt);
  if (!Number.isFinite(baseline)) return false;
  if (!firstSeenAt) return true;
  const firstSeen = Date.parse(firstSeenAt);
  return !Number.isFinite(firstSeen) || firstSeen > baseline;
}
