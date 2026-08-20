ALTER TABLE fireteam_shares ADD COLUMN presence_requested_at TEXT;

CREATE INDEX IF NOT EXISTS fireteam_shares_presence_requested
  ON fireteam_shares(presence_requested_at, presence_refreshed_at);
