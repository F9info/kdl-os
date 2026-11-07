-- A project's own theme values, on top of the install-wide base in setting_values.
-- No data is moved: existing values stay the base every project starts from.

-- AlterTable
ALTER TABLE "theme_value_versions" ADD COLUMN "project_id" TEXT;

-- CreateTable
CREATE TABLE "project_theme_values" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "field_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_theme_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "theme_value_versions_project_id_platform_type_id_created_at_idx" ON "theme_value_versions"("project_id", "platform", "type_id", "created_at");

-- CreateIndex
CREATE INDEX "project_theme_values_project_id_platform_idx" ON "project_theme_values"("project_id", "platform");

-- CreateIndex
CREATE INDEX "project_theme_values_field_id_idx" ON "project_theme_values"("field_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_theme_values_project_id_field_id_key" ON "project_theme_values"("project_id", "field_id");

-- AddForeignKey
ALTER TABLE "project_theme_values" ADD CONSTRAINT "project_theme_values_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_theme_values" ADD CONSTRAINT "project_theme_values_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "setting_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;
