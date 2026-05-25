-- Time-limited resources. Stored as TEXT 'YYYY-MM-DD' so date-only
-- comparison is timezone-free and indexable. NULL means no expiration.
ALTER TABLE entries ADD COLUMN expires_at TEXT;

CREATE INDEX IF NOT EXISTS idx_entries_expires ON entries(expires_at);

UPDATE snapshot_version SET version = version + 1 WHERE id = 1;
