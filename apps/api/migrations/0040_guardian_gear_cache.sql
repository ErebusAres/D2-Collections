PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS guardian_gear_cache (
  membership_id TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,
  source_minted_at TEXT NOT NULL,
  refreshed_at TEXT NOT NULL,
  FOREIGN KEY (membership_id) REFERENCES users(membership_id) ON DELETE CASCADE
);
