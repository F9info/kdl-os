-- Migration: add_credits_module
-- CREDITS_ARCH.md (KDL-504) — additive; no existing tables altered.
-- Includes append-only trigger on credit_ledger_entries (§2) — first DB trigger in this repo.
-- Gate: prisma validate exit 0; UP → DOWN → UP clean with row counts posted in PR.

-- CreateEnum
CREATE TYPE "CreditEntryType" AS ENUM ('GRANT', 'RESERVE', 'SETTLE', 'RELEASE', 'EXPIRE', 'ADJUST');

-- CreateEnum
CREATE TYPE "CreditHoldStatus" AS ENUM ('PENDING', 'SETTLED', 'RELEASED', 'EXPIRED');

-- CreateTable: projects stub (minimal; full tenancy scoping in PROJECTS_ARCH build)
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

-- CreateTable
CREATE TABLE "credit_balances" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "balance_mc" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_balances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credit_balances_project_id_key" ON "credit_balances"("project_id");

-- AddForeignKey
ALTER TABLE "credit_balances" ADD CONSTRAINT "credit_balances_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "credit_holds" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "amount_mc" BIGINT NOT NULL,
    "status" "CreditHoldStatus" NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_holds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credit_holds_idempotency_key_key" ON "credit_holds"("idempotency_key");

-- CreateIndex
CREATE INDEX "credit_holds_project_id_status_idx" ON "credit_holds"("project_id", "status");

-- CreateIndex
CREATE INDEX "credit_holds_status_expires_at_idx" ON "credit_holds"("status", "expires_at");

-- AddForeignKey
ALTER TABLE "credit_holds" ADD CONSTRAINT "credit_holds_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "credit_ledger_entries" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "entry_type" "CreditEntryType" NOT NULL,
    "amount_mc" BIGINT NOT NULL,
    "balance_after_mc" BIGINT NOT NULL,
    "hold_id" TEXT,
    "source" TEXT NOT NULL,
    "reason" TEXT,
    "idempotency_key" TEXT,
    "actor_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credit_ledger_entries_idempotency_key_key" ON "credit_ledger_entries"("idempotency_key");

-- CreateIndex
CREATE INDEX "credit_ledger_entries_project_id_created_at_idx" ON "credit_ledger_entries"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "credit_ledger_entries_hold_id_idx" ON "credit_ledger_entries"("hold_id");

-- AddForeignKey
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_hold_id_fkey"
    FOREIGN KEY ("hold_id") REFERENCES "credit_holds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append-only trigger on credit_ledger_entries (CREDITS_ARCH §2).
-- First trigger in this repo — flagged as precedent in PR body.
CREATE OR REPLACE FUNCTION credits_ledger_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'credit_ledger_entries is append-only (% blocked)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER credit_ledger_entries_append_only
  BEFORE UPDATE OR DELETE ON credit_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION credits_ledger_append_only();

-- Revoke TRUNCATE from app role in production (no-op in dev where app connects as owner).
-- REVOKE TRUNCATE ON credit_ledger_entries FROM kdl_app;
