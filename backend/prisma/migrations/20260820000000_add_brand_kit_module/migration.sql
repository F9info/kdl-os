-- CreateEnum
CREATE TYPE "brand_kit_status" AS ENUM ('draft', 'extracted', 'inferred', 'approved');

-- CreateTable
CREATE TABLE "brand_kits" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "status" "brand_kit_status" NOT NULL DEFAULT 'draft',
    "logo_media_id" TEXT,
    "logo_raster_media_id" TEXT,
    "logo_original_path" TEXT,
    "logo_original_expires_at" TIMESTAMP(3),
    "palette" JSONB,
    "contrast_report" JSONB,
    "typography" JSONB,
    "tone" JSONB,
    "inference_source" TEXT,
    "fallback_reason" TEXT,
    "overridden_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "acknowledged_contrast_adjustments" BOOLEAN NOT NULL DEFAULT false,
    "guidelines_pdf_media_id" TEXT,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_kits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brand_kits_project_id_key" ON "brand_kits"("project_id");

-- CreateIndex
CREATE INDEX "brand_kits_project_id_idx" ON "brand_kits"("project_id");

-- CreateIndex
CREATE INDEX "brand_kits_status_idx" ON "brand_kits"("status");

-- CreateIndex
CREATE INDEX "brand_kits_logo_original_expires_at_idx" ON "brand_kits"("logo_original_expires_at");
