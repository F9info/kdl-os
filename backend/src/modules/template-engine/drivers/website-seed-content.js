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

const NAV_LINK_PROP_BY_BLOCK_TYPE = { NavBar: 'links', Footer: 'links', MedicalTopNav: 'navLinks' };

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

// ─── Construction pack seeder (KDL-558 task 3/5) ─────────────────────────
//
// Not wired to the Templates step yet (task 4). Same approach as the
// medical seeder: general pack's NavBar/Footer for chrome, real
// ConstructionX components for the body, each using that component's own
// defaultProps verbatim (frontend/src/app/admin/page-builder/packs/
// construction/index.tsx).

const CONSTRUCTION_HERO_BY_KEY = {
  home: {
    headline: 'Building Your Vision, On Time & On Budget',
    subheadline:
      'Award-winning general contractor serving residential and commercial clients across the region. Licensed, insured, and safety-certified.',
    ctaLabel: 'Get a Free Quote',
    ctaHref: '#quote',
    secondaryLabel: 'View Our Projects',
    secondaryHref: '#projects',
    backgroundImage: dummyImage(1600, 800, 'Construction Site'),
    overlay: true,
  },
  about: {
    headline: 'About Our Company',
    subheadline: 'Decades of building experience, one crew you can trust from groundbreak to handover.',
    ctaLabel: '',
    ctaHref: '#',
    secondaryLabel: '',
    secondaryHref: '#',
    backgroundImage: dummyImage(1600, 800, 'Our Team'),
    overlay: true,
  },
  contact: {
    headline: 'Get a Free Quote',
    subheadline: 'Tell us about your project and our estimators will get back to you within 48 hours.',
    ctaLabel: '',
    ctaHref: '#',
    secondaryLabel: '',
    secondaryHref: '#',
    backgroundImage: dummyImage(1600, 800, 'Contact Us'),
    overlay: true,
  },
};

const CONSTRUCTION_SERVICES_GRID = {
  sectionTitle: 'Our Services',
  sectionSubtitle: 'From foundations to finishes — we handle every phase of your construction project.',
  service1Title: 'New Construction',
  service1Description:
    'Ground-up residential and commercial builds to your specifications and local codes.',
  service2Title: 'Renovations & Remodeling',
  service2Description:
    'Transform existing spaces with structural updates, expansions, and interior upgrades.',
  service3Title: 'Roofing & Waterproofing',
  service3Description:
    'Durable roofing installations, repairs, and waterproofing systems for all climates.',
  service4Title: 'Concrete & Foundations',
  service4Description: 'Footings, slabs, retaining walls, and structural concrete poured to spec.',
  service5Title: 'Electrical & MEP',
  service5Description:
    'Full mechanical, electrical, and plumbing coordination with licensed subcontractors.',
  service6Title: 'Project Management',
  service6Description:
    'End-to-end oversight, scheduling, procurement, and quality control on every site.',
  padding: 'md',
  background: 'white',
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
  quote2Text:
    'Their safety record across our 18-month infrastructure project was impeccable. Zero LTIs. We will work with them again.',
  quote2Author: 'Anita Sharma',
  quote2Company: 'National Highways Authority (Vendor)',
  quote3Text:
    'Transparent budgeting and weekly reporting made it easy to track progress. No surprises. Highly recommended.',
  quote3Author: 'Mohan Das',
  quote3Company: 'Das Commercial Properties',
  padding: 'md',
  background: 'white',
};

const CONSTRUCTION_MIDDLE_BY_KEY = {
  home: (pageKey) => [
    block(pageKey, 'ConstructionServicesGrid', CONSTRUCTION_SERVICES_GRID),
    block(pageKey, 'ConstructionStatsStrip', CONSTRUCTION_STATS_STRIP),
    block(pageKey, 'ConstructionQuoteCTA', CONSTRUCTION_QUOTE_CTA),
    block(pageKey, 'ConstructionTestimonials', CONSTRUCTION_TESTIMONIALS),
  ],
  about: (pageKey) => [
    block(pageKey, 'ConstructionTeamCrew', CONSTRUCTION_TEAM_CREW),
    block(pageKey, 'ConstructionStatsStrip', CONSTRUCTION_STATS_STRIP),
  ],
  contact: (pageKey) => [block(pageKey, 'ConstructionQuoteCTA', CONSTRUCTION_QUOTE_CTA)],
};

// Same reasoning as genericHero()/genericMedicalHero() above.
function genericConstructionHero(pageTitle) {
  return {
    headline: pageTitle,
    subheadline: `Learn more about ${pageTitle.toLowerCase()}.`,
    ctaLabel: '',
    ctaHref: '#',
    secondaryLabel: '',
    secondaryHref: '#',
    backgroundImage: dummyImage(1600, 800, pageTitle),
    overlay: true,
  };
}

export function seedConstructionPageData(pageKey, pageTitle, brand = {}, pages) {
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
