#!/usr/bin/env node
/**
 * Copies legacy brand data (brand-profile-* fields + the admin `logo` field) into
 * Application Identity (identity.* rows in app_settings).
 * Idempotent; never overwrites a non-empty identity value; never modifies legacy rows.
 *
 * Usage: node scripts/migrate-identity.js [--dry-run]
 */
import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import * as service from '../src/modules/identity/service.js';
import { runMigration } from '../src/modules/identity/migrate.js';

const dry = process.argv.includes('--dry-run');
let code = 0;
try {
  const { before, after, report } = await runMigration({ prisma, service, dry });
  console.log(`identity migration (${dry ? 'DRY RUN — nothing written' : 'applied'})`);
  console.log('copied:          ', report.copied.join(', ') || '-');
  console.log('skipped (exists):', report.skipped_existing.join(', ') || '-');
  console.log('skipped (invalid):', report.skipped_invalid.join(', ') || '-');
  console.log('unmapped legacy: ', report.unmapped.join(', ') || '-');
  for (const k of report.copied) console.log(`  ${k}: "${before[k]}" -> "${after[k]}"`);
} catch (err) {
  console.error('identity migration failed:', err.message);
  code = 1;
} finally {
  await prisma.$disconnect();
  process.exit(code); // redis client keeps the loop alive otherwise
}
