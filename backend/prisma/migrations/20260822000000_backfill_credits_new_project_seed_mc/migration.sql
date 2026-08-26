-- Data migration: KDL-618
-- Backfill credits.new_project_seed_mc from the stale 10,000,000 µc default
-- (set before KDL-613 raised it to 100,000,000) to the correct value.
--
-- Guard: only touches rows whose value is STILL the old default (10000000).
-- A row that an operator intentionally set to anything else — including a value
-- other than both 10000000 and 100000000 — is left untouched.
-- Idempotent: running a second time is a no-op because the WHERE no longer matches.

UPDATE "app_settings"
SET    "value"      = '100000000',
       "updated_at" = NOW()
WHERE  "key"   = 'credits.new_project_seed_mc'
  AND  "value" = '10000000';
