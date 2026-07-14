ALTER TABLE fireteam_shares ADD COLUMN sharing_mode TEXT NOT NULL DEFAULT 'temporary';
ALTER TABLE fireteam_shares ADD COLUMN site_pinned_quest_ids_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE fireteam_shares ADD COLUMN last_error TEXT;

CREATE INDEX IF NOT EXISTS fireteam_shares_mode ON fireteam_shares(sharing_mode);
