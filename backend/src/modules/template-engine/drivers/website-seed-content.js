/**
 * Default Puck page content for WEBSITE-stage seeded pages (KDL-558).
 *
 * Pages used to seed with `data: null` — an empty Puck canvas. This gives
 * every seeded page a real, editable, full page layout instead (nav bar,
 * hero, stats, feature cards, CTA, footer) — built only from block types
 * that already exist in the "general" Puck component pack
 * (frontend/src/app/admin/page-builder/packs/general/index.tsx), so nothing
 * new needs registering and content renders correctly immediately.
 *
 * Props are always passed in full here — Puck only applies a component's
 * `defaultProps` when a NEW instance is dragged into the editor canvas, not
 * when reading back persisted `data.content`, so a partial props object
 * would render with missing/blank fields instead of falling back.
 *
 * Deliberately NOT industry-specific (no per-project medical/construction
 * pack selection, despite those richer packs already existing): the
 * industry a project was created with is never persisted anywhere
 * retrievable at WEBSITE-stage time (see the driver's own "Industry-based
 * pack selection wired when brand-kit strategy field lands" note) — real
 * per-industry seeding needs that field added first. Copy here stays
 * generic/brand-neutral so it's honest for any project, not just one
 * industry.
 */

function block(pageKey, type, props) {
  return { type, props: { id: `${pageKey}-${type}`, ...props } };
}

const NAV_LINKS = ['Home|#', 'About|#', 'Contact|#'].join('\n');

const NAV_BAR = {
  brand: 'Your Brand',
  links: NAV_LINKS,
  ctaLabel: 'Get Started',
  ctaHref: '#',
};

const FOOTER = {
  brand: 'Your Brand',
  tagline: 'Building something great.',
  links: NAV_LINKS,
  copyright: `© ${new Date().getFullYear()} Your Brand. All rights reserved.`,
};

const STATS = {
  stats: [
    '25+|Years of experience',
    '15K+|Happy customers',
    '50+|Team members',
    '30+|Projects delivered',
  ].join('\n'),
};

const FEATURE_CARDS = {
  sectionTitle: 'What we offer',
  sectionSubtitle: 'Everything you need, built for reliability and speed.',
  cards: [
    '⚡ | Fast | Ships responsive pages to every device in minutes.',
    '🔧 | Flexible | Compose pages from reusable, editable blocks.',
    '🔒 | Reliable | Built on infrastructure that scales with you.',
  ].join('\n'),
};

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
    subtitle: 'We build tools that help teams ship faster, together.',
    ctaLabel: '',
    ctaHref: '#',
    align: 'left',
  },
  contact: {
    title: 'Get in touch',
    subtitle: "We'd love to hear from you — reach out any time.",
    ctaLabel: '',
    ctaHref: '#',
    align: 'left',
  },
};

const MIDDLE_BLOCKS_BY_KEY = {
  home: (pageKey) => [
    block(pageKey, 'StatsStrip', STATS),
    block(pageKey, 'FeatureCards', FEATURE_CARDS),
    block(pageKey, 'Spacer', { size: 'lg' }),
    block(pageKey, 'Heading', { text: 'Ready to get started?', level: '2', align: 'center' }),
    block(pageKey, 'Spacer', { size: 'sm' }),
    block(pageKey, 'Button', { label: 'Get started', href: '#', variant: 'primary' }),
    block(pageKey, 'Spacer', { size: 'lg' }),
  ],
  about: (pageKey) => [
    block(pageKey, 'Text', {
      text: 'We started with a simple idea: building a website should not require writing code. Today our platform powers pages for teams of every size.',
      align: 'left',
      muted: false,
    }),
    block(pageKey, 'Spacer', { size: 'md' }),
    block(pageKey, 'Image', {
      src: 'https://placehold.co/1200x600',
      alt: 'Our team',
      rounded: true,
    }),
    block(pageKey, 'Spacer', { size: 'lg' }),
    block(pageKey, 'StatsStrip', STATS),
    block(pageKey, 'Spacer', { size: 'lg' }),
  ],
  contact: (pageKey) => [
    block(pageKey, 'Text', {
      text: 'Have a question or want a demo? Send us a message and our team will get back to you within one business day.',
      align: 'left',
      muted: false,
    }),
    block(pageKey, 'Spacer', { size: 'md' }),
    block(pageKey, 'Button', {
      label: 'Email us',
      href: 'mailto:hello@example.com',
      variant: 'primary',
    }),
    block(pageKey, 'Spacer', { size: 'lg' }),
  ],
};

export function seedWebsitePageData(pageKey, pageTitle) {
  const buildMiddle = MIDDLE_BLOCKS_BY_KEY[pageKey] ?? MIDDLE_BLOCKS_BY_KEY.home;
  const content = [
    block(pageKey, 'NavBar', NAV_BAR),
    block(pageKey, 'Hero', HERO_BY_KEY[pageKey] ?? HERO_BY_KEY.home),
    ...buildMiddle(pageKey),
    block(pageKey, 'Footer', FOOTER),
  ];
  return { root: { props: { title: pageTitle } }, content, zones: {} };
}
