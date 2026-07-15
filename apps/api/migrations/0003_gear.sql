PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS gear_item_state (
  membership_id TEXT NOT NULL,
  item_instance_id TEXT NOT NULL,
  tag TEXT,
  first_seen_at TEXT NOT NULL,
  dismissed_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (membership_id, item_instance_id),
  FOREIGN KEY (membership_id) REFERENCES users(membership_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS gear_item_state_membership_updated ON gear_item_state(membership_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS gear_action_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  membership_id TEXT NOT NULL,
  action TEXT NOT NULL,
  item_instance_id TEXT NOT NULL,
  target_character_id TEXT,
  status INTEGER NOT NULL,
  error_code TEXT,
  duration_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (membership_id) REFERENCES users(membership_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS gear_action_audit_actor_time ON gear_action_audit(membership_id, created_at DESC);
