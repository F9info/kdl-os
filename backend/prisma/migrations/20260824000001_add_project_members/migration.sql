-- Migration: add_project_members (KDL-635)
-- Adds explicit is_shared flag to projects (replacing null-created_by convention).
-- Adds project_members join table (project_id, user_id, role) for multi-user collaboration.
-- Backfills the seeded Default Project with is_shared = true.

-- Add is_shared column to projects (default false for existing user-created projects)
ALTER TABLE "projects" ADD COLUMN "is_shared" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: mark every default project as org-shared (was previously implied by null created_by)
UPDATE "projects" SET "is_shared" = true WHERE "is_default" = true;

-- Create project_members join table
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- One membership row per (project, user) pair
CREATE UNIQUE INDEX "project_members_project_id_user_id_key" ON "project_members"("project_id", "user_id");

-- FK to projects table
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
