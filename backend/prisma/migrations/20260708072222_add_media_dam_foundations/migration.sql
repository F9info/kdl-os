-- CreateEnum
CREATE TYPE "MediaMetaFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'SELECT');

-- AlterTable
ALTER TABLE "media" ADD COLUMN     "checksum" TEXT,
ADD COLUMN     "exif" JSONB,
ADD COLUMN     "is_archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_used_at" TIMESTAMP(3),
ADD COLUMN     "scan_result" TEXT,
ADD COLUMN     "scanned_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "media_tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_tag_pivot" (
    "media_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "media_tag_pivot_pkey" PRIMARY KEY ("media_id","tag_id")
);

-- CreateTable
CREATE TABLE "media_meta_fields" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "field_type" "MediaMetaFieldType" NOT NULL DEFAULT 'TEXT',
    "options" JSONB,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_meta_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_meta_values" (
    "media_id" TEXT NOT NULL,
    "field_id" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "media_meta_values_pkey" PRIMARY KEY ("media_id","field_id")
);

-- CreateTable
CREATE TABLE "media_collections" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_by" TEXT,
    "is_smart" BOOLEAN NOT NULL DEFAULT false,
    "rules" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_collection_items" (
    "collection_id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_collection_items_pkey" PRIMARY KEY ("collection_id","media_id")
);

-- CreateTable
CREATE TABLE "media_favorites" (
    "user_id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_favorites_pkey" PRIMARY KEY ("user_id","media_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_tags_name_key" ON "media_tags"("name");

-- CreateIndex
CREATE INDEX "media_tag_pivot_tag_id_idx" ON "media_tag_pivot"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_meta_fields_slug_key" ON "media_meta_fields"("slug");

-- CreateIndex
CREATE INDEX "media_meta_values_field_id_idx" ON "media_meta_values"("field_id");

-- CreateIndex
CREATE INDEX "media_collections_created_by_idx" ON "media_collections"("created_by");

-- CreateIndex
CREATE INDEX "media_collection_items_media_id_idx" ON "media_collection_items"("media_id");

-- CreateIndex
CREATE INDEX "media_favorites_media_id_idx" ON "media_favorites"("media_id");

-- CreateIndex
CREATE INDEX "media_checksum_idx" ON "media"("checksum");

-- CreateIndex
CREATE INDEX "media_last_used_at_idx" ON "media"("last_used_at");

-- AddForeignKey
ALTER TABLE "media_tag_pivot" ADD CONSTRAINT "media_tag_pivot_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_tag_pivot" ADD CONSTRAINT "media_tag_pivot_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "media_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_meta_values" ADD CONSTRAINT "media_meta_values_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_meta_values" ADD CONSTRAINT "media_meta_values_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "media_meta_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_collection_items" ADD CONSTRAINT "media_collection_items_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "media_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_collection_items" ADD CONSTRAINT "media_collection_items_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_favorites" ADD CONSTRAINT "media_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_favorites" ADD CONSTRAINT "media_favorites_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
