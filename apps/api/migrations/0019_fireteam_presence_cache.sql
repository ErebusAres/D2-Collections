ALTER TABLE fireteam_shares ADD COLUMN presence_refreshed_at TEXT;
ALTER TABLE fireteam_shares ADD COLUMN presence_error TEXT;

CREATE INDEX IF NOT EXISTS fireteam_shares_presence_refresh ON fireteam_shares(presence_refreshed_at);
