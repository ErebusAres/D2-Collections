CREATE TABLE IF NOT EXISTS fireteam_snapshots (
  player_id TEXT PRIMARY KEY,
  synced_at TEXT NOT NULL,
  membership_id TEXT,
  display_name TEXT,
  payload_json TEXT NOT NULL,
  FOREIGN KEY (player_id) REFERENCES players(id)
);
