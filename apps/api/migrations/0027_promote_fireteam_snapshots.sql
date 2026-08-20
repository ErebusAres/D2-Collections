PRAGMA foreign_keys = ON;

-- Preserve any legacy sharing choice for Guardians who had not opened the
-- isolated snapshot preview before it became the canonical Fireteam page.
INSERT OR IGNORE INTO fireteam_snapshots_v2 (
  membership_id,
  display_name,
  character_id,
  sharing_mode,
  expires_at,
  site_pinned_quest_ids_json,
  settings_json,
  next_refresh_at
)
SELECT
  membership_id,
  display_name,
  character_id,
  sharing_mode,
  expires_at,
  site_pinned_quest_ids_json,
  CASE
    WHEN json_valid(payload_json)
      AND json_extract(payload_json, '$.activityFeedPreferenceSet') = 1
      AND json_extract(payload_json, '$.activityFeedEnabled') = 0
      THEN '{"activityFeedEnabled":false}'
    WHEN json_valid(payload_json)
      AND json_extract(payload_json, '$.activityFeedPreferenceSet') = 1
      THEN '{"activityFeedEnabled":true}'
    ELSE '{}'
  END,
  '1970-01-01T00:00:00.000Z'
FROM fireteam_shares;

ALTER TABLE fireteam_snapshots_v2 RENAME TO fireteam_snapshots;

DROP INDEX IF EXISTS fireteam_snapshots_v2_due;
CREATE INDEX IF NOT EXISTS fireteam_snapshots_due
  ON fireteam_snapshots(sharing_mode, last_requested_at, next_refresh_at, retry_after_at);

DROP TABLE IF EXISTS fireteam_social_cache;
DROP TABLE IF EXISTS fireteam_shares;
