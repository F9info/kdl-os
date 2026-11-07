import { prisma } from '../../config/database.js';
import { demoAccepted } from '../../shared/demo-content.js';
import { getDefaultProjectId } from '../../shared/default-project.js';

// Generic DemoLogo placeholder FAQs for the default project.
const FAQS = [
  {
    question: 'What services does DemoLogo offer?',
    answer: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.',
  },
  {
    question: 'How fast can I get a quote?',
    answer: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo.',
  },
  {
    question: 'Do you offer support after launch?',
    answer: 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
  },
];

export async function seedFaq(prismaClient = prisma) {
  // Sample content only after the owner said yes to a starter website.
  if (!(await demoAccepted(prismaClient))) return;
  const projectId = await getDefaultProjectId(prismaClient);
  if (!projectId) return;
  for (let i = 0; i < FAQS.length; i++) {
    const existing = await prismaClient.faqEntry.findFirst({
      where: { project_id: projectId, question: FAQS[i].question },
      select: { id: true },
    });
    if (existing) continue;
    await prismaClient.faqEntry.create({ data: { ...FAQS[i], project_id: projectId, order: i } });
  }
}
