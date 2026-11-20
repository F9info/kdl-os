-- CreateTable
CREATE TABLE "chapter_events" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "source_id" TEXT,
    "title" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "venue" TEXT,
    "event_type" TEXT,
    "image_url" TEXT,
    "banner_url" TEXT,
    "register_url" TEXT,
    "page_url" TEXT,
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" TEXT,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapter_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapter_sync_settings" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "chapter_id" INTEGER,
    "chapter_slug" TEXT,
    "auto_sync" BOOLEAN NOT NULL DEFAULT true,
    "last_synced_at" TIMESTAMP(3),
    "last_result" JSONB,
    "members_count" INTEGER,
    "logo_url" TEXT,
    "team" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapter_sync_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chapter_events_project_id_start_date_idx" ON "chapter_events"("project_id", "start_date");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_events_project_id_source_source_id_key" ON "chapter_events"("project_id", "source", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_sync_settings_project_id_key" ON "chapter_sync_settings"("project_id");
