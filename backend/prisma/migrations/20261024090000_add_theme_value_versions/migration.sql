-- CreateTable
CREATE TABLE "theme_value_versions" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "type_id" TEXT NOT NULL,
    "snapshot" TEXT NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "theme_value_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "theme_value_versions_platform_type_id_created_at_idx" ON "theme_value_versions"("platform", "type_id", "created_at");
