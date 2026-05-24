-- Initial seed. Pre-approved so /help isn't empty on first deploy.
-- Add more via the admin UI at /admin.
--
-- Run once after migrations:
--   wrangler d1 execute emergency-resources --file=scripts/seed.sql --remote

INSERT OR IGNORE INTO entries (
  id, kind, category, title, description,
  url, phone, address, city, zip,
  contact_name, contact_email,
  status, created_at, updated_at, approved_at
) VALUES (
  'seed_gg_sportsrec',
  'resource',
  'Shelter',
  'Garden Grove Sports & Recreation Center',
  'Day-use shelter site. Not overnight.',
  NULL, NULL,
  '13641 Deodara Dr',
  'Garden Grove',
  NULL,
  NULL, NULL,
  'approved',
  unixepoch(),
  unixepoch(),
  unixepoch()
);

-- Bump snapshot version so clients pick up the seed on next poll.
UPDATE snapshot_version SET version = version + 1 WHERE id = 1;
