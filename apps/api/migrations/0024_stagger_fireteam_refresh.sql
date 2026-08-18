ALTER TABLE fireteam_shares ADD COLUMN background_refresh_attempted_at TEXT;

CREATE INDEX IF NOT EXISTS fireteam_shares_background_refresh
  ON fireteam_shares(sharing_mode, background_refresh_attempted_at);
