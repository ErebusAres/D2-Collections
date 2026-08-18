PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS guardian_quest_cache (
  membership_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  quests_json TEXT NOT NULL,
  source_minted_at TEXT,
  refreshed_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  refresh_started_at TEXT,
  last_error TEXT,
  PRIMARY KEY (membership_id, character_id),
  FOREIGN KEY (membership_id) REFERENCES users(membership_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS guardian_quest_cache_expiry
  ON guardian_quest_cache(expires_at);
