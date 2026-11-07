-- T10: template and theme library tables. Built-in rows are inserted by the application (never overwritten).
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'LANDING',
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "data" JSONB NOT NULL,
    "has_form" BOOLEAN NOT NULL DEFAULT false,
    "builtin" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "templates_key_key" ON "templates"("key");
CREATE INDEX "templates_kind_idx" ON "templates"("kind");

CREATE TABLE "theme_presets" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "light" JSONB NOT NULL,
    "dark" JSONB NOT NULL,
    "builtin" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "theme_presets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "theme_presets_key_key" ON "theme_presets"("key");
