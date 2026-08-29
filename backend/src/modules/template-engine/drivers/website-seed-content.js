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
// CSP img-src or internet access, unlike the placehold.co URLs this replaced.
function dummyImage(w, h, label) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<rect width="100%" height="100%" fill="#e2e8f0"/>` +
    `<text x="50%" y="50%" font-family="sans-serif" font-size="${Math.round(Math.min(w, h) / 10)}" ` +
    `fill="#64748b" text-anchor="middle" dominant-baseline="middle">${label || `${w}×${h}`}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const DEFAULT_NAV_LINKS = ['Home|#', 'About|#', 'Contact|#'].join('\n');

// `pages` is the full { key, title } list this run is assembling (see
// resolveSeedPages in drivers/index.js) — every seeded page's nav/footer
// links to every OTHER seeded page, not just a hardcoded Home/About/Contact.
// Falls back to the 3-link default when called with no page list (keeps
// working for any caller that predates navigationPages). Href stays the `#`
// placeholder convention Home already used: "View all pages"
// (template-engine/site/page.tsx) navigates by matching a clicked link's
// TEXT against page titles, not by following the href.
function navLinksFor(pages) {
  if (!Array.isArray(pages) || pages.length === 0) return DEFAULT_NAV_LINKS;
  return pages.map(({ title }) => `${title}|#`).join('\n');
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
    `${dummyImage(120, 48, 'Star Health')} | Star Health`,
    `${dummyImage(120, 48, 'HDFC Ergo')} | HDFC Ergo`,
    `${dummyImage(120, 48, 'Bajaj Allianz')} | Bajaj Allianz`,
    `${dummyImage(120, 48, 'New India')} | New India Assurance`,
    `${dummyImage(120, 48, 'Care Health')} | Care Health`,
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
    badgeText: '',
    headline: 'About Our Company',
    highlightWord: '',
    subheadline:
      'Decades of building experience, one crew you can trust from groundbreak to handover.',
    ctaLabel: '',
    ctaHref: '#',
    secondaryLabel: '',
    secondaryHref: '#',
    avatar1: '',
    avatar2: '',
    avatar3: '',
    trustText: '',
    slide1Image: dummyImage(900, 700, 'Our Team'),
    slide1Tag: '',
    slide1Title: '',
    slide1Subtitle: '',
    slide2Image: '',
    slide2Tag: '',
    slide2Title: '',
    slide2Subtitle: '',
    slide3Image: '',
    slide3Tag: '',
    slide3Title: '',
    slide3Subtitle: '',
    slide4Image: '',
    slide4Tag: '',
    slide4Title: '',
    slide4Subtitle: '',
    slide5Image: '',
    slide5Tag: '',
    slide5Title: '',
    slide5Subtitle: '',
  },
  contact: {
    badgeText: '',
    headline: 'Get a Free Quote',
    highlightWord: '',
    subheadline:
      'Tell us about your project and our estimators will get back to you within 48 hours.',
    ctaLabel: '',
    ctaHref: '#',
    secondaryLabel: '',
    secondaryHref: '#',
    avatar1: '',
    avatar2: '',
    avatar3: '',
    trustText: '',
    slide1Image: dummyImage(900, 700, 'Contact Us'),
    slide1Tag: '',
    slide1Title: '',
    slide1Subtitle: '',
    slide2Image: '',
    slide2Tag: '',
    slide2Title: '',
    slide2Subtitle: '',
    slide3Image: '',
    slide3Tag: '',
    slide3Title: '',
    slide3Subtitle: '',
    slide4Image: '',
    slide4Tag: '',
    slide4Title: '',
    slide4Subtitle: '',
    slide5Image: '',
    slide5Tag: '',
    slide5Title: '',
    slide5Subtitle: '',
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
    badgeText: '',
    headline: pageTitle,
    highlightWord: '',
    subheadline: `Learn more about ${pageTitle.toLowerCase()}.`,
    ctaLabel: '',
    ctaHref: '#',
    secondaryLabel: '',
    secondaryHref: '#',
    avatar1: '',
    avatar2: '',
    avatar3: '',
    trustText: '',
    slide1Image: dummyImage(900, 700, pageTitle),
    slide1Tag: '',
    slide1Title: '',
    slide1Subtitle: '',
    slide2Image: '',
    slide2Tag: '',
    slide2Title: '',
    slide2Subtitle: '',
    slide3Image: '',
    slide3Tag: '',
    slide3Title: '',
    slide3Subtitle: '',
    slide4Image: '',
    slide4Tag: '',
    slide4Title: '',
    slide4Subtitle: '',
    slide5Image: '',
    slide5Tag: '',
    slide5Title: '',
    slide5Subtitle: '',
  };
}

// ─── Home page: full construction homepage (KDL-558) ────────────────────

const CONSTRUCTION_HERO_HOME = {
  badgeText: 'Trusted General Contractor',
  headline: 'Building Your Vision, On Time & On Budget',
  highlightWord: 'Vision',
  subheadline:
    'Award-winning general contractor serving residential and commercial clients across the region. Licensed, insured, and safety-certified.',
  ctaLabel: 'Get a Free Quote',
  ctaHref: '#quote',
  secondaryLabel: 'See Our Work',
  secondaryHref: '#projects',
  avatar1: dummyImage(80, 80, 'C1'),
  avatar2: dummyImage(80, 80, 'C2'),
  avatar3: dummyImage(80, 80, 'C3'),
  trustText: '500+ clients trust us',
  slide1Image: dummyImage(900, 700, 'Project One'),
  slide1Tag: 'Residential',
  slide1Title: 'Riverside Villas',
  slide1Subtitle: 'A 24-unit residential development delivered ahead of schedule.',
  slide2Image: dummyImage(900, 700, 'Project Two'),
  slide2Tag: 'Commercial',
  slide2Title: 'Tech Park Phase 2',
  slide2Subtitle: 'A 6-storey commercial office park with LEED-aligned design.',
  slide3Image: dummyImage(900, 700, 'Project Three'),
  slide3Tag: 'Infrastructure',
  slide3Title: 'Highway Bridge Rehab',
  slide3Subtitle: 'Structural rehabilitation completed with zero traffic disruption.',
  slide4Image: dummyImage(900, 700, 'Project Four'),
  slide4Tag: 'Institutional',
  slide4Title: 'School Expansion Wing',
  slide4Subtitle: 'A new academic wing built during active term time.',
  slide5Image: dummyImage(900, 700, 'Project Five'),
  slide5Tag: 'Industrial',
  slide5Title: 'Industrial Warehouse',
  slide5Subtitle: 'A 90,000 sq ft warehouse and logistics facility.',
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
  client1Logo: dummyImage(200, 100, 'Client 1'),
  client1Name: 'Client 1',
  client2Logo: dummyImage(200, 100, 'Client 2'),
  client2Name: 'Client 2',
  client3Logo: dummyImage(200, 100, 'Client 3'),
  client3Name: 'Client 3',
  client4Logo: dummyImage(200, 100, 'Client 4'),
  client4Name: 'Client 4',
  client5Logo: dummyImage(200, 100, 'Client 5'),
  client5Name: 'Client 5',
  client6Logo: dummyImage(200, 100, 'Client 6'),
  client6Name: 'Client 6',
  client7Logo: dummyImage(200, 100, 'Client 7'),
  client7Name: 'Client 7',
  client8Logo: dummyImage(200, 100, 'Client 8'),
  client8Name: 'Client 8',
  client9Logo: dummyImage(200, 100, 'Client 9'),
  client9Name: 'Client 9',
  client10Logo: dummyImage(200, 100, 'Client 10'),
  client10Name: 'Client 10',
  client11Logo: dummyImage(200, 100, 'Client 11'),
  client11Name: 'Client 11',
  client12Logo: dummyImage(200, 100, 'Client 12'),
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

const CONSTRUCTION_FLOATING_ACTIONS = {
  whatsappHref: 'https://wa.me/919876543210',
};

function constructionHeaderProps(brand = {}, pages) {
  return {
    brand: brand.companyName || 'Your Brand',
    logoUrl: brand.logoUrl || '',
    links: navLinksFor(pages),
    loginLabel: 'Login',
    loginHref: '#login',
    ctaLabel: 'Get a Quote',
    ctaHref: '#quote',
    primaryColor: brand.primaryHex || '',
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
    newsletterPlaceholder: 'Your email address',
    newsletterButtonLabel: 'Subscribe',
    companyLinksTitle: 'Company',
    links: navLinksFor(pages),
    contactTitle: 'Contact',
    contactPhone: '+91-98765-43210',
    contactEmail: `info@${name.toLowerCase().replace(/\s+/g, '')}.com`,
    contactAddress: '123 Business Avenue\nCity, State 000000',
    showroomTitle: 'Showroom',
    showroomAddress: '456 Showroom Road\nCity, State 000000',
    qrImage: dummyImage(160, 160, 'QR Code'),
    qrCaption: 'Scan for directions',
    copyright: `© ${new Date().getFullYear()} ${name}. All rights reserved. · Last updated ${lastUpdated}`,
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
    block(pageKey, 'ConstructionFloatingActions', CONSTRUCTION_FLOATING_ACTIONS),
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
