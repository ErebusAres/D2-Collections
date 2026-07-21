CREATE TABLE IF NOT EXISTS xur_inventory_snapshot (
  snapshot_key TEXT PRIMARY KEY CHECK(snapshot_key = 'latest'),
  captured_at TEXT NOT NULL,
  next_refresh_at TEXT,
  offers_json TEXT NOT NULL
);
