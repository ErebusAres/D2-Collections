PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS guardian_cleanup_cosmetic_cache (
  membership_id TEXT PRIMARY KEY,
  choices_json TEXT NOT NULL,
  sets_json TEXT NOT NULL,
  source_minted_at TEXT NOT NULL,
  manifest_version TEXT NOT NULL,
  refreshed_at TEXT NOT NULL,
  FOREIGN KEY (membership_id) REFERENCES users(membership_id) ON DELETE CASCADE
);
