PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS report_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  actor_membership_id TEXT,
  actor_display_name TEXT NOT NULL,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('reporter', 'admin')),
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'comment', 'status', 'priority', 'assignment', 'resolution', 'admin_note')),
  body TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'admin')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_membership_id) REFERENCES users(membership_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS report_activity_report_created ON report_activity(report_id, created_at, id);
CREATE INDEX IF NOT EXISTS report_activity_actor_created ON report_activity(actor_membership_id, created_at DESC);

INSERT INTO report_activity (
  report_id, actor_membership_id, actor_display_name, actor_role,
  event_type, body, metadata_json, visibility, created_at
)
SELECT
  reports.id,
  reports.reporter_membership_id,
  reports.reporter_display_name,
  'reporter',
  'created',
  'Created this ticket.',
  json_object('category', reports.category, 'priority', reports.priority),
  'public',
  reports.created_at
FROM reports
WHERE NOT EXISTS (
  SELECT 1 FROM report_activity WHERE report_activity.report_id = reports.id
);
