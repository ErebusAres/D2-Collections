CREATE TABLE IF NOT EXISTS audience_visitors (
  visitor_hash TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS audience_visitors_created_at ON audience_visitors(created_at);
