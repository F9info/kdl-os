import type { Config } from '@puckeditor/core'
import type { ComponentPack } from '../types'

type MedicalProps = {
  MedicalHero: {
    headline: string
    subheadline: string
    ctaLabel: string
    ctaHref: string
    badge: string
    align: 'left' | 'center'
  }
  MedicalServicesList: {
    sectionTitle: string
    sectionSubtitle: string
    services: string
  }
  MedicalDoctorProfiles: {
    sectionTitle: string
    sectionSubtitle: string
    doctors: string
  }
  MedicalAppointmentCTA: {
    headline: string
    subtext: string
    primaryLabel: string
    primaryHref: string
    secondaryLabel: string
    secondaryHref: string
    phoneNumber: string
  }
  MedicalDepartmentCards: {
    sectionTitle: string
    sectionSubtitle: string
    departments: string
  }
  MedicalPatientTestimonials: {
    sectionTitle: string
    sectionSubtitle: string
    testimonials: string
  }
  MedicalInsuranceStrip: {
    heading: string
    logos: string
    note: string
  }
  MedicalContactHours: {
    sectionTitle: string
    address: string
    phone: string
    email: string
    hours: string
    emergencyNote: string
  }
  MedicalFAQ: {
    sectionTitle: string
    sectionSubtitle: string
    items: string
  }
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function parseLine<T>(raw: string, parser: (line: string) => T | null): T[] {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map(parser)
    .filter((v): v is T => v !== null)
}

function parsePipeLines(raw: string, fieldCount: number): string[][] {
  return parseLine(raw, (line) => {
    const parts = line.split('|').map((p) => p.trim())
    return parts.length >= fieldCount ? parts : null
  })
}

// ─── MedicalHero ─────────────────────────────────────────────────────────────

const MedicalHero: Config<MedicalProps>['components']['MedicalHero'] = {
  label: 'Medical Hero',
  fields: {
    headline: { type: 'text' },
    subheadline: { type: 'textarea' },
    ctaLabel: { type: 'text' },
    ctaHref: { type: 'text' },
    badge: { type: 'text' },
    align: {
      type: 'radio',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Center', value: 'center' },
      ],
    },
  },
  defaultProps: {
    headline: 'Compassionate Care, Every Step of the Way',
    subheadline:
      'Our board-certified physicians and specialists are committed to your health and well-being. Book your appointment today.',
    ctaLabel: 'Book an Appointment',
    ctaHref: '#appointment',
    badge: 'NABH Accredited',
    align: 'center',
  },
  render: ({ headline, subheadline, ctaLabel, ctaHref, badge, align }) => (
    <section
      className={`relative flex flex-col gap-6 px-6 py-16 md:py-28 bg-gradient-to-br from-teal-50 to-cyan-50 ${
        align === 'center' ? 'items-center text-center' : 'items-start text-left'
      }`}
    >
      {badge ? (
        <span className="inline-flex items-center rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-700 uppercase tracking-wide">
          {badge}
        </span>
      ) : null}
      <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-900 max-w-3xl">
        {headline}
      </h1>
      <p className="text-base md:text-xl text-slate-600 max-w-2xl">{subheadline}</p>
      {ctaLabel ? (
        <a
          href={ctaHref}
          className="mt-2 inline-flex rounded-lg bg-teal-600 px-7 py-3 text-white font-semibold hover:bg-teal-700 transition"
        >
          {ctaLabel}
        </a>
      ) : null}
    </section>
  ),
}

// ─── MedicalServicesList ─────────────────────────────────────────────────────
// services format: "Icon Label | Description" per line
// Icon is a simple emoji or short text token

const MedicalServicesList: Config<MedicalProps>['components']['MedicalServicesList'] = {
  label: 'Medical Services List',
  fields: {
    sectionTitle: { type: 'text' },
    sectionSubtitle: { type: 'textarea' },
    services: { type: 'textarea' },
  },
  defaultProps: {
    sectionTitle: 'Our Services',
    sectionSubtitle: 'Comprehensive healthcare solutions tailored to your needs.',
    services: [
      '🫀 | Cardiology | Diagnosis and treatment of heart conditions',
      '🦴 | Orthopaedics | Bone, joint, and spine care',
      '🧠 | Neurology | Brain and nervous system disorders',
      '🤰 | Gynaecology | Women\'s health and maternity care',
      '👁️ | Ophthalmology | Eye care and vision correction',
      '🦷 | Dental | Complete oral health services',
    ].join('\n'),
  },
  render: ({ sectionTitle, sectionSubtitle, services }) => {
    const rows = parsePipeLines(services, 3)
    return (
      <section className="py-12 md:py-20 px-6 bg-white">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">{sectionTitle}</h2>
            {sectionSubtitle ? (
              <p className="mt-3 text-slate-500 max-w-2xl mx-auto">{sectionSubtitle}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {rows.map(([icon, name, desc], i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-xl border border-slate-200 p-6 hover:shadow-md transition"
              >
                <span className="text-3xl">{icon}</span>
                <h3 className="font-semibold text-slate-900">{name}</h3>
                <p className="text-sm text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  },
}

// ─── MedicalDoctorProfiles ───────────────────────────────────────────────────
// doctors format: "Name | Qualification | Speciality | Photo URL" per line

const MedicalDoctorProfiles: Config<MedicalProps>['components']['MedicalDoctorProfiles'] = {
  label: 'Doctor Profiles',
  fields: {
    sectionTitle: { type: 'text' },
    sectionSubtitle: { type: 'textarea' },
    doctors: { type: 'textarea' },
  },
  defaultProps: {
    sectionTitle: 'Meet Our Specialists',
    sectionSubtitle: 'Experienced, board-certified doctors dedicated to your care.',
    doctors: [
      'Dr. Priya Sharma | MD, DM | Cardiologist | https://placehold.co/400x400',
      'Dr. Rahul Mehta | MS, DNB | Orthopaedic Surgeon | https://placehold.co/400x400',
      'Dr. Ananya Patel | MBBS, MD | Neurologist | https://placehold.co/400x400',
      'Dr. Sunita Rao | MS, FMAS | Gynaecologist | https://placehold.co/400x400',
    ].join('\n'),
  },
  render: ({ sectionTitle, sectionSubtitle, doctors }) => {
    const rows = parsePipeLines(doctors, 3)
    return (
      <section className="py-12 md:py-20 px-6 bg-slate-50">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">{sectionTitle}</h2>
            {sectionSubtitle ? (
              <p className="mt-3 text-slate-500 max-w-2xl mx-auto">{sectionSubtitle}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {rows.map(([name, qual, specialty, photo], i) => (
              <div key={i} className="flex flex-col items-center text-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo ?? 'https://placehold.co/400x400'}
                  alt={name}
                  className="w-28 h-28 rounded-full object-cover border-4 border-teal-100"
                />
                <div>
                  <p className="font-semibold text-slate-900">{name}</p>
                  <p className="text-xs text-teal-700 font-medium">{specialty}</p>
                  <p className="text-xs text-slate-500">{qual}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  },
}

// ─── MedicalAppointmentCTA ───────────────────────────────────────────────────

const MedicalAppointmentCTA: Config<MedicalProps>['components']['MedicalAppointmentCTA'] = {
  label: 'Appointment CTA',
  fields: {
    headline: { type: 'text' },
    subtext: { type: 'textarea' },
    primaryLabel: { type: 'text' },
    primaryHref: { type: 'text' },
    secondaryLabel: { type: 'text' },
    secondaryHref: { type: 'text' },
    phoneNumber: { type: 'text' },
  },
  defaultProps: {
    headline: 'Ready to See a Doctor?',
    subtext: 'Book online in minutes or call us to speak with our care team.',
    primaryLabel: 'Book Appointment Online',
    primaryHref: '#book',
    secondaryLabel: 'View All Doctors',
    secondaryHref: '#doctors',
    phoneNumber: '+91 98765 43210',
  },
  render: ({ headline, subtext, primaryLabel, primaryHref, secondaryLabel, secondaryHref, phoneNumber }) => (
    <section className="py-12 md:py-20 px-6 bg-teal-600 text-white">
      <div className="mx-auto max-w-3xl text-center flex flex-col items-center gap-5">
        <h2 className="text-2xl md:text-4xl font-bold">{headline}</h2>
        <p className="text-teal-100 max-w-xl">{subtext}</p>
        <div className="flex flex-col sm:flex-row gap-3">
          {primaryLabel ? (
            <a
              href={primaryHref}
              className="rounded-lg bg-white text-teal-700 font-semibold px-6 py-3 hover:bg-teal-50 transition"
            >
              {primaryLabel}
            </a>
          ) : null}
          {secondaryLabel ? (
            <a
              href={secondaryHref}
              className="rounded-lg border border-white text-white font-semibold px-6 py-3 hover:bg-teal-700 transition"
            >
              {secondaryLabel}
            </a>
          ) : null}
        </div>
        {phoneNumber ? (
          <p className="text-teal-200 text-sm">
            Or call us:{' '}
            <a href={`tel:${phoneNumber.replace(/\s+/g, '')}`} className="font-semibold text-white hover:underline">
              {phoneNumber}
            </a>
          </p>
        ) : null}
      </div>
    </section>
  ),
}

// ─── MedicalDepartmentCards ──────────────────────────────────────────────────
// departments format: "Icon | Name | Short description | Link" per line

const MedicalDepartmentCards: Config<MedicalProps>['components']['MedicalDepartmentCards'] = {
  label: 'Department Cards',
  fields: {
    sectionTitle: { type: 'text' },
    sectionSubtitle: { type: 'textarea' },
    departments: { type: 'textarea' },
  },
  defaultProps: {
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
  },
  render: ({ sectionTitle, sectionSubtitle, departments }) => {
    const rows = parsePipeLines(departments, 3)
    return (
      <section className="py-12 md:py-20 px-6 bg-white">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">{sectionTitle}</h2>
            {sectionSubtitle ? (
              <p className="mt-3 text-slate-500 max-w-2xl mx-auto">{sectionSubtitle}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {rows.map(([icon, name, desc, href], i) => (
              <a
                key={i}
                href={href ?? '#'}
                className="group flex gap-4 rounded-xl border border-slate-200 p-5 hover:border-teal-400 hover:shadow-sm transition"
              >
                <span className="text-3xl shrink-0">{icon}</span>
                <div>
                  <p className="font-semibold text-slate-900 group-hover:text-teal-700 transition">{name}</p>
                  <p className="text-sm text-slate-500 mt-1">{desc}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>
    )
  },
}

// ─── MedicalPatientTestimonials ───────────────────────────────────────────────
// testimonials format: "Quote | Patient Name | Condition treated" per line

const MedicalPatientTestimonials: Config<MedicalProps>['components']['MedicalPatientTestimonials'] = {
  label: 'Patient Testimonials',
  fields: {
    sectionTitle: { type: 'text' },
    sectionSubtitle: { type: 'textarea' },
    testimonials: { type: 'textarea' },
  },
  defaultProps: {
    sectionTitle: 'What Our Patients Say',
    sectionSubtitle: "Real stories from people we've helped on their healing journey.",
    testimonials: [
      'The cardiac team saved my life. I am forever grateful. | Ramesh Nair | Heart Surgery',
      'Best maternity care I could have asked for. | Deepa Krishnan | Maternity',
      'My knee replacement went smoothly and recovery was fast. | Suresh Pillai | Orthopaedics',
      'Very caring staff and world-class facilities. | Anu Thomas | General Medicine',
    ].join('\n'),
  },
  render: ({ sectionTitle, sectionSubtitle, testimonials }) => {
    const rows = parsePipeLines(testimonials, 2)
    return (
      <section className="py-12 md:py-20 px-6 bg-teal-50">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">{sectionTitle}</h2>
            {sectionSubtitle ? (
              <p className="mt-3 text-slate-500 max-w-2xl mx-auto">{sectionSubtitle}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rows.map(([quote, name, condition], i) => (
              <figure
                key={i}
                className="bg-white rounded-xl p-6 shadow-sm border border-teal-100 flex flex-col gap-3"
              >
                <blockquote className="text-slate-700 leading-relaxed">&ldquo;{quote}&rdquo;</blockquote>
                <figcaption className="flex flex-col">
                  <span className="font-semibold text-slate-900">{name}</span>
                  {condition ? (
                    <span className="text-xs text-teal-600 font-medium">{condition}</span>
                  ) : null}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
    )
  },
}

// ─── MedicalInsuranceStrip ───────────────────────────────────────────────────
// logos format: "Logo URL | Insurer Name" per line

const MedicalInsuranceStrip: Config<MedicalProps>['components']['MedicalInsuranceStrip'] = {
  label: 'Insurance / Accreditation Strip',
  fields: {
    heading: { type: 'text' },
    logos: { type: 'textarea' },
    note: { type: 'text' },
  },
  defaultProps: {
    heading: 'We Accept All Major Insurers',
    logos: [
      'https://placehold.co/120x48 | Star Health',
      'https://placehold.co/120x48 | HDFC Ergo',
      'https://placehold.co/120x48 | Bajaj Allianz',
      'https://placehold.co/120x48 | New India Assurance',
      'https://placehold.co/120x48 | Care Health',
    ].join('\n'),
    note: "Don't see your insurer? Call us and we'll help.",
  },
  render: ({ heading, logos, note }) => {
    const rows = parsePipeLines(logos, 2)
    return (
      <section className="py-10 px-6 bg-white border-t border-b border-slate-100">
        <div className="mx-auto max-w-5xl flex flex-col items-center gap-6">
          {heading ? (
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest">{heading}</p>
          ) : null}
          <div className="flex flex-wrap justify-center gap-6 items-center">
            {rows.map(([src, name], i) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={i}
                src={src}
                alt={name}
                className="h-10 w-auto object-contain grayscale hover:grayscale-0 transition"
              />
            ))}
          </div>
          {note ? <p className="text-xs text-slate-400">{note}</p> : null}
        </div>
      </section>
    )
  },
}

// ─── MedicalContactHours ─────────────────────────────────────────────────────
// hours format: "Day | Time" per line

const MedicalContactHours: Config<MedicalProps>['components']['MedicalContactHours'] = {
  label: 'Contact & Hours',
  fields: {
    sectionTitle: { type: 'text' },
    address: { type: 'textarea' },
    phone: { type: 'text' },
    email: { type: 'text' },
    hours: { type: 'textarea' },
    emergencyNote: { type: 'text' },
  },
  defaultProps: {
    sectionTitle: 'Contact Us',
    address: '42, Healthcare Avenue\nMedical District, Bangalore – 560001\nKarnataka, India',
    phone: '+91 80 4567 8900',
    email: 'info@clinicname.in',
    hours: [
      'Monday – Friday | 8 AM – 8 PM',
      'Saturday | 8 AM – 6 PM',
      'Sunday | 9 AM – 1 PM',
    ].join('\n'),
    emergencyNote: '24/7 Emergency Services available',
  },
  render: ({ sectionTitle, address, phone, email, hours, emergencyNote }) => {
    const rows = parsePipeLines(hours, 2)
    return (
      <section className="py-12 md:py-20 px-6 bg-slate-50">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-10">{sectionTitle}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="flex flex-col gap-5">
              <div>
                <p className="text-xs font-semibold text-teal-700 uppercase tracking-widest mb-1">Address</p>
                <p className="text-slate-700 whitespace-pre-line">{address}</p>
              </div>
              {phone ? (
                <div>
                  <p className="text-xs font-semibold text-teal-700 uppercase tracking-widest mb-1">Phone</p>
                  <a href={`tel:${phone.replace(/\s+/g, '')}`} className="text-slate-800 hover:text-teal-700 transition">
                    {phone}
                  </a>
                </div>
              ) : null}
              {email ? (
                <div>
                  <p className="text-xs font-semibold text-teal-700 uppercase tracking-widest mb-1">Email</p>
                  <a href={`mailto:${email}`} className="text-slate-800 hover:text-teal-700 transition">
                    {email}
                  </a>
                </div>
              ) : null}
              {emergencyNote ? (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 font-medium">
                  🚨 {emergencyNote}
                </div>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-semibold text-teal-700 uppercase tracking-widest mb-3">Opening Hours</p>
              <table className="w-full text-sm">
                <tbody>
                  {rows.map(([day, time], i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="py-2 px-3 font-medium text-slate-800">{day}</td>
                      <td className="py-2 px-3 text-slate-600 text-right">{time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    )
  },
}

// ─── MedicalFAQ ──────────────────────────────────────────────────────────────
// items format: "Question | Answer" per line

const MedicalFAQ: Config<MedicalProps>['components']['MedicalFAQ'] = {
  label: 'Medical FAQ',
  fields: {
    sectionTitle: { type: 'text' },
    sectionSubtitle: { type: 'textarea' },
    items: { type: 'textarea' },
  },
  defaultProps: {
    sectionTitle: 'Frequently Asked Questions',
    sectionSubtitle: 'Answers to common questions about our services and procedures.',
    items: [
      'How do I book an appointment? | You can book online through our website or call our helpline.',
      'Do you accept walk-in patients? | Yes, walk-ins are welcome but appointments are prioritised.',
      'Is cashless insurance available? | We are empanelled with 30+ insurers for cashless treatment.',
      'What are the visiting hours? | General visiting hours are 10 AM – 12 PM and 4 PM – 7 PM.',
      'Are second opinions available? | Yes, our specialists are happy to provide second opinions.',
    ].join('\n'),
  },
  render: ({ sectionTitle, sectionSubtitle, items }) => {
    const rows = parsePipeLines(items, 2)
    return (
      <section className="py-12 md:py-20 px-6 bg-white">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">{sectionTitle}</h2>
            {sectionSubtitle ? (
              <p className="mt-3 text-slate-500 max-w-xl mx-auto">{sectionSubtitle}</p>
            ) : null}
          </div>
          <div className="flex flex-col divide-y divide-slate-200">
            {rows.map(([question, answer], i) => (
              <details key={i} className="group py-4">
                <summary className="flex justify-between items-center cursor-pointer list-none">
                  <span className="font-medium text-slate-900">{question}</span>
                  <span className="ml-4 shrink-0 text-teal-600 group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <p className="mt-3 text-slate-600 leading-relaxed">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    )
  },
}

// ─── Pack assembly ────────────────────────────────────────────────────────────

const typedComponents: Config<MedicalProps>['components'] = {
  MedicalHero,
  MedicalServicesList,
  MedicalDoctorProfiles,
  MedicalAppointmentCTA,
  MedicalDepartmentCards,
  MedicalPatientTestimonials,
  MedicalInsuranceStrip,
  MedicalContactHours,
  MedicalFAQ,
}

export const medical: ComponentPack = {
  key: 'medical',
  label: 'Medical',
  components: typedComponents as NonNullable<Config['components']>,
  categories: {
    'medical-hero': { title: 'Medical › Hero', components: ['MedicalHero'] },
    'medical-services': {
      title: 'Medical › Services & Departments',
      components: ['MedicalServicesList', 'MedicalDepartmentCards'],
    },
    'medical-team': {
      title: 'Medical › Team',
      components: ['MedicalDoctorProfiles'],
    },
    'medical-patient': {
      title: 'Medical › Patient',
      components: ['MedicalPatientTestimonials', 'MedicalFAQ'],
    },
    'medical-cta': {
      title: 'Medical › Calls to Action',
      components: ['MedicalAppointmentCTA'],
    },
    'medical-info': {
      title: 'Medical › Info',
      components: ['MedicalInsuranceStrip', 'MedicalContactHours'],
    },
  },
}
