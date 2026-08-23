PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS loot_watcher_jobs (
  membership_id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL,
  next_run_at TEXT NOT NULL,
  run_started_at TEXT,
  last_run_at TEXT,
  last_success_at TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (membership_id) REFERENCES users(membership_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS loot_watcher_jobs_due
  ON loot_watcher_jobs(next_run_at, run_started_at);

CREATE TABLE IF NOT EXISTS loot_watcher_seen_items (
  membership_id TEXT NOT NULL,
  item_instance_id TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  PRIMARY KEY (membership_id, item_instance_id),
  FOREIGN KEY (membership_id) REFERENCES users(membership_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS loot_watcher_seen_items_membership
  ON loot_watcher_seen_items(membership_id, first_seen_at DESC);

INSERT OR IGNORE INTO loot_watcher_jobs (membership_id, character_id, next_run_at, updated_at)
SELECT character.membership_id, character.preference_value,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM user_preferences character
WHERE character.preference_key = 'site.character'
  AND EXISTS (
    SELECT 1 FROM user_preferences watcher
    WHERE watcher.membership_id = character.membership_id
      AND watcher.preference_key IN (
        'fireteam.watcher.farming.v1',
        'fireteam.watcher.highestPower.v1',
        'fireteam.watcher.tier5Fits.v1',
        'fireteam.watcher.duplicateFits.v1'
      )
      AND watcher.preference_value = 'on'
  );
