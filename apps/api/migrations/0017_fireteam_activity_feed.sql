CREATE TABLE IF NOT EXISTS fireteam_messages (
  id TEXT PRIMARY KEY,
  channel_key TEXT NOT NULL,
  membership_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (membership_id) REFERENCES users(membership_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fireteam_messages_channel_created ON fireteam_messages(channel_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fireteam_messages_created ON fireteam_messages(created_at);
