export const LOOT_WATCHER_INTERVAL_MS = 60_000;
export const LOOT_WATCHER_LEASE_MS = 2 * 60_000;
export const LOOT_WATCHER_MAX_RUNS_PER_CRON = 4;

export function nextLootWatcherRunAt(now = Date.now()): string {
  return new Date(now + LOOT_WATCHER_INTERVAL_MS).toISOString();
}

export function lootWatcherRetryAt(error: unknown, now = Date.now()): string {
  const retrySeconds = Math.max(60, Number((error as any)?.retryAfterSeconds || (error as any)?.throttleSeconds || 0));
  return new Date(now + retrySeconds * 1_000).toISOString();
}
