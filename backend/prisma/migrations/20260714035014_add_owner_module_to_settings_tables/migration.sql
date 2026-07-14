-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "owner_module" TEXT;

-- AlterTable
ALTER TABLE "setting_fields" ADD COLUMN     "owner_module" TEXT;

-- AlterTable
ALTER TABLE "types" ADD COLUMN     "owner_module" TEXT;

-- CreateIndex
CREATE INDEX "categories_owner_module_idx" ON "categories"("owner_module");

-- CreateIndex
CREATE INDEX "setting_fields_owner_module_idx" ON "setting_fields"("owner_module");

-- CreateIndex
CREATE INDEX "types_owner_module_idx" ON "types"("owner_module");
