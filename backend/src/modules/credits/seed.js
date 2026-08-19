import { prisma } from '../../config/database.js';

const SETTINGS = [
  { key: 'credits.usd_per_credit', value: '0.01', type: 'string', description: 'USD equivalent of 1 credit (metering conversion)' },
  { key: 'credits.hold_ttl_seconds', value: '900', type: 'number', description: 'Seconds before a PENDING hold expires' },
  { key: 'credits.max_overage_pct', value: '25', type: 'number', description: 'Max overage % before settle_overage alert fires' },
];

export async function seedCredits(prismaClient = prisma) {
  for (const s of SETTINGS) {
    await prismaClient.appSetting.upsert({
      where: { key: s.key },
      create: s,
      update: {},
    });
  }
  console.log('credits.seed: AppSettings upserted');
}
