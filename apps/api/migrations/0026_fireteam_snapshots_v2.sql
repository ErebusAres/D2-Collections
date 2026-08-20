CREATE TABLE IF NOT EXISTS fireteam_snapshots_v2 (
  membership_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT '',
  character_id TEXT NOT NULL DEFAULT '',
  sharing_mode TEXT NOT NULL DEFAULT 'off',
  expires_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
  site_pinned_quest_ids_json TEXT NOT NULL DEFAULT '[]',
  settings_json TEXT NOT NULL DEFAULT '{}',
  snapshot_version INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT,
  source_observed_at TEXT,
  committed_at TEXT,
  next_refresh_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
  last_requested_at TEXT,
  refresh_started_at TEXT,
  last_attempt_at TEXT,
  retry_after_at TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  FOREIGN KEY (membership_id) REFERENCES users(membership_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS fireteam_snapshots_v2_due
  ON fireteam_snapshots_v2(sharing_mode, last_requested_at, next_refresh_at, retry_after_at);
