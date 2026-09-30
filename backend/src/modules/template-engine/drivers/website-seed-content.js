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
 * Home's nav/hero/info-cards now use the medical pack's clinic-styled
 * components (see headerBlocks() below) — an exact-structure port of the
 * design reference's medHeader()/medHome(), requested directly rather than
 * gated behind industry detection. About/Contact still use the general
 * pack's NavBar/Hero. There is still no per-project industry picker (the
 * Templates step that offered one was removed) — this is simply what
 * every project's Home page looks like now.
 */

function block(pageKey, type, props) {
  return { type, props: { id: `${pageKey}-${type}`, ...props } };
}

// Inline SVG data URI — no network call, so it always renders regardless of
// CSP img-src or internet access. Used for LOGO/QR-style slots specifically
// (a stock photo would look wrong there) — see dummyImage() below for
// everything else. 'data:' needs no CSP img-src allowlist entry.
function dummyLogo(w, h, label) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<rect width="100%" height="100%" fill="#e2e8f0"/>` +
    `<text x="50%" y="50%" font-family="sans-serif" font-size="${Math.round(Math.min(w, h) / 10)}" ` +
    `fill="#64748b" text-anchor="middle" dominant-baseline="middle">${label || `${w}×${h}`}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Real Unsplash stock photos for everything that reads as actual page
// content (projects, offerings, team/doctor photos, avatars) — the flat SVG
// gray boxes this replaced looked obviously fake. images.unsplash.com is
// allowlisted in next.config.ts's img-src (driven by NEXT_PUBLIC_IMAGE_HOSTS).
// Bucketed by aspect ratio so exact-square crops (headshots/avatars) read as
// portraits and
// everything else as a building/site photo; `label` only picks the "team"
// bucket, it's not printed on the image (there's no text overlay to size for).
const DUMMY_BUILDING_PHOTOS = [
  '1541888946425-d81bb19240f5',
  '1486406146926-c627a92ad1ab',
  '1503387762-592deb58ef4e',
  '1479839672679-a46483c0e7c8',
  '1560518883-ce09059eeffa',
];
const DUMMY_PORTRAIT_PHOTOS = [
  '1507003211169-0a1dd7228f2d',
  '1494790108377-be9c29b29330',
  '1500648767791-00dcc994a43e',
  '1519085360753-af0119f7cbe7',
];
const DUMMY_TEAM_PHOTO = '1522202176988-66273c2fd55f';
let dummyPhotoIndex = { building: 0, portrait: 0 };

function dummyImage(w, h, label = '') {
  let photoId;
  if (/team/i.test(label)) {
    photoId = DUMMY_TEAM_PHOTO;
  } else if (w === h) {
    photoId = DUMMY_PORTRAIT_PHOTOS[dummyPhotoIndex.portrait % DUMMY_PORTRAIT_PHOTOS.length];
    dummyPhotoIndex.portrait += 1;
  } else {
    photoId = DUMMY_BUILDING_PHOTOS[dummyPhotoIndex.building % DUMMY_BUILDING_PHOTOS.length];
    dummyPhotoIndex.building += 1;
  }
  return `https://images.unsplash.com/photo-${photoId}?w=${w}&h=${h}&fit=crop&auto=format`;
}

const DEFAULT_NAV_LINKS = ['Home|#', 'About|#', 'Contact|#'].join('\n');

// `pages` is the full { key, title, slug } list this run is assembling (see
// resolveSeedPages + the `te-${run.id}-${key}` slug in drivers/index.js) —
// every seeded page's nav/footer links to every OTHER seeded page's real
// `/p/{slug}` URL, not just a hardcoded Home/About/Contact with dead `#`
// hrefs. Falls back to `#` only when called with no slug (the 3-link
// DEFAULT_NAV_LINKS below, or any caller that predates this). The Template
// Engine's own "View all pages" preview (template-engine/site/page.tsx)
// still intercepts clicks via preventDefault() and matches by link TEXT
// against page titles, so a real href here doesn't change that behaviour —
// it only matters on the actual public /p/[slug] route, which has no such
// interception and needs a real href to navigate anywhere at all.
function navLinksFor(pages) {
  if (!Array.isArray(pages) || pages.length === 0) return DEFAULT_NAV_LINKS;
  return pages.map(({ title, slug }) => `${title}|${slug ? `/p/${slug}` : '#'}`).join('\n');
}

const NAV_LINK_PROP_BY_BLOCK_TYPE = {
  NavBar: 'links',
  Footer: 'links',
  MedicalTopNav: 'navLinks',
  ConstructionHeader: 'links',
  ConstructionFooter: 'links',
};

// A page found via crash recovery (existing pageKeyToId entry, or an
// orphaned page reused by slug — see drivers/index.js) is reused AS-IS,
// never re-seeded — otherwise any edits the user made in the page-builder
// editor would be silently wiped every time the stage re-runs. But that
// means its nav/footer links, once written, never changed even when a
// LATER run picked a totally different page set: only genuinely NEW pages
// in that run got the current links, so newly-created pages linked
// correctly while old reused ones (almost always 'home') kept showing
// whatever page set existed when they were first created. Surgically
// patch just the nav-carrying blocks' link prop to the current page set,
// leaving every other block on the page untouched. Returns null when
// nothing actually needs to change (avoids a pointless write + activity-log
// entry on a re-run with the same selection).
export function patchNavLinks(data, pages) {
  if (!data?.content) return null;
  const links = navLinksFor(pages);
  let changed = false;
  const content = data.content.map((block) => {
    const propName = NAV_LINK_PROP_BY_BLOCK_TYPE[block.type];
    if (!propName || block.props?.[propName] === links) return block;
    changed = true;
    return { ...block, props: { ...block.props, [propName]: links } };
  });
  return changed ? { ...data, content } : null;
}

// Every nav/header/footer block type that carries the brand kit's
// name/logo — always as `brand`/`logoUrl`, same prop names across packs.
const BRAND_LOGO_BLOCK_TYPES = new Set([
  'NavBar',
  'Footer',
  'MedicalTopNav',
  'ConstructionHeader',
  'ConstructionFooter',
  'ConstructionTaglineStrip',
]);

// Brand kit fields (logo, company name) change independently of page
// content — re-uploading a logo or editing contact details in Studio's
// Intake stage happens long after a page was first seeded. Existing pages
// are never re-seeded wholesale (see patchNavLinks above for why), so
// without this the `brand`/`logoUrl` props stay frozen at whatever value
// existed the moment the page was first created — reported as "I uploaded a
// new logo but the site still shows the old one". Same surgical-patch
// pattern as patchNavLinks: touch only the two brand props on brand-carrying
// blocks, leave everything else (including manual edits) untouched.
export function patchBrand(data, brand = {}) {
  if (!data?.content) return null;
  const brandName = brand.companyName || 'Your Brand';
  const logoUrl = brand.logoUrl || '';
  let changed = false;
  const content = data.content.map((block) => {
    if (!BRAND_LOGO_BLOCK_TYPES.has(block.type)) return block;
    if (block.props?.brand === brandName && block.props?.logoUrl === logoUrl) return block;
    changed = true;
    return { ...block, props: { ...block.props, brand: brandName, logoUrl } };
  });
  return changed ? { ...data, content } : null;
}

// Same reasoning as patchBrand, for the construction pack's own
// phone/email/address carriers — the footer's "Contact"/"Showroom" blocks
// and the floating WhatsApp button. These aren't in BRAND_LOGO_BLOCK_TYPES
// since they don't use the brand/logoUrl prop pair.
export function patchConstructionContact(data, brand = {}) {
  if (!data?.content) return null;
  const addressLines = Array.isArray(brand.addressLines) ? brand.addressLines : [];
  const contactPhone = brand.phone || '+91-98765-43210';
  const contactEmail =
    brand.email ||
    `info@${(brand.companyName || 'Your Brand').toLowerCase().replace(/\s+/g, '')}.com`;
  const contactAddress = addressLines[0] || '123 Business Avenue\nCity, State 000000';
  const showroomAddress = addressLines[1] || '456 Showroom Road\nCity, State 000000';
  const whatsappHref = constructionFloatingActionsProps(brand).whatsappHref;

  let changed = false;
  const content = data.content.map((block) => {
    if (block.type === 'ConstructionFooter') {
      if (
        block.props?.contactPhone === contactPhone &&
        block.props?.contactEmail === contactEmail &&
        block.props?.contactAddress === contactAddress &&
        block.props?.showroomAddress === showroomAddress
      ) {
        return block;
      }
      changed = true;
      return {
        ...block,
        props: { ...block.props, contactPhone, contactEmail, contactAddress, showroomAddress },
      };
    }
    if (block.type === 'ConstructionFloatingActions') {
      // Back-fill the side options on pages seeded before they existed, but
      // never overwrite a Left/Right the user already picked.
      const { badgeSide = 'right', actionsSide = 'left' } = block.props ?? {};
      if (
        block.props?.whatsappHref === whatsappHref &&
        block.props?.badgeSide === badgeSide &&
        block.props?.actionsSide === actionsSide
      ) {
        return block;
      }
      changed = true;
      return { ...block, props: { ...block.props, whatsappHref, badgeSide, actionsSide } };
    }
    return block;
  });
  return changed ? { ...data, content } : null;
}

// Header block types a page might already carry from its original seed
// (general/medical packs) — none of these have the Design 1-4 `variant`
// prop the Layout picker's header designs need, so they're not patched in
// place; applyHeaderSection() below swaps them out for ConstructionHeader
// (the Layout picker's only header design family) the first time a header
// design is applied. ConstructionHeader itself is the current/target type
// once that's happened.
const HEADER_LEGACY_BLOCK_TYPES = new Set(['NavBar', 'MedicalTopNav']);
const HEADER_TARGET_BLOCK_TYPE = 'ConstructionHeader';
// Same legacy-swap story as HEADER_LEGACY_BLOCK_TYPES above: a page's
// original seed carries the general pack's plain Footer, which has no
// Design 1-4 variant of its own — applyFooterSection() swaps it for
// ConstructionFooter (the Layout picker's only footer design family) the
// first time a footer design is applied.
const FOOTER_LEGACY_BLOCK_TYPES = new Set(['Footer']);
const FOOTER_TARGET_BLOCK_TYPE = 'ConstructionFooter';
// The construction pack's ConstructionTopBar (utility bar — contact/social/
// promo strip above the main nav) is the only block with a distinct "top
// header" identity and its own Design 1-4 variant. It isn't part of any
// seeder's normal output (SEEDER_BY_PACK never builds one) — the Layout
// picker is the only way a page gets one, same insert/remove/re-style
// mechanism as header/footer.
const TOP_HEADER_BLOCK_TYPES = new Set(['ConstructionTopBar']);

// Layout picker's own header prop builder — separate from
// constructionHeaderProps() below (used by the construction pack's own
// seedConstructionPageData home content) so Design 1's transparent/
// light-text floating-over-hero treatment doesn't change that unrelated
// seed path. Matches the frontend's ConstructionHeader defaultProps.
//
// `transparent`/`lightText` false here (not true): this builder is what
// every generically-scaffolded page (Contact, About Us, Leadership, any
// new nav page) gets its header from — a white header floating
// transparently with white nav text only reads correctly over a real
// dark photo hero (Home's own dedicated seed path handles that itself,
// unaffected by this function). A page whose next block is the plain
// light-background generic `Hero`/`Text` placeholder made its own nav
// invisible (white-on-white) — solid + dark text is the safe default for
// a page with unknown/generic content below it; a page that DOES want
// the floating-over-hero look can still opt in via the Style panel.
function layoutHeaderProps(brand, pages) {
  return {
    ...constructionHeaderProps(brand, pages),
    visible: true,
    loginLabel: '',
    ctaLabel: 'Download Brochure ↓',
    ctaHref: '#brochure',
    // A brochure/file link opens in a new window (editable in the Section Builder).
    ctaNewTab: true,
    transparent: false,
    lightText: false,
  };
}

function buildHeaderBlock(pageKey, brand, pages, variant) {
  return block(pageKey, 'ConstructionHeader', { ...layoutHeaderProps(brand, pages), variant });
}

function buildFooterBlock(pageKey, brand, pages, variant) {
  return block(pageKey, 'ConstructionFooter', { ...layoutFooterProps(brand, pages), variant });
}

// Mirrors ConstructionTopBar's own defaultProps (frontend/src/app/admin/
// page-builder/packs/construction/index.tsx) — same generic placeholder
// copy for the fields each of its 4 designs doesn't share, with the
// contact-ish fields every design does share (address/phone/email/tagline)
// pulled from the brand kit the same way constructionFooterProps does.
// Field reuse note (KDL-558 top-header redesign): fields are shared across
// all 4 designs (Puck has no per-variant field scoping), and got reassigned
// by content fit when Designs 2/3/4 were redesigned to match new reference
// screenshots, rather than renamed — see the matching comment + variant
// render blocks in frontend/.../packs/construction/index.tsx for the full
// mapping. d2TrackHref was dropped entirely (no longer read by any design).
function constructionTopBarProps(brand = {}) {
  const name = brand.companyName || 'Your Brand';
  const phone = brand.phone || '+91 98765 43210';
  const email = brand.email || `hello@${name.toLowerCase().replace(/\s+/g, '')}.com`;
  const addressLines = Array.isArray(brand.addressLines) ? brand.addressLines : [];
  const tagline = 'Building with integrity, delivering with precision.';
  return {
    visible: true,
    d1Address: addressLines[0] || '123 Business Street, Mumbai, India',
    d1Phone: phone,
    d1Email: email,
    d1Link1Label: 'Careers',
    d1Link1Href: '#careers',
    d1Link2Label: 'Support',
    d1Link2Href: '#support',
    d1Link3Label: 'Blog',
    d1Link3Href: '#blog',
    d1Social1Href: '#',
    d1Social2Href: '#',
    d1Social3Href: '#',
    d1Social4Href: '#',
    d2Item1Text: "Let's build something amazing together!",
    d2Item2Text: '24/7 Support',
    d2Item3Text: 'On-Time Delivery',
    d2TrackLabel: 'Secure & Trusted',
    d2Language: 'EN',
    d3Tagline: tagline,
    d3Phone: phone,
    d3Email: email,
    d3CtaLabel: 'Start Your Project',
    d3CtaHref: '#quote',
    d4Tagline: 'Transforming Ideas into Digital Solutions',
    d4Social1Href: '#',
    d4Social2Href: '#',
    d4Social3Href: '#',
    d4Social4Href: '#',
    d4HelpLabel: 'Login',
    d4HelpHref: '#login',
    d4FaqLabel: 'Sign Up',
    d4FaqHref: '#signup',
    d4Language: 'Get 10% Off on Your First Project!',
  };
}

function buildTopHeaderBlock(pageKey, brand, variant) {
  return block(pageKey, 'ConstructionTopBar', { ...constructionTopBarProps(brand), variant });
}

// One section's worth of patchLayout's insert/remove/re-style logic — shared
// by the top-header/header/footer buckets below so the toggle+variant
// semantics only need to be right once. `insertIndex(content)` picks where a
// newly-enabled block lands; `section` is the caller's
// `{enabled?, variant?}` for this bucket, or undefined to leave it alone.
function applySection(content, blockTypes, section, buildBlock, insertIndex) {
  if (!section) return { content, changed: false };
  const enabled = section.enabled !== false;
  const variant = section.variant;
  const has = content.some((b) => blockTypes.has(b.type));

  if (!enabled && has) {
    return { content: content.filter((b) => !blockTypes.has(b.type)), changed: true };
  }
  if (enabled && !has) {
    const idx = insertIndex(content);
    const next = [...content.slice(0, idx), buildBlock(variant ?? '1'), ...content.slice(idx)];
    return { content: next, changed: true };
  }
  if (enabled && variant) {
    let changed = false;
    const next = content.map((b) => {
      if (!blockTypes.has(b.type) || b.props?.variant === variant) return b;
      changed = true;
      return { ...b, props: { ...b.props, variant } };
    });
    return { content: next, changed };
  }
  return { content, changed: false };
}

// Header-only variant of applySection: a page's existing header may be a
// legacy type (NavBar/MedicalTopNav from its original seed) that doesn't
// share ConstructionHeader's shape or `variant` prop, so it can't just be
// variant-patched in place like top-header/footer can — the first time a
// header design is actually applied, it's swapped out for a fresh
// ConstructionHeader at the same position; after that it behaves like any
// other design bucket (toggle/re-style in place).
function applyHeaderSection(content, section, pageKey, brand, pages) {
  if (!section) return { content, changed: false };
  const enabled = section.enabled !== false;
  const variant = section.variant;
  const legacy = content.find((b) => HEADER_LEGACY_BLOCK_TYPES.has(b.type));
  const current = content.find((b) => b.type === HEADER_TARGET_BLOCK_TYPE);

  if (!enabled) {
    if (!legacy && !current) return { content, changed: false };
    const next = content.filter(
      (b) => !HEADER_LEGACY_BLOCK_TYPES.has(b.type) && b.type !== HEADER_TARGET_BLOCK_TYPE
    );
    return { content: next, changed: true };
  }

  // A page can end up with both a legacy block AND a target block already
  // present (e.g. a run that mixed seeders, or a since-fixed patch bug) —
  // drop the orphaned legacy one instead of leaving it stranded forever,
  // which the legacy-swap branch below never does since it only fires when
  // `current` is absent.
  if (legacy && current) {
    const next = content.filter((b) => !HEADER_LEGACY_BLOCK_TYPES.has(b.type));
    return { content: next, changed: true };
  }

  if (legacy && !current) {
    const idx = content.indexOf(legacy);
    const next = [
      ...content.slice(0, idx),
      buildHeaderBlock(pageKey, brand, pages, variant ?? '1'),
      ...content.slice(idx + 1),
    ];
    return { content: next, changed: true };
  }

  if (!current) {
    const i = content.findIndex((b) => !TOP_HEADER_BLOCK_TYPES.has(b.type));
    const idx = i === -1 ? content.length : i;
    const next = [
      ...content.slice(0, idx),
      buildHeaderBlock(pageKey, brand, pages, variant ?? '1'),
      ...content.slice(idx),
    ];
    return { content: next, changed: true };
  }

  if (variant && current.props?.variant !== variant) {
    const next = content.map((b) =>
      b === current ? { ...b, props: { ...b.props, variant } } : b
    );
    return { content: next, changed: true };
  }

  return { content, changed: false };
}

// Footer-only variant of applySection, same reasoning as
// applyHeaderSection above: a page's existing footer may be the general
// pack's plain Footer (from its original seed), which shares no shape or
// `variant` prop with ConstructionFooter, so it's swapped in place the
// first time a footer design is applied rather than variant-patched.
function applyFooterSection(content, section, pageKey, brand, pages) {
  if (!section) return { content, changed: false };
  const enabled = section.enabled !== false;
  const variant = section.variant;
  const legacy = content.find((b) => FOOTER_LEGACY_BLOCK_TYPES.has(b.type));
  const current = content.find((b) => b.type === FOOTER_TARGET_BLOCK_TYPE);

  if (!enabled) {
    if (!legacy && !current) return { content, changed: false };
    const next = content.filter(
      (b) => !FOOTER_LEGACY_BLOCK_TYPES.has(b.type) && b.type !== FOOTER_TARGET_BLOCK_TYPE
    );
    return { content: next, changed: true };
  }

  // Same orphaned-legacy-block guard as applyHeaderSection above.
  if (legacy && current) {
    const next = content.filter((b) => !FOOTER_LEGACY_BLOCK_TYPES.has(b.type));
    return { content: next, changed: true };
  }

  if (legacy && !current) {
    const idx = content.indexOf(legacy);
    const next = [
      ...content.slice(0, idx),
      buildFooterBlock(pageKey, brand, pages, variant ?? '1'),
      ...content.slice(idx + 1),
    ];
    return { content: next, changed: true };
  }

  if (!current) {
    const next = [...content, buildFooterBlock(pageKey, brand, pages, variant ?? '1')];
    return { content: next, changed: true };
  }

  if (variant && current.props?.variant !== variant) {
    const next = content.map((b) =>
      b === current ? { ...b, props: { ...b.props, variant } } : b
    );
    return { content: next, changed: true };
  }

  return { content, changed: false };
}

// Layout picker page — toggle the top-header/header/footer block on/off and
// pick its design variant. Same surgical-patch convention as
// patchNavLinks/patchBrand: touches only those blocks, leaves everything
// else (including manual edits) untouched. Re-enabling a previously-removed
// section rebuilds it fresh (current brand/nav — there is nothing saved to
// restore, it was removed). Top-header sits above header, which sits above
// the rest of the page's content — inserting either finds its slot relative
// to what's already there rather than assuming index 0.
//
// Opt-in per section: `layout.topHeader`/`layout.header`/`layout.footer`
// only apply when the caller actually sends that key. No `layout` at all
// (every pre-existing caller, and every non-general seeder's page) is a full
// no-op — otherwise every plain re-run would silently snap an
// already-customised variant back to '1', and construction/medical pages
// (whose header/footer block types aren't in HEADER_BLOCK_TYPES/
// FOOTER_BLOCK_TYPES) would grow a stray NavBar/Footer pair with no way to
// turn it off.
export function patchLayout(data, layout, pageKey, brand, pages) {
  if (!data?.content || !layout) return null;

  let content = data.content;
  let changed = false;

  const topHeader = applySection(
    content,
    TOP_HEADER_BLOCK_TYPES,
    layout.topHeader,
    (variant) => buildTopHeaderBlock(pageKey, brand, variant),
    () => 0
  );
  content = topHeader.content;
  changed = changed || topHeader.changed;

  const header = applyHeaderSection(content, layout.header, pageKey, brand, pages);
  content = header.content;
  changed = changed || header.changed;

  const footer = applyFooterSection(content, layout.footer, pageKey, brand, pages);
  content = footer.content;
  changed = changed || footer.changed;

  return changed ? { ...data, content } : null;
}

// A custom block built in the standalone Section Builder is copied into a
// page's own Puck data at insert time (`type: 'CustomComposedBlock'`,
// `props.config` = the block's ComposedBlockConfig) — not a live reference
// back to the block library. Its 'logo' atoms (frontend's Branding &
// Navigation group) are prefilled from the same brand kit at drop time, but
// without this patch they'd go stale the same way NavBar/Footer would
// without patchBrand above. Same unconditional-overwrite convention: a
// composed block's logo atom always tracks the current brand, same as
// ConstructionHeader's brand/logoUrl props have no manual-override path.
function patchLogoAtoms(atoms, brandName, logoUrl) {
  let changed = false;
  const next = atoms.map((atom) => {
    let updated = atom;
    if (atom.type === 'logo' && (atom.src !== logoUrl || atom.text !== brandName)) {
      changed = true;
      updated = { ...atom, src: logoUrl, text: brandName };
    }
    if (Array.isArray(atom.children) && atom.children.length > 0) {
      const [childNext, childChanged] = patchLogoAtoms(atom.children, brandName, logoUrl);
      if (childChanged) {
        changed = true;
        updated = { ...updated, children: childNext };
      }
    }
    return updated;
  });
  return [next, changed];
}

export function patchComposerLogos(data, brand = {}) {
  if (!data?.content) return null;
  const brandName = brand.companyName || 'Your Brand';
  const logoUrl = brand.logoUrl || '';
  let changed = false;
  const content = data.content.map((block) => {
    const atoms = block.props?.config?.atoms;
    if (block.type !== 'CustomComposedBlock' || !Array.isArray(atoms)) return block;
    const [nextAtoms, atomsChanged] = patchLogoAtoms(atoms, brandName, logoUrl);
    if (!atomsChanged) return block;
    changed = true;
    return {
      ...block,
      props: { ...block.props, config: { ...block.props.config, atoms: nextAtoms } },
    };
  });
  return changed ? { ...data, content } : null;
}

// Brand kit fields (logo, company name, extracted primary colour) are
// optional — a fresh project with no approved brand kit yet still seeds
// pages, falling back to the generic "Your Brand" copy/colors below.
function navBarProps(brand = {}, pages) {
  return {
    variant: '1',
    brand: brand.companyName || 'Your Brand',
    logoUrl: brand.logoUrl || '',
    links: navLinksFor(pages),
    ctaLabel: 'Get Started',
    ctaHref: '#',
    primaryColor: brand.primaryHex || '',
  };
}

function footerProps(brand = {}, pages) {
  const name = brand.companyName || 'Your Brand';
  const lastUpdated = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return {
    variant: '1',
    brand: name,
    logoUrl: brand.logoUrl || '',
    tagline: 'Building something great.',
    links: navLinksFor(pages),
    copyright: `© ${new Date().getFullYear()} ${name}. All rights reserved. · Last updated ${lastUpdated}`,
  };
}

const FEATURE_CARDS = {
  variant: '1',
  sectionTitle: 'What we offer',
  sectionSubtitle: 'Everything you need, built for reliability and speed.',
  cards: [
    '⚡ | Fast | Ships responsive pages to every device in minutes.',
    '🔧 | Flexible | Compose pages from reusable, editable blocks.',
    '🔒 | Reliable | Built on infrastructure that scales with you.',
  ].join('\n'),
};

// Home page's nav/hero/info-cards — an exact-structure port of the design
// reference's medHeader()/medHome() (KDL-558, "add this page first"). Uses
// the medical pack's MedicalTopNav/MedicalHeroSplit/MedicalContactInfoCards
// components (Puck merges every pack into one flat registry, so mixing
// general + medical component types on one page is fine) since the
// Templates picker was removed — this is now the only seed path, so it's
// what "View all pages" always shows for Home. About/Contact still use the
// general pack's NavBar/Hero for now — next step per the same request.
function topNavProps(brand = {}, pages) {
  return {
    variant: '1',
    welcomeText: 'Welcome — Your Health, Our Priority!',
    phone: '(123) 456 7890',
    hours: 'Mon–Sat: 8:00–18:00',
    brand: brand.companyName || 'Your Brand',
    logoUrl: brand.logoUrl || '',
    navLinks: navLinksFor(pages),
    ctaLabel: 'Appointment',
    ctaHref: '#appointment',
    primaryColor: brand.primaryHex || '',
  };
}

function homeHeroProps(brand = {}) {
  return {
    variant: '2',
    eyebrow: 'Welcome to our clinic',
    headingLine1: 'Your Health',
    headingLine2: 'Our Priority',
    subtext: "We provide the best medical services for you and your family's health.",
    primaryLabel: 'Our Services',
    primaryHref: '#services',
    secondaryLabel: 'Contact Us',
    secondaryHref: '#contact',
    image: dummyImage(900, 800),
    primaryColor: brand.primaryHex || '',
  };
}

const HERO_BY_KEY = {
  home: {
    variant: '1',
    title: 'Build faster with KDL',
    subtitle: 'A flexible, modern page builder that ships responsive pages to every device.',
    ctaLabel: 'Get started',
    ctaHref: '#',
    align: 'center',
    image: dummyImage(900, 700),
    primaryColor: '',
  },
  about: {
    variant: '1',
    title: 'About us',
    subtitle: 'We build tools that help teams ship faster, together.',
    ctaLabel: '',
    ctaHref: '#',
    align: 'left',
    image: dummyImage(900, 700),
    primaryColor: '',
  },
  contact: {
    variant: '1',
    title: 'Get in touch',
    subtitle: "We'd love to hear from you — reach out any time.",
    ctaLabel: '',
    ctaHref: '#',
    align: 'left',
    image: dummyImage(900, 700),
    primaryColor: '',
  },
};

// A Navigation-step page whose key isn't one of the 3 originally-hardcoded
// ones (e.g. 'blog', 'team-member', anything the user typed as a custom
// page) used to silently fall back to HOME's own hero verbatim — literally
// "Build faster with KDL" on every such page, giving zero visual
// difference between them. Reported as "when I click the pages are not
// opened related pages": every non-home/about/contact page looked
// identical, so navigating between them looked like nothing happened even
// though it did. Uses the page's own real title instead.
function genericHero(pageTitle) {
  return {
    variant: '1',
    title: pageTitle,
    subtitle: `Learn more about ${pageTitle.toLowerCase()}.`,
    ctaLabel: '',
    ctaHref: '#',
    align: 'left',
    image: dummyImage(900, 700),
    primaryColor: '',
  };
}

// About/Contact normalize to exactly 4 blocks — nav, hero, one content
// block, footer — matching the design prototype's leaner per-page
// structure. Home is deliberately richer: every real Medical* section gets
// used at least once here so each one's 4 designs (variant '1'-'4') are
// actually reachable somewhere, not just defined in code — each section
// below is pinned to a different variant for visual variety. Static pick
// for now (per explicit instruction); revisit once there's a real "best
// design per section" signal instead of a hand-picked default.
const MIDDLE_BLOCK_BY_KEY = {
  home: (pageKey) => [
    block(pageKey, 'FeatureCards', FEATURE_CARDS),
    block(pageKey, 'MedicalServicesList', MEDICAL_SERVICES_LIST),
    block(pageKey, 'MedicalDepartmentCards', MEDICAL_DEPARTMENT_CARDS),
    block(pageKey, 'MedicalDoctorProfiles', MEDICAL_DOCTOR_PROFILES),
    block(pageKey, 'MedicalPatientTestimonials', MEDICAL_PATIENT_TESTIMONIALS),
    block(pageKey, 'MedicalInsuranceStrip', MEDICAL_INSURANCE_STRIP),
    block(pageKey, 'MedicalAppointmentCTA', MEDICAL_APPOINTMENT_CTA),
    block(pageKey, 'MedicalContactHours', MEDICAL_CONTACT_HOURS),
    block(pageKey, 'MedicalFAQ', MEDICAL_FAQ),
  ],
  about: (pageKey) => [
    block(pageKey, 'Text', {
      variant: '1',
      text: 'We started with a simple idea: building a website should not require writing code. Today our platform powers pages for teams of every size.',
      align: 'left',
      muted: false,
    }),
  ],
  contact: (pageKey) => [
    block(pageKey, 'Text', {
      variant: '1',
      text: 'Have a question or want a demo? Send us a message and our team will get back to you within one business day.',
      align: 'left',
      muted: false,
    }),
  ],
};

// Same reasoning as genericHero() — reusing Home's entire medical-clinic
// section list (department cards, doctor profiles, FAQ, ...) on an
// unrelated page like 'team-member' is both thematically wrong AND still
// visually identical across every such page. Mirrors About/Contact's
// leaner one-block shape instead.
function genericMiddle(pageKey, pageTitle) {
  return [
    block(pageKey, 'Text', {
      variant: '1',
      text: `This is the ${pageTitle} page. Replace this placeholder with real content in the page-builder editor.`,
      align: 'left',
      muted: false,
    }),
  ];
}

function headerBlocks(pageKey, brand, pages, pageTitle) {
  if (pageKey === 'home') {
    return [
      block(pageKey, 'MedicalTopNav', topNavProps(brand, pages)),
      block(pageKey, 'MedicalHeroSplit', homeHeroProps(brand)),
    ];
  }
  return [
    block(pageKey, 'NavBar', navBarProps(brand, pages)),
    block(pageKey, 'Hero', HERO_BY_KEY[pageKey] ?? genericHero(pageTitle)),
  ];
}

export function seedWebsitePageData(pageKey, pageTitle, brand = {}, pages) {
  const buildMiddle = MIDDLE_BLOCK_BY_KEY[pageKey];
  const content = [
    ...headerBlocks(pageKey, brand, pages, pageTitle),
    ...(buildMiddle ? buildMiddle(pageKey) : genericMiddle(pageKey, pageTitle)),
    block(pageKey, 'Footer', footerProps(brand, pages)),
  ];
  return { root: { props: { title: pageTitle } }, content, zones: {} };
}

// ─── Medical pack seeder (KDL-558 task 2/5) ──────────────────────────────
//
// Not wired to the Templates step yet (task 4) — reuses the general pack's
// NavBar/Footer (Puck's config merges every pack into one flat component
// registry, so mixing general + medical component types on one page is
// fine) with the real Medical* components for the body, matching the
// design reference's "centered" (Medical · Clinic) template structurally.
// Uses each MedicalX component's own defaultProps verbatim (frontend/src/
// app/admin/page-builder/packs/medical/index.tsx) rather than inventing
// new copy, since those were already written to fit the components' pipe-
// delimited-line formats exactly.

const MEDICAL_HERO_BY_KEY = {
  home: {
    headline: 'Compassionate Care, Every Step of the Way',
    subheadline:
      'Our board-certified physicians and specialists are committed to your health and well-being. Book your appointment today.',
    ctaLabel: 'Book an Appointment',
    ctaHref: '#appointment',
    badge: 'NABH Accredited',
    align: 'center',
  },
  about: {
    headline: 'About Our Clinic',
    subheadline: 'Decades of combined experience, one shared mission: your health, our priority.',
    ctaLabel: '',
    ctaHref: '#',
    badge: '',
    align: 'left',
  },
  contact: {
    headline: 'Get in Touch',
    subheadline: "Book an appointment, ask a question, or find us — we're here to help.",
    ctaLabel: '',
    ctaHref: '#',
    badge: '',
    align: 'left',
  },
};

const MEDICAL_SERVICES_LIST = {
  variant: '1',
  sectionTitle: 'Our Services',
  sectionSubtitle: 'Comprehensive healthcare solutions tailored to your needs.',
  services: [
    '🫀 | Cardiology | Diagnosis and treatment of heart conditions',
    '🦴 | Orthopaedics | Bone, joint, and spine care',
    '🧠 | Neurology | Brain and nervous system disorders',
    "🤰 | Gynaecology | Women's health and maternity care",
    '👁️ | Ophthalmology | Eye care and vision correction',
    '🦷 | Dental | Complete oral health services',
  ].join('\n'),
};

const MEDICAL_DEPARTMENT_CARDS = {
  variant: '2',
  sectionTitle: 'Our Departments',
  sectionSubtitle: 'State-of-the-art facilities across all major medical disciplines.',
  departments: [
    '❤️ | Cardiac Sciences | Advanced heart care & cath lab | #cardiac',
    '🧠 | Neurosciences | Stroke, epilepsy & spine | #neuro',
    '👶 | Paediatrics | Child health from birth | #paediatrics',
    '🩻 | Radiology | MRI, CT & interventional imaging | #radiology',
    '🔬 | Pathology | Lab diagnostics & blood tests | #pathology',
    '🏃 | Physiotherapy | Rehabilitation & sports medicine | #physio',
  ].join('\n'),
};

const MEDICAL_DOCTOR_PROFILES = {
  variant: '3',
  sectionTitle: 'Meet Our Specialists',
  sectionSubtitle: 'Experienced, board-certified doctors dedicated to your care.',
  doctors: [
    `Dr. Priya Sharma | MD, DM | Cardiologist | ${dummyImage(400, 400)}`,
    `Dr. Rahul Mehta | MS, DNB | Orthopaedic Surgeon | ${dummyImage(400, 400)}`,
    `Dr. Ananya Patel | MBBS, MD | Neurologist | ${dummyImage(400, 400)}`,
    `Dr. Sunita Rao | MS, FMAS | Gynaecologist | ${dummyImage(400, 400)}`,
  ].join('\n'),
};

const MEDICAL_INSURANCE_STRIP = {
  variant: '3',
  heading: 'We Accept All Major Insurers',
  logos: [
    `${dummyLogo(120, 48, 'Star Health')} | Star Health`,
    `${dummyLogo(120, 48, 'HDFC Ergo')} | HDFC Ergo`,
    `${dummyLogo(120, 48, 'Bajaj Allianz')} | Bajaj Allianz`,
    `${dummyLogo(120, 48, 'New India')} | New India Assurance`,
    `${dummyLogo(120, 48, 'Care Health')} | Care Health`,
  ].join('\n'),
  note: "Don't see your insurer? Call us and we'll help.",
};

const MEDICAL_FAQ = {
  variant: '1',
  sectionTitle: 'Frequently Asked Questions',
  sectionSubtitle: 'Answers to common questions about our services and procedures.',
  items: [
    'How do I book an appointment? | You can book online through our website or call our helpline.',
    'Do you accept walk-in patients? | Yes, walk-ins are welcome but appointments are prioritised.',
    'Is cashless insurance available? | We are empanelled with 30+ insurers for cashless treatment.',
    'What are the visiting hours? | General visiting hours are 10 AM – 12 PM and 4 PM – 7 PM.',
    'Are second opinions available? | Yes, our specialists are happy to provide second opinions.',
  ].join('\n'),
};

const MEDICAL_APPOINTMENT_CTA = {
  variant: '2',
  headline: 'Ready to See a Doctor?',
  subtext: 'Book online in minutes or call us to speak with our care team.',
  primaryLabel: 'Book Appointment Online',
  primaryHref: '#book',
  secondaryLabel: 'View All Doctors',
  secondaryHref: '#doctors',
  phoneNumber: '+91 98765 43210',
};

const MEDICAL_PATIENT_TESTIMONIALS = {
  variant: '3',
  sectionTitle: 'What Our Patients Say',
  sectionSubtitle: "Real stories from people we've helped on their healing journey.",
  testimonials: [
    'The cardiac team saved my life. I am forever grateful. | Ramesh Nair | Heart Surgery',
    'Best maternity care I could have asked for. | Deepa Krishnan | Maternity',
    'My knee replacement went smoothly and recovery was fast. | Suresh Pillai | Orthopaedics',
    'Very caring staff and world-class facilities. | Anu Thomas | General Medicine',
  ].join('\n'),
};

const MEDICAL_CONTACT_HOURS = {
  variant: '3',
  sectionTitle: 'Contact Us',
  address: '42, Healthcare Avenue\nMedical District, Bangalore – 560001\nKarnataka, India',
  phone: '+91 80 4567 8900',
  email: 'info@clinicname.in',
  hours: ['Monday – Friday | 8 AM – 8 PM', 'Saturday | 8 AM – 6 PM', 'Sunday | 9 AM – 1 PM'].join(
    '\n'
  ),
  emergencyNote: '24/7 Emergency Services available',
};

const MEDICAL_MIDDLE_BY_KEY = {
  home: (pageKey) => [
    block(pageKey, 'MedicalServicesList', MEDICAL_SERVICES_LIST),
    block(pageKey, 'MedicalAppointmentCTA', MEDICAL_APPOINTMENT_CTA),
    block(pageKey, 'MedicalDoctorProfiles', MEDICAL_DOCTOR_PROFILES),
    block(pageKey, 'MedicalPatientTestimonials', MEDICAL_PATIENT_TESTIMONIALS),
  ],
  about: (pageKey) => [
    block(pageKey, 'Text', {
      text: 'Founded to bring compassionate, accessible healthcare to our community, our clinic combines experienced specialists with modern facilities.',
      align: 'left',
      muted: false,
    }),
    block(pageKey, 'Spacer', { size: 'md' }),
    block(pageKey, 'MedicalDoctorProfiles', MEDICAL_DOCTOR_PROFILES),
  ],
  contact: (pageKey) => [
    block(pageKey, 'MedicalContactHours', MEDICAL_CONTACT_HOURS),
    block(pageKey, 'MedicalAppointmentCTA', MEDICAL_APPOINTMENT_CTA),
  ],
};

// Same reasoning as genericHero()/genericMiddle() above — a page key
// outside the originally-hardcoded set must not silently reuse Home's
// hero/content verbatim (Not currently reachable via the live UI, which
// never sends templatePack, but keeping this consistent avoids the same
// landmine once template-pack selection is wired back up).
function genericMedicalHero(pageTitle) {
  return {
    headline: pageTitle,
    subheadline: `Learn more about ${pageTitle.toLowerCase()}.`,
    ctaLabel: '',
    ctaHref: '#',
    badge: '',
    align: 'left',
  };
}

export function seedMedicalPageData(pageKey, pageTitle, brand = {}, pages) {
  const buildMiddle = MEDICAL_MIDDLE_BY_KEY[pageKey];
  const content = [
    block(pageKey, 'NavBar', navBarProps(brand, pages)),
    block(pageKey, 'MedicalHero', MEDICAL_HERO_BY_KEY[pageKey] ?? genericMedicalHero(pageTitle)),
    ...(buildMiddle ? buildMiddle(pageKey) : genericMiddle(pageKey, pageTitle)),
    block(pageKey, 'Footer', footerProps(brand, pages)),
  ];
  return { root: { props: { title: pageTitle } }, content, zones: {} };
}

// ─── Construction pack seeder (KDL-558 task 3/5, homepage KDL-558 step N) ──
//
// Not wired to the Templates step yet. Home gets a full, real homepage
// (16 blocks) built from the construction pack's own components. About/
// Contact/generic pages keep the same lean NavBar + ConstructionHero +
// one section + Footer shape they always had — only Home's content
// changed here.

const CONSTRUCTION_HERO_BY_KEY = {
  about: {
    variant: '2',
    visible: true,
    d2BadgeText: '',
    d2Headline: 'About Our Company',
    d2HighlightWord: '',
    d2Subheadline:
      'Decades of building experience, one crew you can trust from groundbreak to handover.',
    d2CtaLabel: '',
    d2CtaHref: '#',
    d2SecondaryLabel: '',
    d2SecondaryHref: '#',
    d2Avatar1: '',
    d2Avatar2: '',
    d2Avatar3: '',
    d2TrustText: '',
    d2Slide1Image: dummyImage(900, 700, 'Our Team'),
    d2Slide1Tag: '',
    d2Slide1Title: '',
    d2Slide1Subtitle: '',
    d2Slide2Image: '',
    d2Slide2Tag: '',
    d2Slide2Title: '',
    d2Slide2Subtitle: '',
    d2Slide3Image: '',
    d2Slide3Tag: '',
    d2Slide3Title: '',
    d2Slide3Subtitle: '',
  },
  contact: {
    variant: '2',
    visible: true,
    d2BadgeText: '',
    d2Headline: 'Get a Free Quote',
    d2HighlightWord: '',
    d2Subheadline:
      'Tell us about your project and our estimators will get back to you within 48 hours.',
    d2CtaLabel: '',
    d2CtaHref: '#',
    d2SecondaryLabel: '',
    d2SecondaryHref: '#',
    d2Avatar1: '',
    d2Avatar2: '',
    d2Avatar3: '',
    d2TrustText: '',
    d2Slide1Image: dummyImage(900, 700, 'Contact Us'),
    d2Slide1Tag: '',
    d2Slide1Title: '',
    d2Slide1Subtitle: '',
    d2Slide2Image: '',
    d2Slide2Tag: '',
    d2Slide2Title: '',
    d2Slide2Subtitle: '',
    d2Slide3Image: '',
    d2Slide3Tag: '',
    d2Slide3Title: '',
    d2Slide3Subtitle: '',
  },
};

const CONSTRUCTION_STATS_STRIP = {
  stat1Value: '25+',
  stat1Label: 'Years in Business',
  stat2Value: '850+',
  stat2Label: 'Projects Completed',
  stat3Value: '₹500 Cr+',
  stat3Label: 'Work Executed',
  stat4Value: '98%',
  stat4Label: 'Client Satisfaction',
  background: 'dark',
  padding: 'md',
};

const CONSTRUCTION_QUOTE_CTA = {
  headline: 'Ready to Start Your Project?',
  subtext:
    'Get a detailed, no-obligation quote within 48 hours. Our estimators will assess your site and deliver a comprehensive scope of work.',
  ctaLabel: 'Request a Free Quote',
  ctaHref: '#contact',
  phoneNumber: '+91-98765-43210',
  phoneLabel: 'Or call us directly',
  background: 'dark',
};

const CONSTRUCTION_TEAM_CREW = {
  sectionTitle: 'Meet Our Team',
  sectionSubtitle: 'Experienced professionals committed to delivering quality on every project.',
  member1Name: 'Ramesh Kapoor',
  member1Role: 'Director & Project Head',
  member1Image: dummyImage(400, 400, 'RK'),
  member2Name: 'Sunita Joshi',
  member2Role: 'Senior Site Engineer',
  member2Image: dummyImage(400, 400, 'SJ'),
  member3Name: 'Arun Mehta',
  member3Role: 'Safety & Compliance Officer',
  member3Image: dummyImage(400, 400, 'AM'),
  member4Name: 'Priya Nair',
  member4Role: 'Estimation & Contracts',
  member4Image: dummyImage(400, 400, 'PN'),
  padding: 'md',
  background: 'white',
};

const CONSTRUCTION_TESTIMONIALS = {
  sectionTitle: 'What Our Clients Say',
  quote1Text:
    'The team delivered our 12-unit residential complex three weeks ahead of schedule, without a single quality defect. Exceptional work.',
  quote1Author: 'Venkat Reddy',
  quote1Company: 'Reddy Builders Pvt Ltd',
  quote1Initials: 'VR',
  quote2Text:
    'Their safety record across our 18-month infrastructure project was impeccable. Zero LTIs. We will work with them again.',
  quote2Author: 'Anita Sharma',
  quote2Company: 'National Highways Authority (Vendor)',
  quote2Initials: 'AS',
  quote3Text:
    'Transparent budgeting and weekly reporting made it easy to track progress. No surprises. Highly recommended.',
  quote3Author: 'Mohan Das',
  quote3Company: 'Das Commercial Properties',
  quote3Initials: 'MD',
  padding: 'md',
  background: 'white',
};

const CONSTRUCTION_MIDDLE_BY_KEY = {
  about: (pageKey) => [
    block(pageKey, 'ConstructionTeamCrew', CONSTRUCTION_TEAM_CREW),
    block(pageKey, 'ConstructionStatsStrip', CONSTRUCTION_STATS_STRIP),
  ],
  contact: (pageKey) => [block(pageKey, 'ConstructionQuoteCTA', CONSTRUCTION_QUOTE_CTA)],
};

// Same reasoning as genericHero()/genericMedicalHero() above.
function genericConstructionHero(pageTitle) {
  return {
    variant: '2',
    visible: true,
    d2BadgeText: '',
    d2Headline: pageTitle,
    d2HighlightWord: '',
    d2Subheadline: `Learn more about ${pageTitle.toLowerCase()}.`,
    d2CtaLabel: '',
    d2CtaHref: '#',
    d2SecondaryLabel: '',
    d2SecondaryHref: '#',
    d2Avatar1: '',
    d2Avatar2: '',
    d2Avatar3: '',
    d2TrustText: '',
    d2Slide1Image: dummyImage(900, 700, pageTitle),
    d2Slide1Tag: '',
    d2Slide1Title: '',
    d2Slide1Subtitle: '',
    d2Slide2Image: '',
    d2Slide2Tag: '',
    d2Slide2Title: '',
    d2Slide2Subtitle: '',
    d2Slide3Image: '',
    d2Slide3Tag: '',
    d2Slide3Title: '',
    d2Slide3Subtitle: '',
  };
}

// ─── Home page: full construction homepage (KDL-558) ────────────────────

const CONSTRUCTION_HERO_HOME = {
  variant: '1',
  visible: true,
  d1Slide1Image: dummyImage(1600, 900, 'Project One'),
  d1Slide1Badge: 'Residential',
  d1Slide1Headline: 'Building Homes That Last Generations',
  d1Slide1Subheadline:
    'Premium residential construction backed by two decades of craftsmanship.',
  d1Slide1CtaLabel: 'Get a Free Quote',
  d1Slide1CtaHref: '#quote',
  d1Slide2Image: dummyImage(1600, 900, 'Project Two'),
  d1Slide2Badge: 'Commercial',
  d1Slide2Headline: 'Commercial Spaces Built On Schedule',
  d1Slide2Subheadline:
    'From office parks to retail complexes, delivered on time and on budget.',
  d1Slide2CtaLabel: 'See Our Work',
  d1Slide2CtaHref: '#projects',
  d1Slide3Image: dummyImage(1600, 900, 'Project Three'),
  d1Slide3Badge: 'Infrastructure',
  d1Slide3Headline: 'Infrastructure That Moves Communities Forward',
  d1Slide3Subheadline:
    'Roads, bridges, and public works engineered to the highest safety standard.',
  d1Slide3CtaLabel: 'Start Your Project',
  d1Slide3CtaHref: '#quote',
};

const CONSTRUCTION_OFFERINGS_ROWS = {
  sectionTitle: 'Our Core Offerings',
  sectionSubtitle: 'Everything you need from a single, accountable contractor.',
  offering1NumberTag: '01',
  offering1Image: dummyImage(700, 500, 'Offering One'),
  offering1Heading: 'Structural Construction',
  offering1Description: 'End-to-end structural builds engineered to code, from footings to rooftop.',
  offering1BrandNames: 'Brand One · Brand Two',
  offering1Href: '#',
  offering2NumberTag: '02',
  offering2Image: dummyImage(700, 500, 'Offering Two'),
  offering2Heading: 'MEP & Systems Integration',
  offering2Description: 'Mechanical, electrical, and plumbing systems coordinated under one schedule.',
  offering2BrandNames: 'Brand Three · Brand Four',
  offering2Href: '#',
  offering3NumberTag: '03',
  offering3Image: dummyImage(700, 500, 'Offering Three'),
  offering3Heading: 'Finishing & Interiors',
  offering3Description: 'Precision finishing work that turns a shell into a move-in-ready space.',
  offering3BrandNames: 'Brand Five · Brand Six',
  offering3Href: '#',
  padding: 'md',
  background: 'white',
};

const CONSTRUCTION_ABOUT_SPLIT = {
  eyebrow: 'About Us',
  heading: 'Two Decades of Building With Integrity',
  paragraph:
    'We are a full-service general contractor delivering residential, commercial, and infrastructure projects. Our in-house engineering and project management teams keep every job transparent, on schedule, and within budget.',
  photo: dummyImage(700, 800, 'Our Team'),
  badgeNumber: '15+',
  badgeLabel: 'Years Experience',
  check1Text: 'Licensed & fully insured',
  check2Text: 'In-house engineering team',
  check3Text: 'Transparent weekly reporting',
  brochureLabel: 'Download Brochure',
  brochureHref: '#',
  padding: 'md',
  background: 'white',
};

const CONSTRUCTION_PROCESS_TIMELINE = {
  sectionTitle: 'How We Work',
  sectionSubtitle: 'A structured, transparent process from consultation to project handover.',
  step1Title: 'Initial Consultation',
  step1Description:
    'We listen to your vision, review the site, and understand your budget and timeline constraints.',
  step2Title: 'Detailed Estimation',
  step2Description:
    'Our estimators produce a line-item BOQ with material specifications, labour rates, and contingencies.',
  step3Title: 'Contract & Mobilisation',
  step3Description:
    'We finalise scope, sign a fixed-price contract, obtain permits, and mobilise crew and machinery.',
  step4Title: 'Construction & Oversight',
  step4Description:
    'Daily site management, weekly client progress reports, and third-party quality audits throughout execution.',
  step5Title: 'Handover & Warranty',
  step5Description:
    'Final snag clearance, documentation handover, and a 12-month defect liability period for your peace of mind.',
  padding: 'md',
  background: 'white',
};

const CONSTRUCTION_SECTORS_GRID = {
  sectionTitle: 'Sectors We Serve',
  sectionSubtitle: 'Specialised delivery across every major construction vertical.',
  project1Title: 'Sector One',
  project1Category: 'Residential',
  project1Image: dummyImage(600, 450, 'Sector One'),
  project1NumberTag: '01',
  project1Description: 'Placeholder description for this sector.',
  project1Href: '#sector-1',
  project2Title: 'Sector Two',
  project2Category: 'Commercial',
  project2Image: dummyImage(600, 450, 'Sector Two'),
  project2NumberTag: '02',
  project2Description: 'Placeholder description for this sector.',
  project2Href: '#sector-2',
  project3Title: 'Sector Three',
  project3Category: 'Infrastructure',
  project3Image: dummyImage(600, 450, 'Sector Three'),
  project3NumberTag: '03',
  project3Description: 'Placeholder description for this sector.',
  project3Href: '#sector-3',
  project4Title: 'Sector Four',
  project4Category: 'Institutional',
  project4Image: dummyImage(600, 450, 'Sector Four'),
  project4NumberTag: '04',
  project4Description: 'Placeholder description for this sector.',
  project4Href: '#sector-4',
  project5Title: 'Sector Five',
  project5Category: 'Industrial',
  project5Image: dummyImage(600, 450, 'Sector Five'),
  project5NumberTag: '05',
  project5Description: 'Placeholder description for this sector.',
  project5Href: '#sector-5',
  project6Title: 'Sector Six',
  project6Category: 'Specialist',
  project6Image: dummyImage(600, 450, 'Sector Six'),
  project6NumberTag: '06',
  project6Description: 'Placeholder description for this sector.',
  project6Href: '#sector-6',
  project7Title: 'Sector Seven',
  project7Category: 'Hospitality',
  project7Image: dummyImage(600, 450, 'Sector Seven'),
  project7NumberTag: '07',
  project7Description: 'Placeholder description for this sector.',
  project7Href: '#sector-7',
  project8Title: 'Sector Eight',
  project8Category: 'Retail',
  project8Image: dummyImage(600, 450, 'Sector Eight'),
  project8NumberTag: '08',
  project8Description: 'Placeholder description for this sector.',
  project8Href: '#sector-8',
  padding: 'md',
};

const CONSTRUCTION_FEATURED_PROJECT = {
  sectionTitle: 'Featured Project',
  image: dummyImage(900, 650, 'Featured Project'),
  paragraph:
    'A ground-up commercial build delivered across 14 months — from site mobilisation to final handover — with zero schedule slippage.',
  scope1Icon: 'hardhat',
  scope1Label: 'Site Development',
  scope2Icon: 'shield',
  scope2Label: 'Safety Compliance',
  scope3Icon: 'star',
  scope3Label: 'Quality Assurance',
  scope4Icon: 'hardhat',
  scope4Label: 'MEP Coordination',
  linkLabel: 'View Case Study',
  linkHref: '#',
  ctaLabel: 'Start Your Project',
  ctaHref: '#quote',
  padding: 'md',
  background: 'muted',
};

const CONSTRUCTION_PRODUCTS_SHOWCASE = {
  sectionTitle: 'Our Products',
  sectionSubtitle: 'Sourced and supplied through our vetted vendor network.',
  category1Label: 'Category One',
  category2Label: 'Category Two',
  category3Label: 'Category Three',
  category4Label: 'Category Four',
  product1Category: 'Category One',
  product1Icon: 'hardhat',
  product1Title: 'Product One',
  product1Description: 'Placeholder product description for this listing.',
  product2Category: 'Category One',
  product2Icon: 'shield',
  product2Title: 'Product Two',
  product2Description: 'Placeholder product description for this listing.',
  product3Category: 'Category Two',
  product3Icon: 'star',
  product3Title: 'Product Three',
  product3Description: 'Placeholder product description for this listing.',
  product4Category: 'Category Two',
  product4Icon: 'hardhat',
  product4Title: 'Product Four',
  product4Description: 'Placeholder product description for this listing.',
  product5Category: 'Category Three',
  product5Icon: 'shield',
  product5Title: 'Product Five',
  product5Description: 'Placeholder product description for this listing.',
  product6Category: 'Category Three',
  product6Icon: 'star',
  product6Title: 'Product Six',
  product6Description: 'Placeholder product description for this listing.',
  product7Category: 'Category Four',
  product7Icon: 'hardhat',
  product7Title: 'Product Seven',
  product7Description: 'Placeholder product description for this listing.',
  product8Category: 'Category Four',
  product8Icon: 'shield',
  product8Title: 'Product Eight',
  product8Description: 'Placeholder product description for this listing.',
  padding: 'md',
  background: 'white',
};

const CONSTRUCTION_WHY_CHOOSE_US = {
  sectionTitle: 'Why Choose Us',
  sectionSubtitle:
    'We combine deep technical expertise with a relentless focus on timelines, budget, and safety.',
  point1Title: 'Fixed-Price Contracts',
  point1Description: 'No surprises. We absorb cost overruns within scope — your budget stays intact.',
  point2Title: 'Licensed & Insured',
  point2Description:
    'Fully licensed by PWD, CPWD-empanelled, and covered under comprehensive workmen compensation.',
  point3Title: 'On-Time Delivery',
  point3Description:
    '93% of our projects are delivered on or before the agreed schedule over the last 5 years.',
  point4Title: '24/7 Site Supervision',
  point4Description:
    'Dedicated engineers on-site daily. Real-time reporting via our project management portal.',
  ctaLabel: 'Start a Conversation',
  ctaHref: '#contact',
  padding: 'md',
  background: 'white',
};

const CONSTRUCTION_CLIENTS_GRID = {
  sectionTitle: 'Trusted By',
  sectionSubtitle: 'A selection of clients we have partnered with.',
  client1Logo: dummyLogo(200, 100, 'Client 1'),
  client1Name: 'Client 1',
  client2Logo: dummyLogo(200, 100, 'Client 2'),
  client2Name: 'Client 2',
  client3Logo: dummyLogo(200, 100, 'Client 3'),
  client3Name: 'Client 3',
  client4Logo: dummyLogo(200, 100, 'Client 4'),
  client4Name: 'Client 4',
  client5Logo: dummyLogo(200, 100, 'Client 5'),
  client5Name: 'Client 5',
  client6Logo: dummyLogo(200, 100, 'Client 6'),
  client6Name: 'Client 6',
  client7Logo: dummyLogo(200, 100, 'Client 7'),
  client7Name: 'Client 7',
  client8Logo: dummyLogo(200, 100, 'Client 8'),
  client8Name: 'Client 8',
  client9Logo: dummyLogo(200, 100, 'Client 9'),
  client9Name: 'Client 9',
  client10Logo: dummyLogo(200, 100, 'Client 10'),
  client10Name: 'Client 10',
  client11Logo: dummyLogo(200, 100, 'Client 11'),
  client11Name: 'Client 11',
  client12Logo: dummyLogo(200, 100, 'Client 12'),
  client12Name: 'Client 12',
  padding: 'md',
  background: 'white',
};

const CONSTRUCTION_LEAD_FORM_FAQ = {
  sectionTitle: 'Frequently Asked Questions',
  faq1Question: 'How long does a typical project take?',
  faq1Answer: 'Timelines vary by scope — a detailed schedule is provided after site assessment.',
  faq2Question: 'Do you provide fixed-price contracts?',
  faq2Answer: 'Yes, most projects are quoted and contracted on a fixed-price basis.',
  faq3Question: 'Are you licensed and insured?',
  faq3Answer: 'Yes, we are fully licensed and carry comprehensive insurance cover.',
  faq4Question: 'Can I see your past work?',
  faq4Answer: 'Yes — see the Sectors and Featured Project sections above, or request our portfolio.',
  faq5Question: 'Do you handle permits and approvals?',
  faq5Answer: 'Yes, permit acquisition is coordinated as part of our project management scope.',
  faq6Question: 'What areas do you serve?',
  faq6Answer: 'We currently serve residential and commercial clients across the region.',
  formHeading: 'Get a Free Quote',
  formSubtext: 'Tell us about your project and our team will get back to you within 48 hours.',
  padding: 'md',
  background: 'white',
};

function phoneDigitsOnly(value) {
  return String(value ?? '').replace(/[^\d]/g, '');
}

function constructionFloatingActionsProps(brand = {}) {
  const digits = phoneDigitsOnly(brand.phone);
  return {
    whatsappHref: digits ? `https://wa.me/${digits}` : 'https://wa.me/919876543210',
    // Trust badge bottom-right, WhatsApp/brochure buttons bottom-left;
    // editable per page in the Section Builder (Left/Right).
    badgeSide: 'right',
    actionsSide: 'left',
  };
}

function constructionHeaderProps(brand = {}, pages) {
  return {
    brand: brand.companyName || 'Your Brand',
    logoUrl: brand.logoUrl || '',
    links: navLinksFor(pages),
    loginLabel: 'Login',
    loginHref: '#login',
    ctaLabel: 'Get a Quote',
    ctaHref: '#quote',
    ctaNewTab: false,
    primaryColor: brand.primaryHex || '',
    secondaryColor: brand.secondaryHex || '',
    phoneNumber: brand.phone || '+91 98765 43210',
    email: brand.email || `hello@${(brand.companyName || 'yourdomain').toLowerCase().replace(/\s+/g, '')}.com`,
    social1Href: '#',
    social2Href: '#',
    social3Href: '#',
    social4Href: '#',
  };
}

function constructionTaglineStripProps(brand = {}) {
  return {
    logoUrl: brand.logoUrl || '',
    brand: brand.companyName || 'Your Brand',
    tagline: 'Building with integrity, delivering with precision.',
  };
}

function constructionFooterProps(brand = {}, pages) {
  const name = brand.companyName || 'Your Brand';
  const lastUpdated = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const addressLines = Array.isArray(brand.addressLines) ? brand.addressLines : [];
  return {
    logoUrl: brand.logoUrl || '',
    brand: name,
    tagline: 'Building with integrity, delivering with precision.',
    social1Label: 'f',
    social1Href: '#',
    social2Label: 'in',
    social2Href: '#',
    social3Label: 'ig',
    social3Href: '#',
    social4Label: 'x',
    social4Href: '#',
    companyLinksTitle: 'Company',
    links: navLinksFor(pages),
    contactTitle: 'Contact',
    contactPhone: brand.phone || '+91-98765-43210',
    contactEmail: brand.email || `info@${name.toLowerCase().replace(/\s+/g, '')}.com`,
    // Address 1 in Studio's Intake form (Logo & Contact Details) — usually
    // the main/showroom address — is the "Contact" block's address; Address
    // 2 (often a registered-office address) becomes the separate "Showroom"
    // block below, same two-slot mapping either way round.
    contactAddress: addressLines[0] || '123 Business Avenue\nCity, State 000000',
    showroomTitle: 'Showroom',
    showroomAddress: addressLines[1] || '456 Showroom Road\nCity, State 000000',
    qrImage: dummyLogo(160, 160, 'QR Code'),
    qrCaption: 'Scan for directions',
    copyright: `© ${new Date().getFullYear()} ${name}. All rights reserved. · Last updated ${lastUpdated}`,
  };
}

// Layout picker's own footer prop builder — separate from
// constructionFooterProps() above (used by the construction pack's own
// seedConstructionPageData home content, which has its own tests pinned to
// that function's original two-slot address mapping) so this design's
// richer field set (two phones/emails, a distinct "Regd. Office" block)
// doesn't change that unrelated seed path. Matches the frontend's
// ConstructionFooter defaultProps/field set.
function layoutFooterProps(brand, pages) {
  const addressLines = Array.isArray(brand.addressLines) ? brand.addressLines : [];
  return {
    ...constructionFooterProps(brand, pages),
    variant: '1',
    contactPhone2: brand.secondaryPhone || '',
    contactEmail2: brand.secondaryEmail || '',
    showroomAddress: addressLines[0] || '456 Showroom Road\nCity, State 000000',
    regdOfficeTitle: 'Regd. Office',
    regdOfficeAddress: addressLines[1] || '',
    estdYear: '',
  };
}

function constructionHomeContent(pageKey, brand, pages) {
  return [
    block(pageKey, 'ConstructionHeader', constructionHeaderProps(brand, pages)),
    block(pageKey, 'ConstructionHero', CONSTRUCTION_HERO_HOME),
    block(pageKey, 'ConstructionStatsStrip', CONSTRUCTION_STATS_STRIP),
    block(pageKey, 'ConstructionOfferingsRows', CONSTRUCTION_OFFERINGS_ROWS),
    block(pageKey, 'ConstructionAboutSplit', CONSTRUCTION_ABOUT_SPLIT),
    block(pageKey, 'ConstructionProcessTimeline', CONSTRUCTION_PROCESS_TIMELINE),
    block(pageKey, 'ConstructionProjectGallery', CONSTRUCTION_SECTORS_GRID),
    block(pageKey, 'ConstructionFeaturedProject', CONSTRUCTION_FEATURED_PROJECT),
    block(pageKey, 'ConstructionProductsShowcase', CONSTRUCTION_PRODUCTS_SHOWCASE),
    block(pageKey, 'ConstructionWhyChooseUs', CONSTRUCTION_WHY_CHOOSE_US),
    block(pageKey, 'ConstructionClientsGrid', CONSTRUCTION_CLIENTS_GRID),
    block(pageKey, 'ConstructionTestimonials', CONSTRUCTION_TESTIMONIALS),
    block(pageKey, 'ConstructionLeadFormFAQ', CONSTRUCTION_LEAD_FORM_FAQ),
    block(pageKey, 'ConstructionTaglineStrip', constructionTaglineStripProps(brand)),
    block(pageKey, 'ConstructionFooter', constructionFooterProps(brand, pages)),
    block(pageKey, 'ConstructionFloatingActions', constructionFloatingActionsProps(brand)),
  ];
}

export function seedConstructionPageData(pageKey, pageTitle, brand = {}, pages) {
  if (pageKey === 'home') {
    return {
      root: { props: { title: pageTitle } },
      content: constructionHomeContent(pageKey, brand, pages),
      zones: {},
    };
  }
  const buildMiddle = CONSTRUCTION_MIDDLE_BY_KEY[pageKey];
  const content = [
    block(pageKey, 'NavBar', navBarProps(brand, pages)),
    block(
      pageKey,
      'ConstructionHero',
      CONSTRUCTION_HERO_BY_KEY[pageKey] ?? genericConstructionHero(pageTitle)
    ),
    ...(buildMiddle ? buildMiddle(pageKey) : genericMiddle(pageKey, pageTitle)),
    block(pageKey, 'Footer', footerProps(brand, pages)),
  ];
  return { root: { props: { title: pageTitle } }, content, zones: {} };
}
