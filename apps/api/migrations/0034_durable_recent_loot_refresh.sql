ALTER TABLE recent_item_refresh_state ADD COLUMN requested_at TEXT;
ALTER TABLE recent_item_refresh_state ADD COLUMN character_id TEXT;
ALTER TABLE recent_item_refresh_state ADD COLUMN retry_after_at TEXT;
CREATE INDEX IF NOT EXISTS recent_item_refresh_due ON recent_item_refresh_state(refreshed_at, requested_at);
ALTER TABLE loot_watcher_jobs ADD COLUMN last_summary TEXT;
