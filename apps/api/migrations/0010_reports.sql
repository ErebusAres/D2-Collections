PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_membership_id TEXT NOT NULL,
  reporter_display_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('bug', 'suggestion', 'feedback', 'data', 'performance', 'accessibility', 'account', 'other')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reproduction_steps TEXT NOT NULL DEFAULT '',
  expected_result TEXT NOT NULL DEFAULT '',
  actual_result TEXT NOT NULL DEFAULT '',
  page_url TEXT NOT NULL DEFAULT '',
  client_context_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'dismissed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to_membership_id TEXT,
  assigned_to_display_name TEXT,
  admin_notes TEXT NOT NULL DEFAULT '',
  resolution TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resolved_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (reporter_membership_id) REFERENCES users(membership_id) ON DELETE RESTRICT,
  FOREIGN KEY (assigned_to_membership_id) REFERENCES users(membership_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS reports_reporter_created ON reports(reporter_membership_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_status_priority_updated ON reports(status, priority, updated_at DESC);
CREATE INDEX IF NOT EXISTS reports_assignee_status ON reports(assigned_to_membership_id, status, updated_at DESC);
