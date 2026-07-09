-- CreateEnum
CREATE TYPE "MediaWorkflowStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED', 'EXPIRED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "media" ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "published_at" TIMESTAMP(3),
ADD COLUMN     "workflow_status" "MediaWorkflowStatus" NOT NULL DEFAULT 'PUBLISHED';

-- CreateTable
CREATE TABLE "media_shares" (
    "id" TEXT NOT NULL,
    "media_id" TEXT,
    "folder_id" TEXT,
    "token" TEXT NOT NULL,
    "password_hash" TEXT,
    "expires_at" TIMESTAMP(3),
    "max_downloads" INTEGER,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_comments" (
    "id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_shares_token_key" ON "media_shares"("token");

-- CreateIndex
CREATE INDEX "media_shares_token_idx" ON "media_shares"("token");

-- CreateIndex
CREATE INDEX "media_shares_media_id_idx" ON "media_shares"("media_id");

-- CreateIndex
CREATE INDEX "media_shares_folder_id_idx" ON "media_shares"("folder_id");

-- CreateIndex
CREATE INDEX "media_shares_created_by_idx" ON "media_shares"("created_by");

-- CreateIndex
CREATE INDEX "media_shares_expires_at_idx" ON "media_shares"("expires_at");

-- CreateIndex
CREATE INDEX "media_comments_media_id_idx" ON "media_comments"("media_id");

-- CreateIndex
CREATE INDEX "media_comments_user_id_idx" ON "media_comments"("user_id");

-- CreateIndex
CREATE INDEX "media_workflow_status_idx" ON "media"("workflow_status");

-- CreateIndex
CREATE INDEX "media_expires_at_idx" ON "media"("expires_at");

-- AddForeignKey
ALTER TABLE "media_shares" ADD CONSTRAINT "media_shares_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_shares" ADD CONSTRAINT "media_shares_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "media_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_shares" ADD CONSTRAINT "media_shares_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_comments" ADD CONSTRAINT "media_comments_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_comments" ADD CONSTRAINT "media_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
