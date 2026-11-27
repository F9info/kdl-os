-- CreateTable
CREATE TABLE "devfest_editions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "theme" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "venue" TEXT,
    "venue_address" TEXT,
    "map_url" TEXT,
    "ticket_url" TEXT,
    "cfp_url" TEXT,
    "cfp_closes" TIMESTAMP(3),
    "tracks" JSONB NOT NULL DEFAULT '[]',
    "stats" JSONB NOT NULL DEFAULT '[]',
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devfest_editions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devfest_speakers" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "edition_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "photo_url" TEXT,
    "role" TEXT,
    "company" TEXT,
    "bio" TEXT,
    "links" JSONB NOT NULL DEFAULT '{}',
    "badges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devfest_speakers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devfest_sessions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "edition_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "abstract" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'talk',
    "track" TEXT,
    "level" TEXT,
    "room" TEXT,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "speaker_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "slides_url" TEXT,
    "video_url" TEXT,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devfest_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devfest_sponsors" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "edition_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo_url" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'partner',
    "url" TEXT,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devfest_sponsors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devfest_team_members" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "edition_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "photo_url" TEXT,
    "url" TEXT,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devfest_team_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "devfest_editions_project_id_year_key" ON "devfest_editions"("project_id", "year");

-- CreateIndex
CREATE INDEX "devfest_speakers_project_id_idx" ON "devfest_speakers"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "devfest_speakers_edition_id_slug_key" ON "devfest_speakers"("edition_id", "slug");

-- CreateIndex
CREATE INDEX "devfest_sessions_project_id_idx" ON "devfest_sessions"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "devfest_sessions_edition_id_slug_key" ON "devfest_sessions"("edition_id", "slug");

-- CreateIndex
CREATE INDEX "devfest_sponsors_project_id_idx" ON "devfest_sponsors"("project_id");

-- CreateIndex
CREATE INDEX "devfest_team_members_project_id_idx" ON "devfest_team_members"("project_id");

-- AddForeignKey
ALTER TABLE "devfest_speakers" ADD CONSTRAINT "devfest_speakers_edition_id_fkey" FOREIGN KEY ("edition_id") REFERENCES "devfest_editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devfest_sessions" ADD CONSTRAINT "devfest_sessions_edition_id_fkey" FOREIGN KEY ("edition_id") REFERENCES "devfest_editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devfest_sponsors" ADD CONSTRAINT "devfest_sponsors_edition_id_fkey" FOREIGN KEY ("edition_id") REFERENCES "devfest_editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devfest_team_members" ADD CONSTRAINT "devfest_team_members_edition_id_fkey" FOREIGN KEY ("edition_id") REFERENCES "devfest_editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
