#!/usr/bin/env node
/**
 * Adds two dummy "Service Detail" pages (demo images + Lorem content) under Services in the default
 * project's header menu, and fills the existing "Service Detail" page with the same content.
 * Each page is created by menus' createMenuItem (page + menu link + Pages view entry), then its
 * body is filled. Idempotent. Usage: node scripts/seed-demo-service-pages.js
 */
import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { getDefaultProjectId } from '../src/shared/default-project.js';
import { createMenuItem } from '../src/modules/menus/service.js';
import { updatePage } from '../src/modules/page-builder/service.js';

const IMG = '/seed/demologo';
const LOREM = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
const LOREM_SHORT = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';

const PAGES = [
  { label: 'Service Detail', image: `${IMG}/about.jpg` },
  { label: 'Service Detail', image: `${IMG}/projects/business-website.jpg` },
];

const block = (slug, type, props) => ({ type, props: { id: `${slug}-${type}`, ...props } });

const body = (slug, { label, image }) => {
  const title = label.replace(/ Detail$/, '');  // no "Detail" suffix on titles: such pages get their own Layout pill
  return [
    block(slug, 'ConstructionAboutSplit', {
      useSettings: false, eyebrow: 'Our Service', heading: title,
      paragraph: `${LOREM} Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.`,
      photo: image, badgeNumber: '5+', badgeLabel: 'Years Experience',
      check1Text: 'Lorem ipsum dolor sit amet', check2Text: 'Consectetur adipiscing elit', check3Text: 'Sed do eiusmod tempor',
      brochureLabel: 'Get a Quote →', brochureHref: '/contact', membershipLabel: '', members: [], padding: 'md', background: 'white',
    }),
    block(slug, 'ConstructionIconFeatureGrid', {
      variant: '1', background: 'muted', padding: 'md',
      items: [['lightbulb', 'Innovative Solutions'], ['shield', 'Trusted Partnership'], ['star', 'Quality Results'], ['phone', '24/7 Support']]
        .map(([icon, t]) => ({ icon, biIcon: '', title: t, description: LOREM_SHORT })),
    }),
    block(slug, 'ConstructionProjectGallery', {
      sectionEyebrow: 'Our Work', sectionTitle: 'Related Projects', sectionSubtitle: LOREM, showFilters: false, cardStyle: 'card', padding: 'md',
      items: [['Business Website', 'Web Development', 'business-website'], ['Food Delivery App', 'Mobile App', 'food-delivery-app'], ['Admin Dashboard', 'Web Application', 'admin-dashboard']]
        .map(([t, category, file]) => ({ title: t, category, filter: category, image: `${IMG}/projects/${file}.jpg`, numberTag: '', description: '', href: '/portfolio' })),
    }),
    block(slug, 'ConstructionQuoteCTA', {
      eyebrow: "Let's work together", headline: 'Ready to Start Your Project?', subtext: LOREM,
      ctaLabel: 'Contact Us →', ctaHref: '/contact', secondaryCtaLabel: '', secondaryCtaHref: '', phoneNumber: '', phoneLabel: '', background: 'accent',
    }),
  ];
};

const projectId = await getDefaultProjectId(prisma);
if (!projectId) throw new Error("Project with slug 'default' not found");
const user = await prisma.user.findFirst({ orderBy: { created_at: 'asc' }, select: { id: true } });
const menu = await prisma.menu.findFirst({ where: { project_id: projectId, key: 'header' } });
const parent = await prisma.menuItem.findFirst({ where: { menu_id: menu.id, label: 'Services', parent_id: null } });

for (const [i, def] of PAGES.entries()) {
  // Same-titled pages: the i-th item with this label under Services.
  const items = await prisma.menuItem.findMany({ where: { menu_id: menu.id, label: def.label }, orderBy: { created_at: 'asc' } });
  let item = items[i];
  if (!item) {
    const order = await prisma.menuItem.count({ where: { menu_id: menu.id, parent_id: parent.id } });
    item = await createMenuItem(menu.id, { label: def.label, link_type: 'custom', parent_id: parent.id, order, open_in_new_tab: false, is_active: true, no_page: false }, user.id);
  }
  const page = await prisma.builderPage.findUnique({ where: { id: item.page_id } });
  const content = page.data.content ?? [];
  const footerAt = content.findIndex((b) => b.type === 'ConstructionFooter');
  const chromeAndBanner = content.filter((b) => b.type !== 'ConstructionFooter' && !b.props.id.includes('-ConstructionAboutSplit'));
  const footer = footerAt >= 0 ? [content[footerAt]] : [];
  const next = { ...page.data, content: [...chromeAndBanner.filter((b) => !/-(ConstructionIconFeatureGrid|ConstructionProjectGallery|ConstructionQuoteCTA)$/.test(b.props.id)), ...body(page.slug, def), ...footer] };
  await updatePage(page.id, { data: next }, user.id);
  console.log(`seeded ${def.label} -> /p/${page.slug}`);
}
process.exit(0);
