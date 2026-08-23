PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS guardian_reward_code_status_cache (
  membership_id TEXT PRIMARY KEY,
  status_json TEXT NOT NULL,
  source_minted_at TEXT,
  refreshed_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  refresh_started_at TEXT,
  last_error TEXT,
  FOREIGN KEY (membership_id) REFERENCES users(membership_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS guardian_reward_code_status_cache_expiry
  ON guardian_reward_code_status_cache(expires_at);
