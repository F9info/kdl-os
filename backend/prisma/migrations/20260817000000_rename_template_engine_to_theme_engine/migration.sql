-- KDL-438: Rename Template Engine module → Theme Engine (KDL-437).
-- Forward + rollback in one migration, same transaction.
--
-- Phase B checklist:
--   B1: modules row slug/name rename
--   B2: permissions template-engine:* → theme-engine:* + role_permissions join rows
--   B3: owner_module on types/categories/setting_fields (expected 86/902/3910 rows)
--   B4: app_settings keys template_engine.* → theme_engine.*
--
-- activity_log rows with module='template-engine' are HISTORY — left untouched.
-- They record real past events and must not be silently rewritten. A reader
-- seeing 'template-engine' in old log rows should understand that was the
-- module's former identity (see DECISIONS.md D3).
--
-- ROLLBACK section is at the end — to roll back, execute the DOWN block manually
-- or use `prisma migrate resolve --rolled-back` on a restore point.

BEGIN;

-- ── B1: modules row ──────────────────────────────────────────────────────────
UPDATE "modules"
SET
  "slug"        = 'theme-engine',
  "name"        = 'Theme Engine',
  "updated_at"  = NOW()
WHERE "slug" = 'template-engine';

-- ── B2: permission_modules row ───────────────────────────────────────────────
UPDATE "permission_modules"
SET
  "name"  = 'theme-engine',
  "label" = 'Theme Engine'
WHERE "name" = 'template-engine';

-- B2: permissions rows (template-engine:view → theme-engine:view, etc.)
-- The permission module_id FK follows the permission_modules row above; only
-- the action column distinguishes rows. No action rename needed — only the
-- module_id foreign key row changed name. Prisma resolves by module_id, not
-- by concatenated "module:action" string. No permission rows need changing.
-- (Permission rows carry module_id FK; their text identity is (module_id, action)
-- not the old "template-engine:view" string. The module row rename above is
-- sufficient to update all derived permission slugs.)

-- ── B3: owner_module on types/categories/setting_fields ─────────────────────
UPDATE "types"
SET "owner_module" = 'theme-engine'
WHERE "owner_module" = 'template-engine';

UPDATE "categories"
SET "owner_module" = 'theme-engine'
WHERE "owner_module" = 'template-engine';

UPDATE "setting_fields"
SET "owner_module" = 'theme-engine'
WHERE "owner_module" = 'template-engine';

-- ── B4: app_settings keys ────────────────────────────────────────────────────
-- tokens_public flag
UPDATE "app_settings"
SET "key" = 'theme_engine.tokens_public'
WHERE "key" = 'template_engine.tokens_public';

-- active theme per platform (5 platforms: webapp, webapp_admin, tv, android, ios)
UPDATE "app_settings"
SET "key" = REPLACE("key", 'template_engine.active_theme.', 'theme_engine.active_theme.')
WHERE "key" LIKE 'template_engine.active_theme.%';

COMMIT;

-- ── ROLLBACK (execute this block manually to reverse the migration) ──────────
-- BEGIN;
--
-- UPDATE "modules"
-- SET "slug" = 'template-engine', "name" = 'Template Engine', "updated_at" = NOW()
-- WHERE "slug" = 'theme-engine';
--
-- UPDATE "permission_modules"
-- SET "name" = 'template-engine', "label" = 'Template Engine'
-- WHERE "name" = 'theme-engine';
--
-- UPDATE "types"
-- SET "owner_module" = 'template-engine'
-- WHERE "owner_module" = 'theme-engine';
--
-- UPDATE "categories"
-- SET "owner_module" = 'template-engine'
-- WHERE "owner_module" = 'theme-engine';
--
-- UPDATE "setting_fields"
-- SET "owner_module" = 'template-engine'
-- WHERE "owner_module" = 'theme-engine';
--
-- UPDATE "app_settings"
-- SET "key" = 'template_engine.tokens_public'
-- WHERE "key" = 'theme_engine.tokens_public';
--
-- UPDATE "app_settings"
-- SET "key" = REPLACE("key", 'theme_engine.active_theme.', 'template_engine.active_theme.')
-- WHERE "key" LIKE 'theme_engine.active_theme.%';
--
-- COMMIT;
