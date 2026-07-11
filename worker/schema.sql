CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  bungie_membership_id TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS snapshots (
  player_id TEXT PRIMARY KEY,
  synced_at TEXT NOT NULL,
  membership_id TEXT,
  display_name TEXT,
  payload_json TEXT NOT NULL,
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS ownership (
  player_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  owned INTEGER NOT NULL DEFAULT 0,
  catalyst INTEGER NOT NULL DEFAULT 0,
  complete INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (player_id, item_id),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS resources (
  player_id TEXT PRIMARY KEY,
  exotic_ciphers INTEGER NOT NULL DEFAULT 0,
  exotic_engrams INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS oauth_sessions (
  session_hash TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  bungie_membership_id TEXT,
  access_token_cipher TEXT NOT NULL,
  refresh_token_cipher TEXT NOT NULL,
  access_expires_at INTEGER NOT NULL,
  refresh_expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE INDEX IF NOT EXISTS oauth_sessions_player_id
  ON oauth_sessions(player_id);

CREATE INDEX IF NOT EXISTS oauth_sessions_refresh_expires_at
  ON oauth_sessions(refresh_expires_at);
