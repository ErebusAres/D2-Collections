export const LOOT_WATCHER_CRON = "* * * * *";
export const FIRETEAM_PRESENCE_CRON = "1-59/2 * * * *";
export const FIRETEAM_SNAPSHOT_CRON = "2-59/5 * * * *";
export const MAINTENANCE_CRON = "4-59/5 * * * *";

export type BackgroundTask = "loot-watchers" | "fireteam-presence" | "fireteam-snapshots" | "maintenance";

export function backgroundTaskForCron(cron: string): BackgroundTask | undefined {
  if (cron === FIRETEAM_PRESENCE_CRON) return "fireteam-presence";
  if (cron === FIRETEAM_SNAPSHOT_CRON) return "fireteam-snapshots";
  if (cron === MAINTENANCE_CRON) return "maintenance";
  if (cron === LOOT_WATCHER_CRON) return "loot-watchers";
  return undefined;
}
