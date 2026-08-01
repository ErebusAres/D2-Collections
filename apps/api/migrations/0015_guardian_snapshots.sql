PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS guardian_snapshots (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  owner_membership_id TEXT NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('private', 'unlisted')),
  document_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_membership_id) REFERENCES users(membership_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS guardian_snapshots_owner_updated ON guardian_snapshots(owner_membership_id, updated_at DESC);
