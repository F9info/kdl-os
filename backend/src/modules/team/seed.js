import { prisma } from '../../config/database.js';
import { demoAccepted } from '../../shared/demo-content.js';
import { getDefaultProjectId } from '../../shared/default-project.js';

// Generic DemoLogo placeholder team for the default project.
const MEMBERS = [
  { name: 'Alex Morgan', role: 'Founder, DemoLogo', bio: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.', photo_url: '', order: 0 },
  { name: 'Sam Rivera', role: 'Creative Director, DemoLogo', bio: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.', photo_url: '', order: 1 },
];

export async function seedTeam(prismaClient = prisma) {
  // Sample content only after the owner said yes to a starter website.
  if (!(await demoAccepted(prismaClient))) return;
  const projectId = await getDefaultProjectId(prismaClient);
  if (!projectId) return;
  for (const member of MEMBERS) {
    const existing = await prismaClient.teamMember.findFirst({
      where: { project_id: projectId, name: member.name },
      select: { id: true },
    });
    if (existing) continue;
    await prismaClient.teamMember.create({ data: { ...member, project_id: projectId } });
  }
}
