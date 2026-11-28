-- CreateEnum
CREATE TYPE "LayoutKind" AS ENUM ('TOP_HEADER', 'HEADER', 'FOOTER');

-- CreateEnum
CREATE TYPE "LayoutStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "builder_pages" ADD COLUMN     "footer_layout_id" TEXT,
ADD COLUMN     "header_layout_id" TEXT;

-- CreateTable
CREATE TABLE "layout_presets" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "kind" "LayoutKind" NOT NULL,
    "name" TEXT NOT NULL,
    "status" "LayoutStatus" NOT NULL DEFAULT 'DRAFT',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "variant" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "layout_presets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "layout_presets_project_id_kind_idx" ON "layout_presets"("project_id", "kind");

-- CreateIndex
CREATE INDEX "builder_pages_header_layout_id_idx" ON "builder_pages"("header_layout_id");

-- CreateIndex
CREATE INDEX "builder_pages_footer_layout_id_idx" ON "builder_pages"("footer_layout_id");

-- AddForeignKey
ALTER TABLE "builder_pages" ADD CONSTRAINT "builder_pages_header_layout_id_fkey" FOREIGN KEY ("header_layout_id") REFERENCES "layout_presets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builder_pages" ADD CONSTRAINT "builder_pages_footer_layout_id_fkey" FOREIGN KEY ("footer_layout_id") REFERENCES "layout_presets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

