-- CreateEnum
CREATE TYPE "SiteType" AS ENUM ('WEBSITE', 'LANDING');

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type" "SiteType" NOT NULL DEFAULT 'WEBSITE',
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "builder_pages" ADD COLUMN     "site_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "sites_domain_key" ON "sites"("domain");

-- CreateIndex
CREATE INDEX "sites_project_id_idx" ON "sites"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "sites_project_id_slug_key" ON "sites"("project_id", "slug");

-- CreateIndex
CREATE INDEX "builder_pages_site_id_idx" ON "builder_pages"("site_id");

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builder_pages" ADD CONSTRAINT "builder_pages_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: one default WEBSITE site per live project, then point that project's pages at it.
-- Idempotent only because this migration runs once; no existing page or project row is changed
-- apart from builder_pages.site_id.
INSERT INTO "sites" ("id", "project_id", "type", "slug", "name", "is_default", "updated_at")
SELECT 'site_' || md5(p."id" || clock_timestamp()::text), p."id", 'WEBSITE', 'main', p."name", true, CURRENT_TIMESTAMP
FROM "projects" p
WHERE p."deleted_at" IS NULL;

UPDATE "builder_pages" bp
SET "site_id" = s."id"
FROM "sites" s
WHERE s."project_id" = bp."project_id" AND s."is_default";
