/**
 * Backfill: grant starter credits to projects that have no credit_balances row.
 *
 * Covers projects created before KDL-598 was fixed. Idempotent — safe to
 * re-run. The seed amount matches createProject logic:
 *   PROJECT_STARTER_CREDITS env var → credits.new_project_seed_mc app setting
 *   → 10_000_000 µc (10 credits) default.
 *
 * Usage:
 *   node backend/scripts/backfill-project-credits.mjs [--dry-run]
 */

import { PrismaClient } from '@prisma/client';

const DRY_RUN = process.argv.includes('--dry-run');
const DEFAULT_SEED_MC = 10_000_000n;

const prisma = new PrismaClient();

async function getSeedMc() {
  const envVal = process.env.PROJECT_STARTER_CREDITS;
  if (envVal !== undefined && envVal !== '') {
    try {
      const parsed = BigInt(envVal.trim());
      if (parsed > 0n) return parsed;
    } catch { /* fall through */ }
  }
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: 'credits.new_project_seed_mc' } });
    const v = row ? BigInt(row.value) : DEFAULT_SEED_MC;
    return v > 0n ? v : DEFAULT_SEED_MC;
  } catch {
    return DEFAULT_SEED_MC;
  }
}

async function main() {
  console.log(`backfill-project-credits: dry-run=${DRY_RUN}`);

  const seedMc = await getSeedMc();
  console.log(`Seed amount: ${seedMc} µc (${Number(seedMc) / 1_000_000} credits)`);

  // Find projects with no credit_balances row.
  const projectsWithBalance = await prisma.creditBalance.findMany({
    select: { project_id: true },
  });
  const withBalance = new Set(projectsWithBalance.map((r) => r.project_id));

  const allProjects = await prisma.project.findMany({
    where: { deleted_at: null },
    select: { id: true, name: true },
  });

  const missing = allProjects.filter((p) => !withBalance.has(p.id));
  console.log(`${missing.length} project(s) have no credit balance row.`);

  let seeded = 0;
  for (const proj of missing) {
    if (!DRY_RUN) {
      await prisma.$transaction(async (tx) => {
        await tx.creditBalance.create({ data: { project_id: proj.id, balance_mc: seedMc } });
        await tx.creditLedgerEntry.create({
          data: {
            project_id: proj.id,
            entry_type: 'GRANT',
            amount_mc: seedMc,
            balance_after_mc: seedMc,
            source: 'system',
            reason: 'backfill_project_seed',
            idempotency_key: `backfill_project_seed:${proj.id}`,
          },
        });
      });
    }
    console.log(`  [${DRY_RUN ? 'DRY' : 'SEEDED'}] project ${proj.id} (${proj.name})`);
    seeded++;
  }

  console.log(`Done. ${seeded} project(s) ${DRY_RUN ? 'would be' : 'were'} seeded with ${seedMc} µc.`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
