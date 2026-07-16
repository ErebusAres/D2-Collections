PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS user_preferences (
  membership_id TEXT NOT NULL,
  preference_key TEXT NOT NULL,
  preference_value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (membership_id, preference_key),
  FOREIGN KEY (membership_id) REFERENCES users(membership_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS user_preferences_membership_updated ON user_preferences(membership_id, updated_at DESC);
