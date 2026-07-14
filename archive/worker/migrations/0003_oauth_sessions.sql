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
