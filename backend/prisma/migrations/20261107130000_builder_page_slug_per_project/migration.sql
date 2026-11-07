-- A page slug is unique within a project, not across the whole installation, so two projects
-- can each have a "home" and an "about" page. Every page now belongs to a project.

-- Pages made from the admin before this change have no project: give them the default project
-- (what the old single-project behaviour meant).
UPDATE "builder_pages"
SET "project_id" = (
  SELECT "id" FROM "projects"
  WHERE "deleted_at" IS NULL
  ORDER BY "is_default" DESC, "created_at" ASC
  LIMIT 1
)
WHERE "project_id" IS NULL;

-- DropIndex
DROP INDEX "builder_pages_slug_key";

-- AlterTable
ALTER TABLE "builder_pages" ALTER COLUMN "project_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "builder_pages_project_id_slug_key" ON "builder_pages"("project_id", "slug");
