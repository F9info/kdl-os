-- AlterTable
ALTER TABLE "setting_fields" ADD COLUMN "locked_by" TEXT;

-- CreateIndex
CREATE INDEX "setting_fields_locked_by_idx" ON "setting_fields"("locked_by");
