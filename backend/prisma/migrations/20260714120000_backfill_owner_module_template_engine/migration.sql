-- Backfill owner_module for Template Engine rows that were seeded BEFORE the
-- owner_module column existed (migration 20260714035014 added the column as
-- nullable but did NOT backfill, and `prisma migrate` does not re-run seeds).
-- Those legacy rows keep owner_module = NULL, so the "standalone only"
-- (owner_module IS NULL) filter still returns them and they flood the admin
-- sidebar. This one-time, idempotent data migration stamps them so they are
-- treated as module-owned (hidden from the generic Application-Settings UI).
--
-- Template Engine slugs are platform-prefixed: {platform}.{paneId}[...],
-- platform ∈ (webapp | tv | android | ios). Hand-created Application-Settings
-- Types never use those dotted platform prefixes, so this is safe and targeted.
-- Guarded by owner_module IS NULL, so it is a no-op on already-stamped rows.

UPDATE "types"
SET "owner_module" = 'template-engine'
WHERE "owner_module" IS NULL
  AND ("slug" LIKE 'webapp.%' OR "slug" LIKE 'tv.%' OR "slug" LIKE 'android.%' OR "slug" LIKE 'ios.%');

UPDATE "categories"
SET "owner_module" = 'template-engine'
WHERE "owner_module" IS NULL
  AND ("slug" LIKE 'webapp.%' OR "slug" LIKE 'tv.%' OR "slug" LIKE 'android.%' OR "slug" LIKE 'ios.%');

UPDATE "setting_fields"
SET "owner_module" = 'template-engine'
WHERE "owner_module" IS NULL
  AND ("slug" LIKE 'webapp.%' OR "slug" LIKE 'tv.%' OR "slug" LIKE 'android.%' OR "slug" LIKE 'ios.%');
