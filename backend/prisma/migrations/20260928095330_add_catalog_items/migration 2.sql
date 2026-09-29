-- CreateTable
CREATE TABLE "catalog_items" (
    "id" TEXT NOT NULL,
    "project_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "image" TEXT,
    "brand_tag" TEXT,
    "detail_page_id" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "catalog_items_project_id_idx" ON "catalog_items"("project_id");
