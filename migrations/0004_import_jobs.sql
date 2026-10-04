CREATE TABLE import_jobs (
  id TEXT PRIMARY KEY, asset_id TEXT, source_key TEXT NOT NULL,
  source_name TEXT NOT NULL, metadata TEXT NOT NULL CHECK (json_valid(metadata)),
  preview_key TEXT, poster_key TEXT,
  state TEXT NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','converting','saving','ready','failed')),
  result_id TEXT, warnings TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(warnings)),
  error TEXT NOT NULL DEFAULT '', attempts INTEGER NOT NULL DEFAULT 0,
  elapsed_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX import_jobs_state ON import_jobs(state, created_at DESC);
