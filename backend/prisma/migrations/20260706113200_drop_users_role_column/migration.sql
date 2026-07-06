-- Drop legacy role enum column from users table (Step 10)
-- Backup taken: backups/kdl_db_before_step10_20260706_113121.sql

ALTER TABLE "users" DROP COLUMN IF EXISTS "role";

DROP TYPE IF EXISTS "Role";
