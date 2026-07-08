-- AlterTable
ALTER TABLE "media" ADD COLUMN     "transcript" JSONB,
ADD COLUMN     "transcript_lang" TEXT,
ADD COLUMN     "transcript_text" TEXT;
