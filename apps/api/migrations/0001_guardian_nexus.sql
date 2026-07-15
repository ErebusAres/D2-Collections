PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  membership_id TEXT PRIMARY KEY,
  membership_type INTEGER NOT NULL,
  display_name TEXT NOT NULL,
  bungie_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS oauth_sessions (
  session_hash TEXT PRIMARY KEY,
  membership_id TEXT NOT NULL,
  access_token_cipher TEXT NOT NULL,
  refresh_token_cipher TEXT NOT NULL,
  access_expires_at INTEGER NOT NULL,
  refresh_expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (membership_id) REFERENCES users(membership_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS oauth_sessions_membership_id ON oauth_sessions(membership_id);
CREATE INDEX IF NOT EXISTS oauth_sessions_refresh_expiry ON oauth_sessions(refresh_expires_at);

CREATE TABLE IF NOT EXISTS matrix_snapshots (
  membership_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  synced_at TEXT NOT NULL,
  manifest_version TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  FOREIGN KEY (membership_id) REFERENCES users(membership_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS fireteam_shares (
  membership_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  character_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  FOREIGN KEY (membership_id) REFERENCES users(membership_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS fireteam_shares_expiry ON fireteam_shares(expires_at);

CREATE TABLE IF NOT EXISTS dev_probe_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  membership_id TEXT NOT NULL,
  endpoint_key TEXT NOT NULL,
  status INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  response_size INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (membership_id) REFERENCES users(membership_id) ON DELETE CASCADE
);
