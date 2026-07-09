-- Reconciles migration history with the dev database: this migration was
-- already applied directly to the shared dev Postgres by an interrupted prior
-- Phase D7 session whose migration file never made it to disk/git. Recreated
-- verbatim (via information_schema introspection) so `prisma migrate dev`
-- stops reporting drift. See KDL-133 continuation notes.
ALTER TABLE "media" ADD COLUMN "barcodes" JSONB;
