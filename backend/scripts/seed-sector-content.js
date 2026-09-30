#!/usr/bin/env node
/**
 * Re-apply the client-approved Subhadra Group sector page content
 * (backend/src/modules/sectors/seed-data/subhadra-sector-content.json) onto
 * each sector's real BuilderPage. Idempotent — safe to re-run any time the
 * template page (Showrooms) or the approved content JSON changes.
 *
 * Usage:
 *   node scripts/seed-sector-content.js
 */
import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { seedSubhadraSectorContent } from '../src/modules/sectors/seed-content.js';

await seedSubhadraSectorContent(prisma);
await prisma.$disconnect();
