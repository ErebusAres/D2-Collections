PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS build_working_drafts (
  build_id TEXT NOT NULL,
  editor_membership_id TEXT NOT NULL,
  build_json TEXT NOT NULL,
  base_updated_at TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  PRIMARY KEY (build_id, editor_membership_id),
  FOREIGN KEY (build_id) REFERENCES builds(id) ON DELETE CASCADE,
  FOREIGN KEY (editor_membership_id) REFERENCES users(membership_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS build_working_drafts_saved ON build_working_drafts(saved_at DESC);
