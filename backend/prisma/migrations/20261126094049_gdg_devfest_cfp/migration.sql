-- AlterTable
ALTER TABLE "devfest_editions" ADD COLUMN     "cfp_open" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "devfest_proposals" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "edition_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT,
    "role" TEXT,
    "company" TEXT,
    "bio" TEXT NOT NULL,
    "photo_url" TEXT,
    "linkedin" TEXT,
    "website" TEXT,
    "title" TEXT NOT NULL,
    "abstract" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'talk',
    "track" TEXT,
    "level" TEXT,
    "notes" TEXT,
    "first_time" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'new',
    "review_note" TEXT,
    "speaker_id" TEXT,
    "session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devfest_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "devfest_proposals_edition_id_status_idx" ON "devfest_proposals"("edition_id", "status");

-- CreateIndex
CREATE INDEX "devfest_proposals_edition_id_email_idx" ON "devfest_proposals"("edition_id", "email");

-- AddForeignKey
ALTER TABLE "devfest_proposals" ADD CONSTRAINT "devfest_proposals_edition_id_fkey" FOREIGN KEY ("edition_id") REFERENCES "devfest_editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
