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
