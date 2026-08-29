-- AlterTable
ALTER TABLE "builder_pages" ADD COLUMN     "project_id" TEXT;

-- CreateTable
CREATE TABLE "site_layouts" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "header" JSONB NOT NULL DEFAULT '{}',
    "footer" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_layouts_project_id_key" ON "site_layouts"("project_id");

-- CreateIndex
CREATE INDEX "builder_pages_project_id_idx" ON "builder_pages"("project_id");
