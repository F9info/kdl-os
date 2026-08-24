import { prisma } from '../../config/database.js';

const SETTINGS = [
  { key: 'credits.usd_per_credit', value: '0.01', type: 'string', description: 'USD equivalent of 1 credit (metering conversion)' },
  { key: 'credits.hold_ttl_seconds', value: '900', type: 'number', description: 'Seconds before a PENDING hold expires' },
  { key: 'credits.max_overage_pct', value: '25', type: 'number', description: 'Max overage % before settle_overage alert fires' },
  { key: 'credits.new_project_seed_mc', value: '100000000', type: 'number', description: 'µc auto-granted to every new project on creation (0 = disabled)' },
];

// NOTE (KDL-622): seedCredits() intentionally uses update:{} (create-only upsert).
// It is the initial seed — it must never silently overwrite an operator's deliberate
// setting change made after first deploy.  Any value-migration that must reach an
// already-provisioned database MUST be delivered as a Prisma data migration (see
// 20260822000000_backfill_credits_new_project_seed_mc).  That migration is the
// canonical source of truth for backfilling stale rows; this function is the
// canonical source of truth for the initial defaults on a brand-new database.
// This function is called by prisma/seed.js and is NOT called at app startup.
export async function seedCredits(prismaClient = prisma) {
  for (const s of SETTINGS) {
    await prismaClient.appSetting.upsert({
      where: { key: s.key },
      create: s,
      update: {}, // intentional: never overwrite post-deploy operator overrides
    });
  }
  console.log('credits.seed: AppSettings upserted');
}
