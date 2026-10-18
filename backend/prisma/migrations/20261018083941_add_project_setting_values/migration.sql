-- CreateTable
CREATE TABLE "project_setting_values" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "field_id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_setting_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_setting_values_field_id_idx" ON "project_setting_values"("field_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_setting_values_project_id_field_id_key" ON "project_setting_values"("project_id", "field_id");

-- AddForeignKey
ALTER TABLE "project_setting_values" ADD CONSTRAINT "project_setting_values_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_setting_values" ADD CONSTRAINT "project_setting_values_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "setting_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;
