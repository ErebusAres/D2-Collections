ALTER TABLE fireteam_snapshots ADD COLUMN presence_refreshed_at TEXT;
ALTER TABLE fireteam_snapshots ADD COLUMN presence_refresh_started_at TEXT;
ALTER TABLE fireteam_snapshots ADD COLUMN presence_error TEXT;

UPDATE fireteam_snapshots
SET presence_refreshed_at = committed_at
WHERE presence_refreshed_at IS NULL AND committed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS fireteam_snapshots_presence_due
  ON fireteam_snapshots(sharing_mode, last_requested_at, presence_refreshed_at);
