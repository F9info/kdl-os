import { prisma } from '../../config/database.js';

export async function seedCatalog(prismaClient = prisma) {
  // TODO: add idempotent seed data for Catalog
  console.log('catalog.seed: no seed data defined');
}
