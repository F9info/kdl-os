import { prisma } from '../../config/database.js';

export async function seedProjects(prismaClient = prisma) {
  const existing = await prismaClient.project.findFirst({ where: { is_default: true } });
  if (!existing) {
    await prismaClient.project.create({
      data: { name: 'Default Project', slug: 'default', is_default: true, is_shared: true },
    });
    console.log('projects.seed: default project created');
  } else {
    console.log('projects.seed: default project already exists, skipping');
  }
}

export default async function seed(tx) {
  const existing = await tx.project.findFirst({ where: { is_default: true } });
  if (!existing) {
    await tx.project.create({
      data: { name: 'Default Project', slug: 'default', is_default: true, is_shared: true },
    });
  }
}
