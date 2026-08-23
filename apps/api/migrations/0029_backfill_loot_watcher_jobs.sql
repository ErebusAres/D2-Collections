PRAGMA foreign_keys = ON;

INSERT INTO loot_watcher_jobs (membership_id, character_id, next_run_at, updated_at)
SELECT enabled.membership_id,
  COALESCE(character.preference_value, snapshot.character_id),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (
  SELECT DISTINCT membership_id FROM user_preferences
  WHERE preference_key IN (
    'fireteam.watcher.farming.v1',
    'fireteam.watcher.highestPower.v1',
    'fireteam.watcher.tier5Fits.v1',
    'fireteam.watcher.duplicateFits.v1'
  ) AND preference_value = 'on'
) enabled
LEFT JOIN user_preferences character
  ON character.membership_id = enabled.membership_id
  AND character.preference_key = 'site.character'
LEFT JOIN fireteam_snapshots snapshot
  ON snapshot.membership_id = enabled.membership_id
WHERE COALESCE(character.preference_value, snapshot.character_id) IS NOT NULL
ON CONFLICT(membership_id) DO UPDATE SET
  character_id = excluded.character_id,
  updated_at = excluded.updated_at
WHERE loot_watcher_jobs.character_id <> excluded.character_id;
