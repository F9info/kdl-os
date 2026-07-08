-- CreateEnum
CREATE TYPE "MediaSuggestionType" AS ENUM ('TAGS', 'TITLE', 'DESCRIPTION', 'ALT_TEXT', 'SEO_KEYWORDS');

-- CreateEnum
CREATE TYPE "MediaSuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "media_suggestions" (
    "id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "type" "MediaSuggestionType" NOT NULL,
    "value" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ai',
    "status" "MediaSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_suggestions_media_id_status_idx" ON "media_suggestions"("media_id", "status");

-- AddForeignKey
ALTER TABLE "media_suggestions" ADD CONSTRAINT "media_suggestions_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
