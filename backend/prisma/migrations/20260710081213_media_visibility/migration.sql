-- CreateEnum
CREATE TYPE "MediaVisibility" AS ENUM ('PRIVATE', 'SHARED');

-- AlterTable
ALTER TABLE "media" ADD COLUMN     "visibility" "MediaVisibility" NOT NULL DEFAULT 'PRIVATE';

-- CreateIndex
CREATE INDEX "media_visibility_idx" ON "media"("visibility");
