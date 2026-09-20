CREATE TABLE cleanup_preferences (membership_id TEXT PRIMARY KEY, settings_json TEXT NOT NULL);
CREATE TABLE cleanup_marks (
  membership_id TEXT NOT NULL, item_id TEXT NOT NULL, batch_id TEXT NOT NULL,
  reason TEXT NOT NULL, confidence INTEGER NOT NULL, recommendation_key TEXT NOT NULL,
  PRIMARY KEY (membership_id, item_id)
);
CREATE TABLE cleanup_dismissals (membership_id TEXT NOT NULL, recommendation_key TEXT NOT NULL, PRIMARY KEY (membership_id, recommendation_key));
CREATE TABLE cleanup_batches (membership_id TEXT NOT NULL, batch_id TEXT NOT NULL, result_json TEXT NOT NULL, undone INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (membership_id, batch_id));
CREATE TABLE cleanup_cosmetics (membership_id TEXT NOT NULL, item_id TEXT NOT NULL, socket_index INTEGER NOT NULL, original_hash TEXT NOT NULL, applied_hash TEXT NOT NULL, PRIMARY KEY (membership_id, item_id, socket_index));
