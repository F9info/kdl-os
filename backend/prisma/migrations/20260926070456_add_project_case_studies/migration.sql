-- CreateTable
CREATE TABLE "project_case_studies" (
    "id" TEXT NOT NULL,
    "project_id" TEXT,
    "title" TEXT NOT NULL,
    "eyebrow" TEXT,
    "tags" TEXT,
    "image" TEXT,
    "description" TEXT,
    "cta_label" TEXT,
    "cta_href" TEXT,
    "link_label" TEXT,
    "link_href" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_case_studies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_case_studies_project_id_idx" ON "project_case_studies"("project_id");
