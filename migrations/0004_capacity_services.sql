-- Structured capacity status + services tags.
-- Both default-backfill existing rows so this is safe to run on a populated DB.

ALTER TABLE entries ADD COLUMN capacity_status TEXT NOT NULL DEFAULT 'unknown'
  CHECK (capacity_status IN ('open', 'limited', 'full', 'closed', 'unknown'));

ALTER TABLE entries ADD COLUMN services TEXT NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_entries_capacity ON entries(capacity_status);

UPDATE snapshot_version SET version = version + 1 WHERE id = 1;
