-- CreateEnum
CREATE TYPE "CustomBlockStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "custom_block_templates" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "category_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CustomBlockStatus" NOT NULL DEFAULT 'DRAFT',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL,
    "created_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_block_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_block_templates_project_id_category_key_idx" ON "custom_block_templates"("project_id", "category_key");
