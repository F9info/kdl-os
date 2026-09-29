-- CreateTable
CREATE TABLE "work_categories" (
    "id" TEXT NOT NULL,
    "project_id" TEXT,
    "eyebrow" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "subtitle" TEXT,
    "image" TEXT,
    "detail_page_id" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_categories_project_id_idx" ON "work_categories"("project_id");
