-- T05b: nullable project tag on media. No backfill: null means "visible in every project".
ALTER TABLE "media" ADD COLUMN "project_id" TEXT;
CREATE INDEX "media_project_id_idx" ON "media"("project_id");
