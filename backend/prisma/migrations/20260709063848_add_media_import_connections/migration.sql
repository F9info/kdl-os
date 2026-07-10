-- Reconciles migration history with the dev database: this migration (Phase
-- D8 — cloud import OAuth connections) was already applied directly to the
-- shared dev Postgres by another interrupted session whose migration file
-- never made it to disk/git. Recreated verbatim (via information_schema
-- introspection) so `prisma migrate dev` stops reporting drift. No Prisma
-- model is declared for this table yet — that is Phase D8 (KDL-122) scope,
-- not this migration's job.
CREATE TABLE "media_import_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_import_connections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "media_import_connections_user_id_provider_idx" ON "media_import_connections"("user_id", "provider");
