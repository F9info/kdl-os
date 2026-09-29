-- AlterTable
ALTER TABLE "builder_pages" ADD COLUMN     "entity_id" TEXT,
ADD COLUMN     "template_id" TEXT;

-- CreateTable
CREATE TABLE "detail_page_templates" (
    "id" TEXT NOT NULL,
    "project_id" TEXT,
    "type_key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "detail_page_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "detail_page_templates_project_id_type_key_key" ON "detail_page_templates"("project_id", "type_key");

-- CreateIndex
CREATE INDEX "builder_pages_template_id_idx" ON "builder_pages"("template_id");
