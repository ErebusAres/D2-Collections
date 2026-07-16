PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS builds (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  author_membership_id TEXT NOT NULL,
  author_display_name TEXT NOT NULL,
  title TEXT NOT NULL,
  class_type TEXT NOT NULL,
  subclass TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'pending_review', 'rejected', 'archived')),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'unlisted', 'public')),
  build_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  review_notes TEXT,
  FOREIGN KEY (author_membership_id) REFERENCES users(membership_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS builds_public_updated ON builds(status, visibility, updated_at DESC);
CREATE INDEX IF NOT EXISTS builds_author_updated ON builds(author_membership_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS build_votes (
  build_id TEXT NOT NULL,
  membership_id TEXT NOT NULL,
  vote INTEGER NOT NULL CHECK (vote IN (-1, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (build_id, membership_id),
  FOREIGN KEY (build_id) REFERENCES builds(id) ON DELETE CASCADE,
  FOREIGN KEY (membership_id) REFERENCES users(membership_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS build_votes_build ON build_votes(build_id);

CREATE TABLE IF NOT EXISTS build_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  build_id TEXT NOT NULL,
  editor_membership_id TEXT NOT NULL,
  build_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (build_id) REFERENCES builds(id) ON DELETE CASCADE,
  FOREIGN KEY (editor_membership_id) REFERENCES users(membership_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS build_revisions_build_created ON build_revisions(build_id, created_at DESC);
