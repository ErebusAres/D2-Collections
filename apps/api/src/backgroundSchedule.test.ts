import { describe, expect, it } from "vitest";
import {
  backgroundTaskForCron,
  FIRETEAM_PRESENCE_CRON,
  FIRETEAM_SNAPSHOT_CRON,
  LOOT_WATCHER_CRON,
  MAINTENANCE_CRON
} from "./backgroundSchedule";

describe("background schedule", () => {
  it("routes each expensive workload to its own cron invocation", () => {
    expect(backgroundTaskForCron(LOOT_WATCHER_CRON)).toBe("loot-watchers");
    expect(backgroundTaskForCron(FIRETEAM_PRESENCE_CRON)).toBe("fireteam-presence");
    expect(backgroundTaskForCron(FIRETEAM_SNAPSHOT_CRON)).toBe("fireteam-snapshots");
    expect(backgroundTaskForCron(MAINTENANCE_CRON)).toBe("maintenance");
    expect(backgroundTaskForCron("unknown")).toBeUndefined();
  });
});
