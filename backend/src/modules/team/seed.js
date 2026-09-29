import { prisma } from '../../config/database.js';

// Real Subhadra Group leadership from after-delete-folder/about.html's
// Founder Profile section, attached to the specific Subhadra project already
// running in this environment (not a generic reference project — this
// module has no demo/default seed data of its own beyond this one client).
const SUBHADRA_PROJECT_ID = 'cmt15bmts000401s6fn5ydhzp';

const MEMBERS = [
  {
    project_id: SUBHADRA_PROJECT_ID,
    name: 'K Leela Prasad',
    role: 'Founder, Subhadra Group',
    bio: 'A practicing MEP consultant since 1983, K Leela Prasad has planned electrical, HVAC, safety and building-engineering solutions across Visakhapatnam for over four decades — and founded Subhadra Group in 1996.',
    photo_url: '/seed/subhadra/founder.png',
    order: 0,
  },
  {
    project_id: SUBHADRA_PROJECT_ID,
    name: 'K N V Uday Kumar',
    role: 'Director, Subhadra Group',
    bio: 'A gold medalist engineering graduate from REC Warangal, K N V Uday Kumar brings 15+ years experience in HVAC, automation, AV and networking design to Subhadra Group.',
    photo_url: '/seed/subhadra/products/director.png',
    order: 1,
  },
];

export async function seedTeam(prismaClient = prisma) {
  for (const member of MEMBERS) {
    const existing = await prismaClient.teamMember.findFirst({
      where: { project_id: member.project_id, name: member.name },
      select: { id: true },
    });
    if (existing) continue;
    await prismaClient.teamMember.create({ data: member });
  }
}
