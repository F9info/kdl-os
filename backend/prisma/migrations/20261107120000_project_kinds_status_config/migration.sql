-- CreateEnum
CREATE TYPE "ProjectKind" AS ENUM ('ADMIN', 'WEBSITE', 'LANDING', 'STATIC');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "projects"
  ADD COLUMN "kinds" "ProjectKind"[] NOT NULL DEFAULT ARRAY['ADMIN']::"ProjectKind"[],
  ADD COLUMN "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "config" JSONB NOT NULL DEFAULT '{}';

-- Backfill: projects that exist today are already in use.
UPDATE "projects" SET "status" = 'ACTIVE';

-- Backfill: add the kinds the project already has, taken from its sites.
UPDATE "projects" p SET "kinds" = "kinds" || ARRAY['WEBSITE']::"ProjectKind"[]
WHERE EXISTS (SELECT 1 FROM "sites" s WHERE s."project_id" = p."id" AND s."type" = 'WEBSITE' AND s."deleted_at" IS NULL);

UPDATE "projects" p SET "kinds" = "kinds" || ARRAY['LANDING']::"ProjectKind"[]
WHERE EXISTS (SELECT 1 FROM "sites" s WHERE s."project_id" = p."id" AND s."type" = 'LANDING' AND s."deleted_at" IS NULL);
