import { normalizeData } from '../../shared/numbered-families.js';
import { ensureDefaultSite } from './sites.js';
import { deriveRouteKey } from '../../shared/page-routes.js';

// Building blocks for the starter website pages (General pack only).
export const BRAND = 'Your Brand';

/** The company name for generated pages: Application Identity, else the placeholder. */
export async function brandName(client) {
  const row = await client.appSetting.findUnique({ where: { key: 'identity.app_name' } });
  return row?.value?.trim() || BRAND;
}

/** The company's contact details from Application Identity; a detail nobody entered is simply absent. */
export async function contactDetails(client) {
  const get = async (key) => (await client.appSetting.findUnique({ where: { key } }))?.value?.trim() ?? '';
  const [email, phone, address] = await Promise.all(['identity.contact_email', 'identity.contact_phone', 'identity.contact_address'].map(get));
  return { email, phone, address };
}

// The 5 pages created when an admin answers "Yes, front-end website".
export const STARTER_PAGES = [
  { slug: 'home', title: 'Home' },
  { slug: 'about', title: 'About' },
  { slug: 'services', title: 'Services' },
  { slug: 'contact', title: 'Contact' },
  { slug: 'faq', title: 'FAQ' },
];

// The header menu stays short so it fits one line; the footer lists every page.
export const HEADER_SLUGS = ['home', 'about', 'services', 'contact', 'faq', 'gallery', 'team'];
export const navLinksFor = (pages) =>
  pages.map(({ title, slug }) => `${title}|/p/${slug}`).join('\n');
export const headerLinksFor = (pages) =>
  navLinksFor(pages.filter((p) => HEADER_SLUGS.includes(p.slug)));

const block = (slug, type, props) => ({ type, props: { id: `${slug}-${type}`, ...props } });
const spacer = (slug) => block(slug, 'Spacer', { size: 'md' });
const heading = (slug, text, level = '2') =>
  block(slug, 'Heading', { text, level, align: 'center' });
const text = (slug, body, muted = false) =>
  block(slug, 'Text', { text: body, align: 'center', muted, variant: '1' });
const hero = (slug, title, subtitle, ctaLabel = '', ctaHref = '') =>
  block(slug, 'Hero', {
    variant: '1',
    title,
    subtitle,
    ctaLabel,
    ctaHref,
    align: 'center',
    image: '',
    primaryColor: '',
  });
const cards = (slug, sectionTitle, sectionSubtitle, items) =>
  block(slug, 'FeatureCards', {
    variant: '1',
    sectionTitle,
    sectionSubtitle,
    cards: items.join('\n'),
  });

export const blocks = { block, spacer, heading, text, hero, cards };

const navBar = (slug, links, brand) =>
  block(slug, 'NavBar', {
    variant: '1',
    brand,
    logoUrl: '',
    links,
    ctaLabel: 'Contact us',
    ctaHref: '/p/contact',
    primaryColor: '',
  });
const footer = (slug, links, brand) =>
  block(slug, 'Footer', {
    variant: '1',
    brand,
    logoUrl: '',
    tagline: 'Building something great.',
    links,
    copyright: `© ${new Date().getFullYear()} ${brand}. All rights reserved.`,
  });

// Wraps a page body with NavBar + Footer and numbers every block (Puck needs unique ids).
export const wrapPage = (slug, title, pages, body, brand = BRAND) => ({
  root: { props: { title } },
  content: [navBar(slug, headerLinksFor(pages), brand), ...body, footer(slug, navLinksFor(pages), brand)].map(
    (b, i) => ({
      ...b,
      props: { ...b.props, id: `${slug}-${b.type}-${i}` },
    })
  ),
  zones: {},
});

// Fallback Q&A shown until the FAQ module has rows; also the sample rows CMS seeds.
export const SAMPLE_FAQS = [
  ['What is this website?', 'A starter site created by KDL OS. Edit it in the Page Builder.'],
  ['How do I change the text?', 'Open Page Builder, choose a page, click any text and type.'],
  ['How do I change the colours?', 'Open Themes, pick your main colour and publish.'],
  ['How do I add more pages?', 'In Page Builder, create a new page and add blocks.'],
  ['How do I contact you?', 'Use the Contact page.'],
];

const BODIES = {
  home: (s, brand) => [
    hero(
      s,
      `Welcome to ${brand}`,
      'A simple starting point for your website. Edit any text in the Page Builder.',
      'Our services',
      '/p/services'
    ),
    cards(s, 'What we offer', 'Everything you need, in one place.', [
      '⚡ | Fast | Quick to set up and quick to use.',
      '🔧 | Flexible | Change any page with the Page Builder.',
      '🔒 | Reliable | Built to grow with you.',
    ]),
  ],
  about: (s, brand) => [
    hero(s, 'About us', `Learn more about ${brand}.`),
    spacer(s),
    heading(s, 'Our story'),
    text(
      s,
      `${brand} was started to make good work simple. Replace this text with your own story.`
    ),
    heading(s, 'Our mission'),
    text(s, 'Tell visitors what you stand for and who you help.'),
    spacer(s),
  ],
  services: (s) => [
    hero(s, 'Our services', 'What we can do for you.', 'Get in touch', '/p/contact'),
    cards(s, 'Services', 'Pick the one that fits.', [
      '📌 | Service one | Describe your first service here.',
      '📌 | Service two | Describe your second service here.',
      '📌 | Service three | Describe your third service here.',
    ]),
  ],
  // Company details come from Identity. With none entered the page says how to reach us through the form
  // instead of showing invented contact details.
  contact: (s, _brand, contact = {}) => {
    const lines = [
      contact.email && `Email: ${contact.email}`,
      contact.phone && `Phone: ${contact.phone}`,
      contact.address && `Address: ${contact.address}`,
    ].filter(Boolean);
    return [
      hero(s, 'Contact us', 'We would love to hear from you.'),
      text(s, lines.length ? lines.join('\n') : 'Send us a message and we will get back to you.'),
      ...(contact.email ? [block(s, 'Button', { label: 'Email us', href: `mailto:${contact.email}`, variant: 'primary' })] : []),
    ];
  },
  // Reads the FAQ module when it is installed; the lines below are the fallback.
  faq: (s) => [
    hero(s, 'Frequently asked questions', 'Quick answers to common questions.'),
    block(s, 'FaqList', {
      source: 'module',
      items: SAMPLE_FAQS.map(([q, a]) => `${q}|${a}`).join('\n'),
    }),
  ],
};

export const buildStarterPage = (slug, title, pages, brand = BRAND, contact = {}) =>
  wrapPage(slug, title, pages, BODIES[slug](slug, brand, contact), brand);

// Insert a PUBLISHED page row through any Prisma client (or transaction).
export async function insertPublishedPage(
  client,
  { slug, title, data, projectId, actorId = null }
) {
  return client.builderPage.create({
    data: {
      slug,
      title,
      route_key: deriveRouteKey({ slug, title }),
      status: 'PUBLISHED',
      data: normalizeData(data),
      project_id: projectId,
      site_id: await ensureDefaultSite(client, projectId),
      created_by: actorId,
    },
  });
}
