PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS guardian_session_cache (
  membership_id TEXT PRIMARY KEY,
  guardian_json TEXT NOT NULL,
  refreshed_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  refresh_started_at TEXT,
  last_error TEXT,
  FOREIGN KEY (membership_id) REFERENCES users(membership_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS guardian_session_cache_refreshed ON guardian_session_cache(refreshed_at);

CREATE TABLE IF NOT EXISTS guardian_rewards_cache (
  membership_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  rewards_json TEXT NOT NULL,
  refreshed_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  refresh_started_at TEXT,
  last_error TEXT,
  PRIMARY KEY (membership_id, character_id),
  FOREIGN KEY (membership_id) REFERENCES users(membership_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS guardian_rewards_cache_refreshed ON guardian_rewards_cache(refreshed_at);
