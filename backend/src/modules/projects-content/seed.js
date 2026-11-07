import { prisma } from '../../config/database.js';
import { demoAccepted } from '../../shared/demo-content.js';
import { getDefaultProjectId } from '../../shared/default-project.js';

// Generic DemoLogo portfolio case studies for the default project (images are
// derived from the demo mockup under frontend/public/seed/demologo).
const CASE_STUDIES = [
  ['Business Website', 'Web Development', 'business-website'],
  ['Food Delivery App', 'Mobile App', 'food-delivery-app'],
  ['Admin Dashboard', 'Web Application', 'admin-dashboard'],
  ['Brand Identity', 'Branding', 'brand-identity'],
  ['Digital Campaign', 'Digital Marketing', 'digital-campaign'],
].map(([title, eyebrow, file]) => ({
  title,
  eyebrow,
  tags: 'Lorem ipsum, Dolor sit amet',
  image: `/seed/demologo/projects/${file}.jpg`,
  description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.',
  cta_label: 'Get a Similar Quote →',
  cta_href: '#quote',
  link_label: 'View project →',
  link_href: '#',
}));

export async function seedProjectsContent(prismaClient = prisma) {
  // Sample content only after the owner said yes to a starter website.
  if (!(await demoAccepted(prismaClient))) return;
  const projectId = await getDefaultProjectId(prismaClient);
  if (!projectId) return;
  for (let i = 0; i < CASE_STUDIES.length; i++) {
    const existing = await prismaClient.projectCaseStudy.findFirst({
      where: { project_id: projectId, title: CASE_STUDIES[i].title },
      select: { id: true },
    });
    if (existing) continue;
    await prismaClient.projectCaseStudy.create({ data: { ...CASE_STUDIES[i], project_id: projectId, order: i } });
  }
}
