import { prisma } from '../../config/database.js';

// The Events module ships no demo rows: events come from an admin or from a chapter sync, and the
// GDG chapter preset (scripts/gdg-chapter-preset.mjs) sets the sync up for a project.
export async function seedEvents(_prismaClient = prisma) {
  console.log('events.seed: nothing to seed');
}
