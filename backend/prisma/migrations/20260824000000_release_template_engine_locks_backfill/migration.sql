-- Backfill: clear stale template-engine install-scoped locks from setting_fields.
-- With the new run-scoped lock guard (KDL-630) locks are acquired by the approval
-- driver and released when the run reaches a terminal state.  Any row locked by
-- a prior install-scoped seed is safe to clear; the next run re-acquires on the
-- fields it actually writes.
UPDATE "setting_fields"
SET "locked_by" = NULL
WHERE "locked_by" = 'template-engine';
