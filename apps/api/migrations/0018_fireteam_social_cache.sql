CREATE TABLE IF NOT EXISTS fireteam_social_cache (
  membership_id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  refreshed_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_error TEXT,
  FOREIGN KEY (membership_id) REFERENCES users(membership_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fireteam_social_cache_expires ON fireteam_social_cache(expires_at);
