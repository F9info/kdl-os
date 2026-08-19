-- Migration: add_collateral_module
-- COLLATERAL_SPEC.md (KDL-452 / KDL-505) §5 — additive; no existing tables altered.
-- Gate: prisma validate exit 0; UP → DOWN → UP clean with row counts posted in PR.

-- CreateEnum
CREATE TYPE "CollateralType" AS ENUM ('VISITING_CARD', 'LETTERHEAD', 'TSHIRT', 'ID_CARD');

-- CreateEnum
CREATE TYPE "CollateralStatus" AS ENUM ('DRAFT', 'READY', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RenderFormat" AS ENUM ('PDF_PRINT', 'PDF_DIGITAL', 'DOCX', 'PNG');

-- CreateTable
CREATE TABLE "collateral_assets" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type" "CollateralType" NOT NULL,
    "name" TEXT NOT NULL,
    "brand_kit_version" INTEGER NOT NULL,
    "spec" JSONB NOT NULL,
    "status" "CollateralStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collateral_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "collateral_assets_project_id_type_idx" ON "collateral_assets"("project_id", "type");

-- CreateTable
CREATE TABLE "collateral_renders" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "format" "RenderFormat" NOT NULL,
    "variant" TEXT,
    "file_url" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "brand_kit_version" INTEGER NOT NULL,
    "credits_cost" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collateral_renders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "collateral_renders_asset_id_format_idx" ON "collateral_renders"("asset_id", "format");

-- AddForeignKey
ALTER TABLE "collateral_renders" ADD CONSTRAINT "collateral_renders_asset_id_fkey"
    FOREIGN KEY ("asset_id") REFERENCES "collateral_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DOWN (migration reversal)
-- DROP INDEX "collateral_renders_asset_id_format_idx";
-- DROP TABLE "collateral_renders";
-- DROP INDEX "collateral_assets_project_id_type_idx";
-- DROP TABLE "collateral_assets";
-- DROP TYPE "RenderFormat";
-- DROP TYPE "CollateralStatus";
-- DROP TYPE "CollateralType";
