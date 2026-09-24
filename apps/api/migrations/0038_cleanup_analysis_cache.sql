PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS guardian_cleanup_analysis_cache (
  membership_id TEXT NOT NULL,
  settings_key TEXT NOT NULL,
  settings_json TEXT NOT NULL,
  analysis_json TEXT,
  source_minted_at TEXT,
  refreshed_at TEXT,
  expires_at TEXT,
  requested_at TEXT NOT NULL,
  refresh_started_at TEXT,
  last_error TEXT,
  PRIMARY KEY (membership_id, settings_key),
  FOREIGN KEY (membership_id) REFERENCES users(membership_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS guardian_cleanup_analysis_due
  ON guardian_cleanup_analysis_cache(requested_at, refreshed_at, refresh_started_at);
