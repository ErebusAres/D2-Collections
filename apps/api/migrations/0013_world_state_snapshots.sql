PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS world_state_snapshots (
  provider_key TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS world_state_snapshots_expiry
  ON world_state_snapshots(expires_at);
