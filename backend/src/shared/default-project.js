import { prisma } from '../config/database.js';

// Demo/sample seeds attach to the project whose slug is 'default' (looked up,
// never hard-coded by id). Returns null when it doesn't exist yet.
export async function getDefaultProjectId(client = prisma) {
  const project = await client.project.findFirst({ where: { slug: 'default' }, select: { id: true } });
  return project?.id ?? null;
}
