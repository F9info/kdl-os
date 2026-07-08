-- CreateTable
CREATE TABLE "media_versions" (
    "id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "checksum" TEXT,
    "created_by" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_versions_media_id_idx" ON "media_versions"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_versions_media_id_version_key" ON "media_versions"("media_id", "version");

-- AddForeignKey
ALTER TABLE "media_versions" ADD CONSTRAINT "media_versions_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
