DROP INDEX IF EXISTS guardian_notifications_event_scope;

CREATE INDEX IF NOT EXISTS guardian_notifications_event_scope_lookup
  ON guardian_notifications(event_key, scope, COALESCE(account_membership_id, ''))
  WHERE event_key IS NOT NULL;
