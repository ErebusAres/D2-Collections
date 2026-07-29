PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS guardian_notifications (
  id TEXT PRIMARY KEY,
  event_key TEXT,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  scope TEXT NOT NULL CHECK(scope IN ('global', 'account')),
  account_membership_id TEXT,
  priority TEXT NOT NULL CHECK(priority IN ('critical', 'high', 'normal', 'low')),
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  icon TEXT,
  image_url TEXT,
  badge TEXT,
  destination_url TEXT,
  external_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  starts_at TEXT,
  expires_at TEXT,
  dismissible INTEGER NOT NULL DEFAULT 1,
  auto_dismiss INTEGER NOT NULL DEFAULT 1,
  auto_dismiss_ms INTEGER,
  repeatable INTEGER NOT NULL DEFAULT 0,
  source TEXT,
  source_label TEXT,
  source_confidence TEXT,
  metadata_json TEXT,
  created_by_membership_id TEXT,
  modified_by_membership_id TEXT,
  FOREIGN KEY (account_membership_id) REFERENCES users(membership_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS guardian_notifications_event_scope
  ON guardian_notifications(event_key, scope, COALESCE(account_membership_id, ''))
  WHERE event_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS guardian_notifications_active
  ON guardian_notifications(scope, starts_at, expires_at, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS guardian_notifications_account
  ON guardian_notifications(account_membership_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_user_state (
  membership_id TEXT NOT NULL,
  notification_id TEXT NOT NULL,
  read_at TEXT,
  dismissed_at TEXT,
  archived_at TEXT,
  deleted_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (membership_id, notification_id),
  FOREIGN KEY (membership_id) REFERENCES users(membership_id) ON DELETE CASCADE,
  FOREIGN KEY (notification_id) REFERENCES guardian_notifications(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS notification_user_state_membership
  ON notification_user_state(membership_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS notification_preferences (
  membership_id TEXT PRIMARY KEY,
  preferences_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (membership_id) REFERENCES users(membership_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS distortion_observations (
  id TEXT PRIMARY KEY,
  destination TEXT NOT NULL,
  destination_icon TEXT,
  destination_image TEXT,
  observed_start_at TEXT NOT NULL,
  observed_end_at TEXT,
  first_detected_at TEXT NOT NULL,
  last_confirmed_at TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence TEXT NOT NULL,
  complete INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS distortion_observations_time
  ON distortion_observations(observed_start_at DESC);
CREATE INDEX IF NOT EXISTS distortion_observations_destination
  ON distortion_observations(destination, observed_start_at DESC);

CREATE TABLE IF NOT EXISTS world_provider_status (
  provider_key TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  last_attempt_at TEXT NOT NULL,
  last_success_at TEXT,
  error_code TEXT,
  error_message TEXT
);
