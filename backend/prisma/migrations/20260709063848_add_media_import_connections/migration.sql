-- CreateTable
CREATE TABLE "media_import_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_import_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_import_connections_user_id_provider_idx" ON "media_import_connections"("user_id", "provider");
