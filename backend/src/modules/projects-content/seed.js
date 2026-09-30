import { prisma } from '../../config/database.js';

// Real Subhadra Group case studies, previously copy-pasted into
// ConstructionProjectsSlider's own defaultProps — moved here as the single
// source of truth. Attached to the specific Subhadra project already
// running in this environment (this module has no generic demo data of its
// own beyond this one client).
const SUBHADRA_PROJECT_ID = 'cmt15bmts000401s6fn5ydhzp';

const CASE_STUDIES = [
  {
    title: 'CMR Family Shopping Mall',
    eyebrow: '01 · Retail',
    tags: 'Central & VRF AC, LED Display Lighting, CCTV & Face Recognition, Fire Alarm & Fighting',
    image: '/seed/subhadra/sectors/showrooms.jpg',
    description:
      'A showroom floor lives or dies on how it feels the moment someone walks in. We size central and VRF AC to footfall and display heat load, fit LED lighting tuned for retail, and layer in CCTV, PA and fire safety — built into the fit-out from day one, not added after.',
    cta_label: 'Get a Similar Quote →',
    cta_href: '#quote',
    link_label: 'Read the full project scope →',
    link_href: '#showrooms',
  },
  {
    title: 'Novotel Visakhapatnam',
    eyebrow: '02 · Hotel',
    tags: 'Central AC, Electrical & Switchgear, Fire & Life Safety, Guest Room Automation, Power Backup',
    image: '/seed/subhadra/case-studies/novotel.jpg',
    description:
      'Advanced HVAC and automation solutions designed and delivered by Subhadra Group for a premium guest experience at Novotel Visakhapatnam — central AC across guest rooms and the banquet hall, electrical and switchgear, fire and life safety, guest-room automation and diesel power backup, all as one coordinated scope, by one team.',
    cta_label: 'Get a Similar Quote →',
    cta_href: '#quote',
    link_label: 'Read the full project scope →',
    link_href: '#hotel',
  },
  {
    title: 'The Amara Residency',
    eyebrow: '09 · Residential',
    tags: 'Central & Split AC, Home Automation, Home Theater, CCTV',
    image: '/seed/subhadra/sectors/villa.jpg',
    description:
      'Private residences deserve comfort that stays out of sight until you need it. We size central or split AC room-by-room, wire the home from day one, and layer in automation, home theater, multi-room audio and CCTV — all on one interface, backed by one service team for the life of the home.',
    cta_label: 'Get a Similar Quote →',
    cta_href: '#quote',
    link_label: 'Read the full project scope →',
    link_href: '#villa',
  },
];

export async function seedProjectsContent(prismaClient = prisma) {
  for (let i = 0; i < CASE_STUDIES.length; i++) {
    const study = CASE_STUDIES[i];
    const existing = await prismaClient.projectCaseStudy.findFirst({
      where: { project_id: SUBHADRA_PROJECT_ID, title: study.title },
      select: { id: true },
    });
    if (existing) continue;
    await prismaClient.projectCaseStudy.create({
      data: { ...study, project_id: SUBHADRA_PROJECT_ID, order: i },
    });
  }
}
