PRAGMA foreign_keys = ON;

-- Hot Gear reads need only state changed after the durable snapshot or rows
-- carrying a persistent tag/dismissal. The existing membership/updated index
-- covers the former; this partial index bounds the latter.
CREATE INDEX IF NOT EXISTS gear_item_state_membership_meaningful
  ON gear_item_state(membership_id, item_instance_id)
  WHERE tag IS NOT NULL OR dismissed_at IS NOT NULL;

-- Recent Loot orders by the most recent coalesced observation, not the first
-- observation timestamp used by the original index.
CREATE INDEX IF NOT EXISTS recent_item_events_membership_last_time
  ON recent_item_events(membership_id, last_observed_at DESC, id DESC);
