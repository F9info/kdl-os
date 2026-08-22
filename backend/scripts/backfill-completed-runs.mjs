/**
 * Backfill: flip IN_PROGRESS template-engine runs to COMPLETED when all 9
 * stages have reached a terminal state (DONE or SKIPPED).
 *
 * Fixes the two stuck runs reported in KDL-597 and any others in the same
 * state. Idempotent — safe to re-run.
 *
 * Usage:
 *   node backend/scripts/backfill-completed-runs.mjs [--dry-run]
 */

import { prisma } from '../src/config/database.js';

const DRY_RUN = process.argv.includes('--dry-run');
const TOTAL_STAGES = 9;
const TERMINAL = ['DONE', 'SKIPPED'];

async function main() {
  console.log(`backfill-completed-runs: dry-run=${DRY_RUN}`);

  const stuckRuns = await prisma.templateEngineRun.findMany({
    where: { status: 'IN_PROGRESS' },
    select: { id: true, projectId: true },
  });

  console.log(`Found ${stuckRuns.length} IN_PROGRESS runs to inspect.`);

  let fixed = 0;
  for (const run of stuckRuns) {
    const terminalCount = await prisma.templateEngineStage.count({
      where: { runId: run.id, status: { in: TERMINAL } },
    });

    if (terminalCount === TOTAL_STAGES) {
      if (!DRY_RUN) {
        await prisma.templateEngineRun.update({
          where: { id: run.id },
          data: { status: 'COMPLETED' },
        });
      }
      console.log(`  [${DRY_RUN ? 'DRY' : 'FIXED'}] run ${run.id} (project ${run.projectId})`);
      fixed++;
    }
  }

  console.log(`Done. ${fixed} run(s) ${DRY_RUN ? 'would be' : 'were'} marked COMPLETED.`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
