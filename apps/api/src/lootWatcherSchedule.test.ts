import { describe, expect, it } from "vitest";
import {
  LOOT_WATCHER_INTERVAL_MS,
  LOOT_WATCHER_LEASE_MS,
  LOOT_WATCHER_MAX_RUNS_PER_CRON,
  lootWatcherItemIsNew,
  lootWatcherRetryAt,
  nextLootWatcherRunAt
} from "./lootWatcherSchedule";

describe("independent loot watcher schedule", () => {
  it("runs every five minutes without depending on the Fireteam page being open", () => {
    const now = Date.parse("2026-08-23T02:00:00.000Z");
    expect(LOOT_WATCHER_INTERVAL_MS).toBe(5 * 60_000);
    expect(nextLootWatcherRunAt(now)).toBe("2026-08-23T02:05:00.000Z");
  });

  it("bounds each cron pass and recovers abandoned leases", () => {
    expect(LOOT_WATCHER_MAX_RUNS_PER_CRON).toBeGreaterThan(0);
    expect(LOOT_WATCHER_MAX_RUNS_PER_CRON).toBeLessThanOrEqual(8);
    expect(LOOT_WATCHER_LEASE_MS).toBeGreaterThan(60_000);
  });

  it("retries after at least one minute and honors Bungie backoff", () => {
    const now = Date.parse("2026-08-23T02:00:00.000Z");
    expect(lootWatcherRetryAt({}, now)).toBe("2026-08-23T02:01:00.000Z");
    expect(lootWatcherRetryAt({ retryAfterSeconds: 90 }, now)).toBe("2026-08-23T02:01:30.000Z");
  });

  it("uses the last successful watcher pass as the new-item baseline", () => {
    const baseline = "2026-08-23T02:00:00.000Z";
    expect(lootWatcherItemIsNew("2026-08-23T02:01:00.000Z", baseline)).toBe(true);
    expect(lootWatcherItemIsNew("2026-08-23T01:59:00.000Z", baseline)).toBe(false);
    expect(lootWatcherItemIsNew(undefined, baseline)).toBe(true);
    expect(lootWatcherItemIsNew("2026-08-23T02:01:00.000Z", undefined)).toBe(false);
  });
});
