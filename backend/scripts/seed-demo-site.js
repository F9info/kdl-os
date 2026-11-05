#!/usr/bin/env node
/**
 * Seed the generic "DemoLogo" agency website (Home, About, Services,
 * Portfolio, Blog, Contact) onto the default project's builder pages.
 * Idempotent: pages are looked up by slug and their content replaced;
 * missing ones are created (published). Images live in
 * frontend/public/seed/demologo.
 *
 * Usage: node scripts/seed-demo-site.js
 */
import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { getDefaultProjectId } from '../src/shared/default-project.js';
import { DEMO_PAGE_PREFIX } from '../src/modules/menus/seed.js';

// Pages created by earlier runs carried the template-engine run prefix.
const LEGACY_PREFIX = 'te-cmt18teqh000101rxwfzfndow';

const IMG = '/seed/demologo';
const LOREM = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
const LOREM_SHORT = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
const COLORS = { primaryColor: '#1565e0', secondaryColor: '#0b1f4d' };
const slugOf = (key) => `${DEMO_PAGE_PREFIX}-${key}`;
const href = (key) => `/p/${slugOf(key)}`;
const NAV = [['Home', 'home'], ['About', 'about'], ['Services', 'services'], ['Portfolio', 'portfolio'], ['Blog', 'blog'], ['Contact', 'contact']];
const navLinks = NAV.map(([l, k]) => `${l}|${href(k)}`).join('\n');
const SERVICES = ['Web Development', 'Mobile App Development', 'Digital Marketing', 'Cloud Solutions'];

const block = (pageKey, type, props) => ({ type, props: { id: `${pageKey}-${type}`, ...props } });

const topBar = (k) => block(k, 'ConstructionTopBar', {
  variant: '5', visible: true, d5FollowLabel: 'Follow Us:', ...COLORS,
  d1Address: '', d1Phone: '+91 98765 43210', d1Email: 'info@demologo.com',
  d1Link1Label: '', d1Link1Href: '', d1Link2Label: '', d1Link2Href: '', d1Link3Label: '', d1Link3Href: '',
  d1Social1Href: '#', d1Social2Href: '#', d1Social3Href: '#', d1Social4Href: '#',
});
const header = (k) => block(k, 'ConstructionHeader', {
  variant: '5', visible: true, brand: 'DemoLogo', logoUrl: '', links: navLinks,
  loginLabel: '', loginHref: '#login', ctaLabel: 'Get a Quote →', ctaHref: href('contact'), ctaNewTab: false,
  phoneNumber: '+91 98765 43210', email: 'info@demologo.com', ...COLORS,
  transparent: false, lightText: false, solidOnScroll: false,
  social1Href: '#', social2Href: '#', social3Href: '#', social4Href: '#',
});
const footer = (k) => block(k, 'ConstructionFooter', {
  variant: '5', logoUrl: '', brand: 'DemoLogo', tagline: LOREM_SHORT, ...COLORS,
  social1Label: 'f', social1Href: '#', social2Label: 'ig', social2Href: '#', social3Label: 'in', social3Href: '#', social4Label: 'yt', social4Href: '#',
  companyLinksTitle: 'Quick Links', links: navLinks,
  group2Title: 'Services', group2Links: [...SERVICES, 'Branding', 'IT Consulting'].map((s) => `${s}|${href('services')}`).join('\n'),
  group3Title: '', group3Links: '', policyLinks: 'Privacy Policy|#\nTerms & Conditions|#', group4Links: '',
  contactTitle: 'Contact Info', contactPhone: '+91 98765 43210', contactPhone2: '', contactEmail: 'info@demologo.com', contactEmail2: '',
  contactAddress: '123 Main Street, City, Country', showroomTitle: '', showroomAddress: '', regdOfficeTitle: '', regdOfficeAddress: '',
  qrImage: '', qrCaption: '', estdYear: '', copyright: '© 2024 DemoLogo. All rights reserved.',
  newsletterTitle: '', newsletterPlaceholder: '', newsletterButtonLabel: '',
  partnerLogo1Url: '', partnerLogo2Url: '', partnerLogo3Url: '', partnerLogo4Url: '', badge1Url: '', badge1Label: '', badge2Url: '', badge2Label: '',
  aboutTitle: '', aboutText: '', aboutLinkLabel: '', aboutLinkHref: '',
  directionsLabel: 'Get Directions', directionsHref: '#',
});
const banner = (k, headline, subtitle) => block(k, 'ConstructionInnerBanner', {
  variant: '1', visible: true, backgroundImage: `${IMG}/cta-bg.jpg`, imageAlt: 'DemoLogo', headline, subtitle,
  eyebrow: 'DemoLogo', homeHref: href('home'), parentLabel: '', parentHref: '', currentLabel: headline,
  ctaPrimaryLabel: '', ctaPrimaryHref: '', ctaSecondaryLabel: '', ctaSecondaryHref: '',
});
const services = (k, items, extra = {}) => block(k, 'ConstructionIconFeatureGrid', {
  variant: '1', background: 'white', padding: 'md', ...extra,
  items,
});
const serviceItems = [
  ['hardhat', 'Web Development'], ['phone', 'Mobile App Development'], ['star', 'Digital Marketing'], ['building', 'Cloud Solutions'],
].map(([icon, title]) => ({ icon, biIcon: '', title, description: LOREM_SHORT }));
const stats = (k) => block(k, 'ConstructionStatsStrip', {
  background: 'muted', padding: 'md',
  stat1Value: '5+', stat1Label: 'Years Experience', stat2Value: '100+', stat2Label: 'Happy Clients',
  stat3Value: '250+', stat3Label: 'Projects Completed', stat4Value: '50+', stat4Label: 'Team Members',
});
const aboutSplit = (k) => block(k, 'ConstructionAboutSplit', {
  useSettings: false, eyebrow: 'About Us', heading: 'We Are a Creative Digital Agency',
  paragraph: `${LOREM} Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.`,
  photo: `${IMG}/about.jpg`, badgeNumber: '5+', badgeLabel: 'Years Experience',
  check1Text: 'Lorem ipsum dolor sit amet', check2Text: 'Consectetur adipiscing elit', check3Text: 'Sed do eiusmod tempor',
  brochureLabel: 'Learn More →', brochureHref: href('about'), membershipLabel: '', members: [], padding: 'md', background: 'white',
});
const PROJECTS = [
  ['Business Website', 'Web Development', 'Websites', 'business-website'],
  ['Food Delivery App', 'Mobile App', 'Mobile Apps', 'food-delivery-app'],
  ['Admin Dashboard', 'Web Application', 'Websites', 'admin-dashboard'],
  ['Brand Identity', 'Branding', 'Branding', 'brand-identity'],
  ['Digital Campaign', 'Digital Marketing', 'Digital Marketing', 'digital-campaign'],
];
const portfolioGrid = (k, title, eyebrow) => block(k, 'ConstructionProjectGallery', {
  sectionEyebrow: eyebrow, sectionTitle: title, sectionSubtitle: LOREM, showFilters: true, cardStyle: 'card', padding: 'md',
  items: PROJECTS.map(([t, category, filter, file], i) => ({
    title: t, category, filter, image: `${IMG}/projects/${file}.jpg`, numberTag: '', description: '', href: href('portfolio'),
  })),
});
const testimonials = (k) => block(k, 'ConstructionTestimonials', {
  sectionTitle: 'What Our Clients Say', padding: 'md', background: 'muted',
  quote1Text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.', quote1Author: 'John Doe', quote1Company: 'CEO, Example Corp', quote1Initials: 'JD',
  quote2Text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.', quote2Author: 'Sarah Smith', quote2Company: 'Founder, Creative Studio', quote2Initials: 'SS',
  quote3Text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.', quote3Author: 'Michael Lee', quote3Company: 'Director, Tech Solutions', quote3Initials: 'ML',
});
const cta = (k) => block(k, 'ConstructionQuoteCTA', {
  eyebrow: "Let's work together", headline: 'Ready to Start Your Project?', subtext: LOREM,
  ctaLabel: 'Contact Us →', ctaHref: href('contact'), secondaryCtaLabel: '', secondaryCtaHref: '', phoneNumber: '', phoneLabel: '', background: 'accent',
});

const PAGES = {
  home: {
    title: 'Home',
    content: (k) => [
      topBar(k), header(k),
      block(k, 'ConstructionHero', {
        variant: '1', visible: true, ...COLORS, activeSlideIndex: 0,
        d1Slides: [{ image: `${IMG}/hero.jpg`, badge: 'Welcome to DemoLogo', headline: 'We Bring Your Ideas to Life', subheadline: LOREM, ctaLabel: 'Get Started →', ctaHref: href('contact') }],
        sliderShowArrows: false, sliderShowDots: false, sliderAutoplay: false, sliderLoop: false, sliderTransition: 'fade',
      }),
      services(k + '-highlights', [
        { icon: 'lightbulb', biIcon: '', title: 'Innovative Solutions', description: '' },
        { icon: 'shield', biIcon: '', title: 'Trusted Partnership', description: '' },
        { icon: 'phone', biIcon: '', title: '24/7 Support', description: '' },
      ], { padding: 'sm' }),
      services(k, serviceItems),
      aboutSplit(k), stats(k),
      portfolioGrid(k, 'Our Latest Projects', 'Our Work'),
      testimonials(k), cta(k), footer(k),
    ],
  },
  about: { title: 'About', content: (k) => [topBar(k), header(k), banner(k, 'About Us', LOREM_SHORT), aboutSplit(k), stats(k), testimonials(k), cta(k), footer(k)] },
  services: { title: 'Services', content: (k) => [topBar(k), header(k), banner(k, 'Our Services', LOREM_SHORT), services(k, [...serviceItems, { icon: 'award', biIcon: '', title: 'Branding', description: LOREM_SHORT }, { icon: 'briefcase', biIcon: '', title: 'IT Consulting', description: LOREM_SHORT }], { sectionEyebrow: 'What we do', sectionTitle: 'Our Services' }), cta(k), footer(k)] },
  portfolio: { title: 'Portfolio', content: (k) => [topBar(k), header(k), banner(k, 'Portfolio', LOREM_SHORT), portfolioGrid(k, 'Our Latest Projects', 'Our Work'), cta(k), footer(k)] },
  blog: {
    title: 'Blog',
    content: (k) => [topBar(k), header(k), banner(k, 'Blog', LOREM_SHORT), block(k, 'ConstructionBlogPosts', {
      sectionTitle: 'Latest Articles', padding: 'md',
      post1Image: `${IMG}/projects/business-website.jpg`, post1Category: 'Web Development', post1Title: 'Lorem ipsum dolor sit amet', post1Date: 'Jan 10, 2024',
      post2Image: `${IMG}/projects/food-delivery-app.jpg`, post2Category: 'Mobile App', post2Title: 'Consectetur adipiscing elit', post2Date: 'Jan 17, 2024',
      post3Image: `${IMG}/projects/digital-campaign.jpg`, post3Category: 'Digital Marketing', post3Title: 'Sed do eiusmod tempor', post3Date: 'Jan 24, 2024',
    }), footer(k)],
  },
  contact: {
    title: 'Contact',
    content: (k) => [topBar(k), header(k), banner(k, 'Contact Us', LOREM_SHORT), block(k, 'ConstructionContactSplitMap', {
      eyebrow: 'Get in touch', heading: "We're here to help", subcopy: LOREM_SHORT,
      infoItems: [
        { icon: 'phone', label: 'Phone', lines: '+91 98765 43210', linkPrefix: 'tel:' },
        { icon: 'envelope', label: 'Email', lines: 'info@demologo.com', linkPrefix: 'mailto:' },
        { icon: 'building', label: 'Address', lines: '123 Main Street, City, Country', linkPrefix: '' },
      ],
      formAction: 'mailto:info@demologo.com', formEyebrow: 'Send a message', formHeading: 'Tell us about your project',
      mapEmbedUrl: 'https://www.google.com/maps?q=123%20Main%20Street&output=embed', submitLabel: 'Send Message →',
    }), footer(k)],
  },
};

const projectId = await getDefaultProjectId(prisma);
if (!projectId) throw new Error("Project with slug 'default' not found");

for (const [key, def] of Object.entries(PAGES)) {
  const slug = slugOf(key);
  const data = { root: { props: { title: def.title } }, zones: {}, content: def.content(key) };
  let page = await prisma.builderPage.findFirst({ where: { slug } });
  // Adopt the legacy-slug page (keeps the id referenced by the template-engine run); the old "work" page becomes Portfolio.
  if (!page) page = await prisma.builderPage.findFirst({ where: { slug: `${LEGACY_PREFIX}-${key === 'portfolio' ? 'work' : key}`, project_id: projectId } });
  if (page) {
    await prisma.builderPage.update({ where: { id: page.id }, data: { slug, title: def.title, status: 'PUBLISHED', deleted_at: null, project_id: projectId, data } });
  } else {
    await prisma.builderPage.create({ data: { slug, title: def.title, status: 'PUBLISHED', project_id: projectId, data } });
  }
  console.log(`seeded page ${slug}`);
}
await prisma.$disconnect();
