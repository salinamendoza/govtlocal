-- Offline-first additions:
--   hazard_zones    GeoJSON polygons + severity, for evacuation/shelter messaging
--   updates         EOC-style timestamped headlines pushed to all clients
--   reports         Anonymous resident submissions (need_help, status_report, resource_full)
--   snapshot_version Single-row counter bumped on any change that affects the public snapshot

CREATE TABLE IF NOT EXISTS hazard_zones (
  id TEXT PRIMARY KEY,
  geojson TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('evacuate', 'shelter_in_place', 'advisory')),
  message TEXT,
  updated_at INTEGER NOT NULL,
  archived_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_hazard_zones_active ON hazard_zones(archived_at);

CREATE TABLE IF NOT EXISTS updates (
  id TEXT PRIMARY KEY,
  headline TEXT NOT NULL,
  body TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'advisory', 'urgent', 'critical')),
  posted_at INTEGER NOT NULL,
  archived_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_updates_posted ON updates(posted_at DESC);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('need_help', 'status_report', 'resource_full', 'other')),
  payload TEXT NOT NULL,
  client_timestamp INTEGER,
  received_at INTEGER NOT NULL,
  submitter_ip TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'triaged', 'resolved', 'dismissed'))
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, received_at DESC);

CREATE TABLE IF NOT EXISTS snapshot_version (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL
);

INSERT OR IGNORE INTO snapshot_version (id, version) VALUES (1, 1);

-- Bump version automatically when hazard_zones or updates change. Entry
-- writes are bumped explicitly in code so we only bump when the public
-- (approved) snapshot would actually change.

CREATE TRIGGER IF NOT EXISTS bump_version_hz_ai AFTER INSERT ON hazard_zones BEGIN
  UPDATE snapshot_version SET version = version + 1 WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS bump_version_hz_au AFTER UPDATE ON hazard_zones BEGIN
  UPDATE snapshot_version SET version = version + 1 WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS bump_version_hz_ad AFTER DELETE ON hazard_zones BEGIN
  UPDATE snapshot_version SET version = version + 1 WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS bump_version_up_ai AFTER INSERT ON updates BEGIN
  UPDATE snapshot_version SET version = version + 1 WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS bump_version_up_au AFTER UPDATE ON updates BEGIN
  UPDATE snapshot_version SET version = version + 1 WHERE id = 1;
END;
CREATE TRIGGER IF NOT EXISTS bump_version_up_ad AFTER DELETE ON updates BEGIN
  UPDATE snapshot_version SET version = version + 1 WHERE id = 1;
END;
