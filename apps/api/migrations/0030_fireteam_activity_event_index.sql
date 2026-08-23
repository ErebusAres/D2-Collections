CREATE INDEX IF NOT EXISTS recent_item_events_membership_last_observed
  ON recent_item_events(membership_id, last_observed_at DESC);
