PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS recent_item_refresh_state (
  membership_id TEXT PRIMARY KEY,
  refreshed_at TEXT NOT NULL,
  refresh_started_at TEXT,
  last_error TEXT,
  FOREIGN KEY (membership_id) REFERENCES users(membership_id) ON DELETE CASCADE
);

ALTER TABLE users ADD COLUMN audience_removed_at TEXT;

CREATE INDEX IF NOT EXISTS users_audience_active ON users(audience_removed_at, updated_at DESC);
