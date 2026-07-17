-- CreateTable
CREATE TABLE "setting_values" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "field_id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "setting_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "setting_values_field_id_key" ON "setting_values"("field_id");

-- CreateIndex
CREATE INDEX "setting_values_platform_idx" ON "setting_values"("platform");

-- AddForeignKey
ALTER TABLE "setting_values" ADD CONSTRAINT "setting_values_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "setting_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;
