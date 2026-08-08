PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS recent_item_observations (
  membership_id TEXT NOT NULL,
  observation_key TEXT NOT NULL,
  observation_kind TEXT NOT NULL,
  state_value TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (membership_id, observation_key),
  FOREIGN KEY (membership_id) REFERENCES users(membership_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recent_item_events (
  id TEXT PRIMARY KEY,
  membership_id TEXT NOT NULL,
  event_kind TEXT NOT NULL,
  source_key TEXT NOT NULL,
  item_hash TEXT,
  instance_id TEXT,
  record_hash TEXT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  metadata_json TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  last_observed_at TEXT NOT NULL,
  FOREIGN KEY (membership_id) REFERENCES users(membership_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS recent_item_events_membership_time ON recent_item_events(membership_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS recent_item_events_coalesce ON recent_item_events(membership_id, event_kind, source_key, last_observed_at DESC);
