/**
 * Default Puck page content for WEBSITE-stage seeded pages (KDL-558).
 *
 * Pages used to seed with `data: null` — an empty canvas. This gives every
 * seeded page real, editable content instead, built only from block types
 * and defaultProps that already exist in the "general" component pack
 * (frontend/src/app/admin/page-builder/packs/general/index.tsx) — the one
 * pack that applies regardless of industry.
 *
 * Deliberately NOT industry-specific (no medical/construction pack picked
 * per project): the industry a project was created with is never persisted
 * anywhere retrievable at WEBSITE-stage time (see the driver's own
 * "Industry-based pack selection wired when brand-kit strategy field lands"
 * note) — building industry-aware seeding needs that field added first.
 */

const HERO_BY_KEY = {
  home: {
    title: 'Build faster with KDL',
    subtitle: 'A flexible, modern page builder that ships responsive pages to every device.',
    ctaLabel: 'Get started',
    ctaHref: '#',
    align: 'center',
  },
  about: {
    title: 'About us',
    subtitle: 'Write something compelling here.',
    ctaLabel: '',
    ctaHref: '#',
    align: 'left',
  },
  contact: {
    title: 'Contact us',
    subtitle: 'Write something compelling here.',
    ctaLabel: '',
    ctaHref: '#',
    align: 'left',
  },
};

function block(pageKey, type, props) {
  return { type, props: { id: `${pageKey}-${type}`, ...props } };
}

export function seedWebsitePageData(pageKey, pageTitle) {
  const content = [
    block(pageKey, 'Hero', HERO_BY_KEY[pageKey] ?? HERO_BY_KEY.home),
    block(pageKey, 'Spacer', { size: 'md' }),
    block(pageKey, 'Heading', { text: 'Section heading', level: '2', align: 'left' }),
    block(pageKey, 'Text', {
      text: 'Write something compelling here.',
      align: 'left',
      muted: false,
    }),
    block(pageKey, 'Spacer', { size: 'lg' }),
    block(pageKey, 'Button', { label: 'Get started', href: '#', variant: 'primary' }),
  ];
  return { root: { props: { title: pageTitle } }, content, zones: {} };
}
