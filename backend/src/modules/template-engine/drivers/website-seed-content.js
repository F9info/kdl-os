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

// Home page's nav/hero/info-cards — an exact-structure port of the design
// reference's medHeader()/medHome() (KDL-558, "add this page first"). Uses
// the medical pack's MedicalTopNav/MedicalHeroSplit/MedicalContactInfoCards
// components (Puck merges every pack into one flat registry, so mixing
// general + medical component types on one page is fine) since the
// Templates picker was removed — this is now the only seed path, so it's
// what "View all pages" always shows for Home. About/Contact still use the
// general pack's NavBar/Hero for now — next step per the same request.
const TOPNAV = {
  welcomeText: 'Welcome — Your Health, Our Priority!',
  phone: '(123) 456 7890',
  hours: 'Mon–Sat: 8:00–18:00',
  brand: 'Your Brand',
  navLinks: NAV_LINKS,
  ctaLabel: 'Appointment',
  ctaHref: '#appointment',
};

const HOME_HERO = {
  eyebrow: 'Welcome to our clinic',
  headingLine1: 'Your Health',
  headingLine2: 'Our Priority',
  subtext: "We provide the best medical services for you and your family's health.",
  primaryLabel: 'Our Services',
  primaryHref: '#services',
  secondaryLabel: 'Contact Us',
  secondaryHref: '#contact',
  image: 'https://placehold.co/900x800',
};

const CONTACT_INFO_CARDS = {
  cells: [
    'phone|Emergency Case|(123) 456 7890',
    'clock|Opening Hours|Mon–Sat: 8:00–18:00',
    'location|Location|123 Medical Street, NY',
    'email|Email Us|info@yourbrand.com',
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

function headerBlocks(pageKey) {
  if (pageKey === 'home') {
    return [
      block(pageKey, 'MedicalTopNav', TOPNAV),
      block(pageKey, 'MedicalHeroSplit', HOME_HERO),
      block(pageKey, 'MedicalContactInfoCards', CONTACT_INFO_CARDS),
    ];
  }
  return [
    block(pageKey, 'NavBar', NAV_BAR),
    block(pageKey, 'Hero', HERO_BY_KEY[pageKey] ?? HERO_BY_KEY.home),
  ];
}

export function seedWebsitePageData(pageKey, pageTitle) {
  const buildMiddle = MIDDLE_BLOCKS_BY_KEY[pageKey] ?? MIDDLE_BLOCKS_BY_KEY.home;
  const content = [...headerBlocks(pageKey), ...buildMiddle(pageKey), block(pageKey, 'Footer', FOOTER)];
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

const MEDICAL_DOCTOR_PROFILES = {
  sectionTitle: 'Meet Our Specialists',
  sectionSubtitle: 'Experienced, board-certified doctors dedicated to your care.',
  doctors: [
    'Dr. Priya Sharma | MD, DM | Cardiologist | https://placehold.co/400x400',
    'Dr. Rahul Mehta | MS, DNB | Orthopaedic Surgeon | https://placehold.co/400x400',
    'Dr. Ananya Patel | MBBS, MD | Neurologist | https://placehold.co/400x400',
    'Dr. Sunita Rao | MS, FMAS | Gynaecologist | https://placehold.co/400x400',
  ].join('\n'),
};

const MEDICAL_APPOINTMENT_CTA = {
  headline: 'Ready to See a Doctor?',
  subtext: 'Book online in minutes or call us to speak with our care team.',
  primaryLabel: 'Book Appointment Online',
  primaryHref: '#book',
  secondaryLabel: 'View All Doctors',
  secondaryHref: '#doctors',
  phoneNumber: '+91 98765 43210',
};

const MEDICAL_PATIENT_TESTIMONIALS = {
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

export function seedMedicalPageData(pageKey, pageTitle) {
  const buildMiddle = MEDICAL_MIDDLE_BY_KEY[pageKey] ?? MEDICAL_MIDDLE_BY_KEY.home;
  const content = [
    block(pageKey, 'NavBar', NAV_BAR),
    block(pageKey, 'MedicalHero', MEDICAL_HERO_BY_KEY[pageKey] ?? MEDICAL_HERO_BY_KEY.home),
    ...buildMiddle(pageKey),
    block(pageKey, 'Footer', FOOTER),
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
    backgroundImage: 'https://placehold.co/1600x800/1e293b/ffffff?text=Construction+Site',
    overlay: true,
  },
  about: {
    headline: 'About Our Company',
    subheadline: 'Decades of building experience, one crew you can trust from groundbreak to handover.',
    ctaLabel: '',
    ctaHref: '#',
    secondaryLabel: '',
    secondaryHref: '#',
    backgroundImage: 'https://placehold.co/1600x800/1e293b/ffffff?text=Our+Team',
    overlay: true,
  },
  contact: {
    headline: 'Get a Free Quote',
    subheadline: 'Tell us about your project and our estimators will get back to you within 48 hours.',
    ctaLabel: '',
    ctaHref: '#',
    secondaryLabel: '',
    secondaryHref: '#',
    backgroundImage: 'https://placehold.co/1600x800/1e293b/ffffff?text=Contact+Us',
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
  member1Image: 'https://placehold.co/400x400/475569/ffffff?text=RK',
  member2Name: 'Sunita Joshi',
  member2Role: 'Senior Site Engineer',
  member2Image: 'https://placehold.co/400x400/334155/ffffff?text=SJ',
  member3Name: 'Arun Mehta',
  member3Role: 'Safety & Compliance Officer',
  member3Image: 'https://placehold.co/400x400/1e293b/ffffff?text=AM',
  member4Name: 'Priya Nair',
  member4Role: 'Estimation & Contracts',
  member4Image: 'https://placehold.co/400x400/0f172a/ffffff?text=PN',
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

export function seedConstructionPageData(pageKey, pageTitle) {
  const buildMiddle = CONSTRUCTION_MIDDLE_BY_KEY[pageKey] ?? CONSTRUCTION_MIDDLE_BY_KEY.home;
  const content = [
    block(pageKey, 'NavBar', NAV_BAR),
    block(
      pageKey,
      'ConstructionHero',
      CONSTRUCTION_HERO_BY_KEY[pageKey] ?? CONSTRUCTION_HERO_BY_KEY.home
    ),
    ...buildMiddle(pageKey),
    block(pageKey, 'Footer', FOOTER),
  ];
  return { root: { props: { title: pageTitle } }, content, zones: {} };
}
