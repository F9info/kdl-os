-- Migration: add_template_engine_dag
-- TEMPLATE_ENGINE_ARCH.md §4 — additive; no existing tables altered.
-- Gate: prisma validate exit 0; UP → DOWN → UP clean with row counts.

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('IN_PROGRESS', 'AWAITING_APPROVAL', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DagStage" AS ENUM ('INTAKE', 'PALETTE', 'INFERENCE', 'APPROVAL', 'GUIDELINES', 'COLLATERAL', 'WEBSITE', 'PREFLIGHT', 'EXPORT');

-- CreateEnum
CREATE TYPE "StageStatus" AS ENUM ('PENDING', 'RUNNING', 'AWAITING_INPUT', 'DONE', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "template_engine_runs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "brandKitVersion" INTEGER,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_engine_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_engine_stages" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stage" "DagStage" NOT NULL,
    "status" "StageStatus" NOT NULL DEFAULT 'PENDING',
    "errorCode" TEXT,
    "outputRef" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "template_engine_stages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "template_engine_runs_projectId_idx" ON "template_engine_runs"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "template_engine_stages_runId_stage_key" ON "template_engine_stages"("runId", "stage");

-- CreateIndex
CREATE INDEX "template_engine_stages_runId_idx" ON "template_engine_stages"("runId");

-- AddForeignKey
ALTER TABLE "template_engine_stages" ADD CONSTRAINT "template_engine_stages_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "template_engine_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
