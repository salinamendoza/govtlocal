-- Privacy: stop persisting submitter IPs.
-- Abuse defense moves to ephemeral KV with hashed (HMAC + server pepper)
-- keys; nothing IP-derived is retained beyond a short TTL.

ALTER TABLE entries DROP COLUMN submitter_ip;
ALTER TABLE reports DROP COLUMN submitter_ip;
