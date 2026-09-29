import { prisma } from '../../config/database.js';

// Real Subhadra Group FAQ content, previously copy-pasted into
// ConstructionLeadFormFAQ's own defaultProps — moved here as the single
// source of truth. Attached to the specific Subhadra project already
// running in this environment (this module has no generic demo data of its
// own beyond this one client).
const SUBHADRA_PROJECT_ID = 'cmt15bmts000401s6fn5ydhzp';

const FAQS = [
  {
    question: 'Do you only work in Visakhapatnam, or across Andhra Pradesh?',
    answer:
      "We're based in Visakhapatnam, but our engineering teams design, install and maintain systems for clients across Andhra Pradesh — including plants, hospitals and retail groups outside the city.",
  },
  {
    question: 'How fast can I get a quote?',
    answer:
      'Share your requirement through the quote form on this page or visit our showroom — our engineers typically respond with a sized solution and quote within 24 hours.',
  },
  {
    question: 'Do you only sell products, or also install and maintain them?',
    answer:
      'Both, always. Every product we stock is designed, supplied, installed and maintained by our own trained engineers — never subcontracted — with a dedicated service manager for ongoing support.',
  },
  {
    question: 'What brands do you deal in?',
    answer:
      'Only world-class, pioneer brands in each category — Schneider Electric, Blue Star, Polycab, RR Kabel, Crompton, Cummins, Honeywell and more — so spares and service are never a problem.',
  },
  {
    question: 'Can I see products in person before buying?',
    answer:
      'Yes — walk into our Visakhapatnam showroom to compare products on the shelf before you decide, or have our engineers visit your site directly for a free assessment.',
  },
  {
    question: 'What kind of after-sales support do you offer?',
    answer:
      '24×7 support with a dedicated service manager for every discipline we install in — from AMC contracts to emergency call-outs.',
  },
];

export async function seedFaq(prismaClient = prisma) {
  for (let i = 0; i < FAQS.length; i++) {
    const faq = FAQS[i];
    const existing = await prismaClient.faqEntry.findFirst({
      where: { project_id: SUBHADRA_PROJECT_ID, question: faq.question },
      select: { id: true },
    });
    if (existing) continue;
    await prismaClient.faqEntry.create({
      data: { ...faq, project_id: SUBHADRA_PROJECT_ID, order: i },
    });
  }
}
