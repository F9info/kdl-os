import { addPageToMenus } from '../menus/site-menus.js';
import { getDefaultProjectId } from '../../shared/default-project.js';
import {
  STARTER_PAGES,
  HEADER_SLUGS,
  SAMPLE_FAQS,
  blocks,
  wrapPage,
  navLinksFor,
  headerLinksFor,
  insertPublishedPage,
  brandName,
} from '../projects/starter-site.js';

// Website pages the CMS bundle adds on top of the 5 starter pages.
export const CMS_PAGES = [
  { slug: 'gallery', title: 'Gallery' },
  { slug: 'testimonials', title: 'Testimonials' },
  { slug: 'team', title: 'Team' },
  { slug: 'products', title: 'Products' },
  { slug: 'work', title: 'Our Work' },
  { slug: 'sectors', title: 'Sectors' },
  { slug: 'case-studies', title: 'Case studies' },
];
export const cmsPages = () => CMS_PAGES;

const { block, hero } = blocks;

const grid = (s, kind, columns = '3') =>
  block(s, 'ContentGrid', { kind, source: 'module', columns, items: '' });

const BODIES = {
  gallery: (s) => [
    hero(s, 'Gallery', 'A few moments from our work.'),
    block(s, 'GalleryGrid', { source: 'module', columns: '3', images: '' }),
  ],
  testimonials: (s) => [
    hero(s, 'Testimonials', 'What our customers say.'),
    grid(s, 'testimonials'),
  ],
  team: (s) => [hero(s, 'Our team', 'The people behind the work.'), grid(s, 'team')],
  products: (s) => [hero(s, 'Products and services', 'What we offer.'), grid(s, 'catalog')],
  work: (s) => [hero(s, 'Our work', 'A look at what we have done.'), grid(s, 'work')],
  sectors: (s) => [hero(s, 'Sectors', 'Who we work with.'), grid(s, 'sectors')],
  'case-studies': (s) => [
    hero(s, 'Case studies', 'Real projects, real results.'),
    grid(s, 'cases'),
  ],
};

export const cmsEnabled = async (client) => {
  const row = await client.module.findUnique({ where: { slug: 'cms' } });
  return row?.status === 'ENABLED';
};

// Adds the CMS pages to the website (only when the admin chose "front-end website") and
// links them from the starter pages' menus. Never edits a page the user already changed:
// existing slugs are skipped, and a menu is only rewritten while it is still the original.
export async function applyCmsSite(client, { answered, actorId = null } = {}) {
  const result = { created: [], patched: [] };
  if (answered === undefined) {
    const row = await client.appSetting.findUnique({ where: { key: 'onboarding.frontend' } });
    answered = row?.value === 'yes';
  }
  if (!answered) return result;
  const projectId = await getDefaultProjectId(client);
  if (!projectId) return result;

  const all = [...STARTER_PAGES, ...CMS_PAGES];
  const brand = await brandName(client);
  const fullLinks = navLinksFor(all);
  const headerLinks = headerLinksFor(all);
  for (const { slug, title } of CMS_PAGES) {
    if (await client.builderPage.findFirst({ where: { slug } })) continue;
    const page = await insertPublishedPage(client, {
      slug,
      title,
      data: wrapPage(slug, title, all, BODIES[slug](slug), brand),
      projectId,
      actorId,
    });
    await addPageToMenus(client, {
      projectId,
      page,
      header: HEADER_SLUGS.includes(slug),
    });
    result.created.push(slug);
  }

  const baseLinks = navLinksFor(STARTER_PAGES);
  const rows = await client.builderPage.findMany({
    where: { slug: { in: STARTER_PAGES.map((p) => p.slug) }, deleted_at: null },
  });
  for (const row of rows) {
    let changed = false;
    const content = (row.data?.content ?? []).map((b) => {
      if ((b.type === 'NavBar' || b.type === 'Footer') && b.props?.links === baseLinks) {
        changed = true;
        return {
          ...b,
          props: { ...b.props, links: b.type === 'NavBar' ? headerLinks : fullLinks },
        };
      }
      return b;
    });
    if (!changed) continue;
    await client.builderPage.update({
      where: { id: row.id },
      data: { data: { ...row.data, content } },
    });
    result.patched.push(row.slug);
  }
  return result;
}

// ── Sample content so the new pages are not empty ───────────────────────────
const svg = (label, color) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="440"><rect width="640" height="440" fill="${color}"/>` +
      `<text x="320" y="230" font-family="sans-serif" font-size="34" fill="#fff" text-anchor="middle">${label}</text></svg>`
  );

export const SAMPLE_GALLERY = [
  ['Our office', '#4f46e5'],
  ['Team day', '#0f766e'],
  ['New project', '#b45309'],
  ['Workshop', '#be185d'],
  ['Launch event', '#1d4ed8'],
  ['Behind the scenes', '#475569'],
].map(([title, color], order) => ({
  title,
  image_url: svg(title, color),
  caption: `${title} — replace with your own photo.`,
  order,
}));

const person = (name, role, bio) => ({ name, role, bio });
const SAMPLE_PEOPLE = [
  person('Alex Morgan', 'Founder', 'Leads the vision and keeps the team moving.'),
  person('Sam Rivera', 'Operations', 'Makes sure every project is delivered on time.'),
  person('Jamie Lee', 'Design', 'Turns ideas into clear, friendly designs.'),
];
const SAMPLE_QUOTES = [
  ['Priya S.', 'Customer', 'Easy to work with and very reliable. Highly recommended.'],
  ['Daniel K.', 'Business owner', 'They delivered exactly what we needed, right on time.'],
  ['Meera R.', 'Manager', 'Clear communication and great results from start to finish.'],
];
const SAMPLE_TITLES = ['First', 'Second', 'Third'];

export async function seedCmsSamples(client) {
  const projectId = await getDefaultProjectId(client);
  if (!projectId) return;
  if ((await client.faqEntry.count({ where: { project_id: projectId } })) === 0) {
    await client.faqEntry.createMany({
      data: SAMPLE_FAQS.map(([question, answer], order) => ({
        question,
        answer,
        order,
        project_id: projectId,
      })),
    });
  }
  const empty = async (model) =>
    (await client[model].count({ where: { project_id: projectId } })) === 0;
  const pid = projectId;
  if (await empty('galleryItem')) {
    await client.galleryItem.createMany({
      data: SAMPLE_GALLERY.map((g) => ({ ...g, project_id: pid })),
    });
  }
  if (await empty('testimonial')) {
    await client.testimonial.createMany({
      data: SAMPLE_QUOTES.map(([name, role, quote], order) => ({
        name,
        role,
        quote,
        order,
        project_id: pid,
      })),
    });
  }
  if (await empty('teamMember')) {
    await client.teamMember.createMany({
      data: SAMPLE_PEOPLE.map((p, order) => ({
        ...p,
        order,
        project_id: pid,
        photo_url: svg(p.name, '#4f46e5'),
      })),
    });
  }
  if (await empty('catalogItem')) {
    await client.catalogItem.createMany({
      data: SAMPLE_TITLES.map((t, order) => ({
        name: `${t} product`,
        slug: `${t.toLowerCase()}-product`,
        category: 'Products',
        description: 'Describe this product or service here.',
        image: svg(`${t} product`, '#0f766e'),
        order,
        project_id: pid,
      })),
    });
  }
  if (await empty('workCategory')) {
    await client.workCategory.createMany({
      data: SAMPLE_TITLES.map((t, order) => ({
        name: `${t} project`,
        slug: `${t.toLowerCase()}-project`,
        eyebrow: 'Our work',
        subtitle: 'A short line about this work.',
        image: svg(`${t} project`, '#b45309'),
        order,
        project_id: pid,
      })),
    });
  }
  if (await empty('sector')) {
    await client.sector.createMany({
      data: SAMPLE_TITLES.map((t, order) => ({
        name: `${t} sector`,
        slug: `${t.toLowerCase()}-sector`,
        category: 'Sectors',
        description: 'Say who you help in this sector.',
        image: svg(`${t} sector`, '#be185d'),
        order,
        project_id: pid,
      })),
    });
  }
  if (await empty('projectCaseStudy')) {
    await client.projectCaseStudy.createMany({
      data: SAMPLE_TITLES.map((t, order) => ({
        title: `${t} case study`,
        eyebrow: 'Case study',
        description: 'What the problem was and how you solved it.',
        image: svg(`${t} case`, '#1d4ed8'),
        order,
        project_id: pid,
      })),
    });
  }
}
