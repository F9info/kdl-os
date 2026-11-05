-- CreateTable
CREATE TABLE "detail_page_types" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "nav_parent_label" TEXT NOT NULL,
    "slug_prefix" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "detail_page_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detail_page_entries" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "body" TEXT,
    "image" TEXT,
    "detail_page_id" TEXT,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "detail_page_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "detail_page_types_project_id_type_key_key" ON "detail_page_types"("project_id", "type_key");

-- CreateIndex
CREATE UNIQUE INDEX "detail_page_types_project_id_slug_prefix_key" ON "detail_page_types"("project_id", "slug_prefix");

-- CreateIndex
CREATE INDEX "detail_page_entries_project_id_type_key_idx" ON "detail_page_entries"("project_id", "type_key");

-- CreateIndex
CREATE UNIQUE INDEX "detail_page_entries_project_id_type_key_slug_key" ON "detail_page_entries"("project_id", "type_key", "slug");
