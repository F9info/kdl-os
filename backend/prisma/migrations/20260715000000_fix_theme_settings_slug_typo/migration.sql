-- KDL-219 (parent KDL-218): correct the misspelled slug/name on the standalone
-- "Theme Settigns" Application-Settings type.
--
-- Origin of the typo: the row exists ONLY in the database (created by hand through
-- the Settings > Types admin UI). It is not produced by any seed script or slugify()
-- call, and it is absent from every seed/fixture/backup in the repo, so there is no
-- code literal to change and the typo cannot recur from a seed re-run.
--
-- Safe & idempotent:
--   * `types.slug` is @unique; 'theme-settings' does not already exist, so no collision.
--   * `categories` and `setting_fields` reference this type by `type_id` (FK to id),
--     never by slug, so the rename does not touch any association.
--   * Re-running matches zero rows once corrected.
UPDATE "types"
SET "slug"       = 'theme-settings',
    "name"       = 'Theme Settings',
    "updated_at" = NOW()
WHERE "slug" = 'theme-settigns';
