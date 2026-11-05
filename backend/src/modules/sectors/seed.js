import { prisma } from '../../config/database.js';

export async function seedSectors(prismaClient = prisma) {
  // No demo sector data — the DemoLogo site has no sectors section.
  console.log('sectors.seed: no seed data defined');
}
