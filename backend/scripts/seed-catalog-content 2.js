#!/usr/bin/env node
/**
 * Create the client-approved Subhadra Group catalog items (backend/scripts/
 * seed-data/catalog-items-content.json) for a project — idempotent, only
 * creates items that don't exist yet by slug.
 *
 * Usage:
 *   node scripts/seed-catalog-content.js <projectId>
 */
import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { seedCatalogItems } from '../src/modules/catalog/seed-content.js';

const projectId = process.argv[2];
if (!projectId) {
  console.error('Usage: node scripts/seed-catalog-content.js <projectId>');
  process.exit(1);
}

const created = await seedCatalogItems(prisma, projectId);
console.log(`Created ${created} catalog item(s) for project ${projectId}.`);
await prisma.$disconnect();
