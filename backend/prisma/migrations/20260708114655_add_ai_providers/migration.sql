-- CreateEnum
CREATE TYPE "AiFeature" AS ENUM ('VISION', 'IMAGE_OPS', 'SPEECH_TO_TEXT');

-- CreateTable
CREATE TABLE "ai_providers" (
    "id" TEXT NOT NULL,
    "feature" "AiFeature" NOT NULL,
    "driver" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "config" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_providers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_providers_feature_is_active_idx" ON "ai_providers"("feature", "is_active");
