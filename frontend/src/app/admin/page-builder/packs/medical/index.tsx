import type { Config } from '@puckeditor/core'
import { usePuck } from '@puckeditor/core'
import { Phone, Clock, MapPin, Mail, Facebook, Twitter, Linkedin } from 'lucide-react'
import type { ComponentPack } from '../types'
import { liveThumb, variantField } from '../variant-field'

type MedicalProps = {
  MedicalHero: {
    variant: '1' | '2' | '3' | '4'
    headline: string
    subheadline: string
    ctaLabel: string
    ctaHref: string
    badge: string
    align: 'left' | 'center'
    image: string
  }
  MedicalServicesList: {
    variant: '1' | '2' | '3' | '4'
    sectionTitle: string
    sectionSubtitle: string
    services: string
  }
  MedicalDoctorProfiles: {
    variant: '1' | '2' | '3' | '4'
    sectionTitle: string
    sectionSubtitle: string
    doctors: string
  }
  MedicalAppointmentCTA: {
    variant: '1' | '2' | '3' | '4'
    headline: string
    subtext: string
    primaryLabel: string
    primaryHref: string
    secondaryLabel: string
    secondaryHref: string
    phoneNumber: string
  }
  MedicalDepartmentCards: {
    variant: '1' | '2' | '3' | '4'
    sectionTitle: string
    sectionSubtitle: string
    departments: string
  }
  MedicalPatientTestimonials: {
    variant: '1' | '2' | '3' | '4'
    sectionTitle: string
    sectionSubtitle: string
    testimonials: string
  }
  MedicalInsuranceStrip: {
    variant: '1' | '2' | '3' | '4'
    heading: string
    logos: string
    note: string
  }
  MedicalContactHours: {
    variant: '1' | '2' | '3' | '4'
    sectionTitle: string
    address: string
    phone: string
    email: string
    hours: string
    emergencyNote: string
  }
  MedicalFAQ: {
    variant: '1' | '2' | '3' | '4'
    sectionTitle: string
    sectionSubtitle: string
    items: string
  }
  MedicalTopNav: {
    variant: '1' | '2' | '3' | '4'
    welcomeText: string
    phone: string
    hours: string
    brand: string
    logoUrl: string
    navLinks: string
    ctaLabel: string
    ctaHref: string
    primaryColor: string
  }
  MedicalHeroSplit: {
    variant: '1' | '2' | '3' | '4'
    eyebrow: string
    headingLine1: string
    headingLine2: string
    subtext: string
    primaryLabel: string
    primaryHref: string
    secondaryLabel: string
    secondaryHref: string
    image: string
    primaryColor: string
  }
  MedicalContactInfoCards: {
    cells: string
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

const HERO_VARIANT_LABELS_SIMPLE: Record<string, string> = {
  '1': 'Gradient, badge',
  '2': 'Split, with image',
  '3': 'Dark, centered',
  '4': 'Minimal bar',
}

function medicalHeroBody(props: MedicalProps['MedicalHero']) {
  const { headline, subheadline, ctaLabel, ctaHref, badge, align, image } = props
  if (props.variant === '2')
    return (
      <section className="grid grid-cols-1 items-center gap-8 bg-white px-6 py-16 md:grid-cols-2 md:py-24">
        <div className="flex flex-col gap-5">
          {badge ? (
            <span className="inline-flex w-fit items-center rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-700">
              {badge}
            </span>
          ) : null}
          <h1 className="max-w-xl text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            {headline}
          </h1>
          <p className="max-w-lg text-base text-slate-600 md:text-xl">{subheadline}</p>
          {ctaLabel ? (
            <a
              href={ctaHref}
              className="mt-2 inline-flex w-fit rounded-lg bg-teal-600 px-7 py-3 font-semibold text-white transition hover:bg-teal-700"
            >
              {ctaLabel}
            </a>
          ) : null}
        </div>
        <div className="overflow-hidden rounded-2xl bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image || 'https://placehold.co/900x800'}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      </section>
    )
  if (props.variant === '3')
    return (
      <section className="flex flex-col items-center gap-6 bg-slate-900 px-6 py-16 text-center md:py-28">
        {badge ? (
          <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-300">
            {badge}
          </span>
        ) : null}
        <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-white md:text-5xl">
          {headline}
        </h1>
        <p className="max-w-2xl text-base text-slate-300 md:text-xl">{subheadline}</p>
        {ctaLabel ? (
          <a
            href={ctaHref}
            className="mt-2 inline-flex rounded-lg bg-teal-500 px-7 py-3 font-semibold text-white transition hover:bg-teal-400"
          >
            {ctaLabel}
          </a>
        ) : null}
      </section>
    )
  if (props.variant === '4')
    return (
      <section className="flex flex-col items-center justify-between gap-4 bg-teal-50 px-6 py-8 md:flex-row md:py-10">
        <h1 className="text-xl font-bold text-slate-900 md:text-2xl">{headline}</h1>
        {ctaLabel ? (
          <a
            href={ctaHref}
            className="inline-flex shrink-0 rounded-lg bg-teal-600 px-6 py-2.5 font-semibold text-white transition hover:bg-teal-700"
          >
            {ctaLabel}
          </a>
        ) : null}
      </section>
    )
  return (
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
  )
}

const MedicalHero: Config<MedicalProps>['components']['MedicalHero'] = {
  label: 'Medical Hero',
  fields: {
    variant: variantField(
      HERO_VARIANT_LABELS_SIMPLE,
      liveThumb(medicalHeroBody, {
        variant: '1',
        headline: 'Compassionate Care, Every Step of the Way',
        subheadline: 'Board-certified physicians and specialists committed to your health.',
        ctaLabel: 'Book an Appointment',
        ctaHref: '#appointment',
        badge: 'NABH Accredited',
        align: 'center',
        image: 'https://placehold.co/900x800',
      })
    ),
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
    image: { type: 'text' },
  },
  defaultProps: {
    variant: '1',
    headline: 'Compassionate Care, Every Step of the Way',
    subheadline:
      'Our board-certified physicians and specialists are committed to your health and well-being. Book your appointment today.',
    ctaLabel: 'Book an Appointment',
    ctaHref: '#appointment',
    badge: 'NABH Accredited',
    align: 'center',
    image: 'https://placehold.co/900x800',
  },
  render: medicalHeroBody,
}

// ─── MedicalServicesList ─────────────────────────────────────────────────────
// services format: "Icon Label | Description" per line
// Icon is a simple emoji or short text token

const SERVICES_VARIANT_LABELS: Record<string, string> = {
  '1': 'Card grid',
  '2': 'Dark, 2-col',
  '3': 'List rows',
  '4': 'Minimal chips',
}
const SERVICES_FALLBACK = {
  variant: '1' as const,
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
}

function servicesListBody(props: MedicalProps['MedicalServicesList']) {
  const { variant, sectionTitle, sectionSubtitle, services } = props
  const rows = parsePipeLines(services, 3)
  const header = (align: 'text-center' | 'text-left', titleClass = '') => (
    <div className={`mb-10 ${align}`}>
      <h2 className={`text-2xl font-bold text-slate-900 md:text-3xl ${titleClass}`}>
        {sectionTitle}
      </h2>
      {sectionSubtitle ? (
        <p
          className={`mt-3 text-slate-500 ${align === 'text-center' ? 'mx-auto max-w-2xl' : 'max-w-2xl'}`}
        >
          {sectionSubtitle}
        </p>
      ) : null}
    </div>
  )
  if (variant === '2')
    return (
      <section className="bg-slate-900 px-6 py-12 md:py-20">
        <div className="mx-auto max-w-5xl">
          {header('text-center', 'text-white')}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {rows.map(([icon, name, desc], i) => (
              <div key={i} className="flex items-start gap-4 rounded-xl bg-white/5 p-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-teal-500/20 text-xl">
                  {icon}
                </span>
                <div>
                  <h3 className="font-semibold text-white">{name}</h3>
                  <p className="mt-1 text-sm text-slate-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  if (variant === '3')
    return (
      <section className="bg-white px-6 py-12 md:py-20">
        <div className="mx-auto max-w-3xl">
          {header('text-left')}
          <div className="flex flex-col divide-y divide-slate-100">
            {rows.map(([icon, name, desc], i) => (
              <div key={i} className="flex items-center gap-4 py-4">
                <span className="text-2xl">{icon}</span>
                <div>
                  <h3 className="font-semibold text-slate-900">{name}</h3>
                  <p className="text-sm text-slate-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  if (variant === '4')
    return (
      <section className="bg-teal-50 px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-3">
          {rows.map(([icon, name], i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm"
            >
              <span>{icon}</span> {name}
            </span>
          ))}
        </div>
      </section>
    )
  return (
    <section className="py-12 md:py-20 px-6 bg-white">
      <div className="mx-auto max-w-5xl">
        {header('text-center')}
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
}

const MedicalServicesList: Config<MedicalProps>['components']['MedicalServicesList'] = {
  label: 'Medical Services List',
  fields: {
    variant: variantField(SERVICES_VARIANT_LABELS, liveThumb(servicesListBody, SERVICES_FALLBACK)),
    sectionTitle: { type: 'text' },
    sectionSubtitle: { type: 'textarea' },
    services: { type: 'textarea' },
  },
  defaultProps: SERVICES_FALLBACK,
  render: servicesListBody,
}

// ─── MedicalDoctorProfiles ───────────────────────────────────────────────────
// doctors format: "Name | Qualification | Speciality | Photo URL" per line

const DOCTORS_VARIANT_LABELS: Record<string, string> = {
  '1': 'Circular photos',
  '2': 'Cards, dark',
  '3': 'List rows',
  '4': 'Minimal, no photo',
}
const DOCTORS_FALLBACK = {
  variant: '1' as const,
  sectionTitle: 'Meet Our Specialists',
  sectionSubtitle: 'Experienced, board-certified doctors dedicated to your care.',
  doctors: [
    'Dr. Priya Sharma | MD, DM | Cardiologist | https://placehold.co/400x400',
    'Dr. Rahul Mehta | MS, DNB | Orthopaedic Surgeon | https://placehold.co/400x400',
    'Dr. Ananya Patel | MBBS, MD | Neurologist | https://placehold.co/400x400',
    'Dr. Sunita Rao | MS, FMAS | Gynaecologist | https://placehold.co/400x400',
  ].join('\n'),
}

function doctorProfilesBody(props: MedicalProps['MedicalDoctorProfiles']) {
  const { variant, sectionTitle, sectionSubtitle, doctors } = props
  const rows = parsePipeLines(doctors, 3)
  const header = (align: 'text-center' | 'text-left', titleClass = '') => (
    <div className={`mb-10 ${align}`}>
      <h2 className={`text-2xl font-bold text-slate-900 md:text-3xl ${titleClass}`}>
        {sectionTitle}
      </h2>
      {sectionSubtitle ? (
        <p
          className={`mt-3 text-slate-500 ${align === 'text-center' ? 'mx-auto max-w-2xl' : 'max-w-2xl'}`}
        >
          {sectionSubtitle}
        </p>
      ) : null}
    </div>
  )
  if (variant === '2')
    return (
      <section className="bg-slate-900 px-6 py-12 md:py-20">
        <div className="mx-auto max-w-5xl">
          {header('text-center', 'text-white')}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4">
            {rows.map(([name, qual, specialty, photo], i) => (
              <div key={i} className="overflow-hidden rounded-xl bg-white/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo || 'https://placehold.co/400x400'}
                  alt={name}
                  className="h-36 w-full object-cover"
                />
                <div className="p-4">
                  <p className="font-semibold text-white">{name}</p>
                  <p className="text-xs font-medium text-teal-300">{specialty}</p>
                  <p className="text-xs text-slate-400">{qual}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  if (variant === '3')
    return (
      <section className="bg-white px-6 py-12 md:py-20">
        <div className="mx-auto max-w-3xl">
          {header('text-left')}
          <div className="flex flex-col divide-y divide-slate-100">
            {rows.map(([name, qual, specialty, photo], i) => (
              <div key={i} className="flex items-center gap-4 py-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo || 'https://placehold.co/400x400'}
                  alt={name}
                  className="h-16 w-16 shrink-0 rounded-full object-cover"
                />
                <div>
                  <p className="font-semibold text-slate-900">{name}</p>
                  <p className="text-xs font-medium text-teal-700">{specialty}</p>
                  <p className="text-xs text-slate-500">{qual}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  if (variant === '4')
    return (
      <section className="bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-5xl">
          {header('text-center')}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {rows.map(([name, qual, specialty], i) => (
              <div key={i} className="rounded-lg bg-white p-4 text-center shadow-sm">
                <p className="font-semibold text-slate-900">{name}</p>
                <p className="text-xs text-teal-700">{specialty}</p>
                <p className="text-xs text-slate-400">{qual}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  return (
    <section className="py-12 md:py-20 px-6 bg-slate-50">
      <div className="mx-auto max-w-5xl">
        {header('text-center')}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {rows.map(([name, qual, specialty, photo], i) => (
            <div key={i} className="flex flex-col items-center text-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo || 'https://placehold.co/400x400'}
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
}

const MedicalDoctorProfiles: Config<MedicalProps>['components']['MedicalDoctorProfiles'] = {
  label: 'Doctor Profiles',
  fields: {
    variant: variantField(DOCTORS_VARIANT_LABELS, liveThumb(doctorProfilesBody, DOCTORS_FALLBACK)),
    sectionTitle: { type: 'text' },
    sectionSubtitle: { type: 'textarea' },
    doctors: { type: 'textarea' },
  },
  defaultProps: DOCTORS_FALLBACK,
  render: doctorProfilesBody,
}

// ─── MedicalAppointmentCTA ───────────────────────────────────────────────────

const CTA_VARIANT_LABELS: Record<string, string> = {
  '1': 'Teal, centered',
  '2': 'Dark, split',
  '3': 'Card, boxed',
  '4': 'Minimal bar',
}
const CTA_FALLBACK = {
  variant: '1' as const,
  headline: 'Ready to See a Doctor?',
  subtext: 'Book online in minutes or call us to speak with our care team.',
  primaryLabel: 'Book Appointment Online',
  primaryHref: '#book',
  secondaryLabel: 'View All Doctors',
  secondaryHref: '#doctors',
  phoneNumber: '+91 98765 43210',
}

function appointmentCtaBody(props: MedicalProps['MedicalAppointmentCTA']) {
  const {
    variant,
    headline,
    subtext,
    primaryLabel,
    primaryHref,
    secondaryLabel,
    secondaryHref,
    phoneNumber,
  } = props
  if (variant === '2')
    return (
      <section className="flex flex-col items-center justify-between gap-6 bg-slate-900 px-6 py-12 text-white md:flex-row md:py-20">
        <div>
          <h2 className="text-2xl font-bold md:text-4xl">{headline}</h2>
          <p className="mt-2 max-w-md text-slate-400">{subtext}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
          {primaryLabel ? (
            <a
              href={primaryHref}
              className="rounded-lg bg-teal-500 px-6 py-3 font-semibold text-white transition hover:bg-teal-400"
            >
              {primaryLabel}
            </a>
          ) : null}
          {secondaryLabel ? (
            <a
              href={secondaryHref}
              className="rounded-lg border border-white/30 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
            >
              {secondaryLabel}
            </a>
          ) : null}
        </div>
      </section>
    )
  if (variant === '3')
    return (
      <section className="bg-slate-50 px-6 py-12 md:py-20">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">{headline}</h2>
          <p className="max-w-md text-slate-500">{subtext}</p>
          {primaryLabel ? (
            <a
              href={primaryHref}
              className="mt-2 rounded-lg bg-teal-600 px-6 py-3 font-semibold text-white transition hover:bg-teal-700"
            >
              {primaryLabel}
            </a>
          ) : null}
          {phoneNumber ? (
            <p className="text-sm text-slate-400">
              Or call:{' '}
              <a
                href={`tel:${phoneNumber.replace(/\s+/g, '')}`}
                className="font-semibold text-teal-700"
              >
                {phoneNumber}
              </a>
            </p>
          ) : null}
        </div>
      </section>
    )
  if (variant === '4')
    return (
      <section className="flex flex-col items-center justify-between gap-4 bg-teal-600 px-6 py-6 text-white md:flex-row">
        <h2 className="text-lg font-semibold">{headline}</h2>
        {primaryLabel ? (
          <a
            href={primaryHref}
            className="shrink-0 rounded-lg bg-white px-5 py-2.5 font-semibold text-teal-700 transition hover:bg-teal-50"
          >
            {primaryLabel}
          </a>
        ) : null}
      </section>
    )
  return (
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
            <a
              href={`tel:${phoneNumber.replace(/\s+/g, '')}`}
              className="font-semibold text-white hover:underline"
            >
              {phoneNumber}
            </a>
          </p>
        ) : null}
      </div>
    </section>
  )
}

const MedicalAppointmentCTA: Config<MedicalProps>['components']['MedicalAppointmentCTA'] = {
  label: 'Appointment CTA',
  fields: {
    variant: variantField(CTA_VARIANT_LABELS, liveThumb(appointmentCtaBody, CTA_FALLBACK)),
    headline: { type: 'text' },
    subtext: { type: 'textarea' },
    primaryLabel: { type: 'text' },
    primaryHref: { type: 'text' },
    secondaryLabel: { type: 'text' },
    secondaryHref: { type: 'text' },
    phoneNumber: { type: 'text' },
  },
  defaultProps: CTA_FALLBACK,
  render: appointmentCtaBody,
}

// ─── MedicalDepartmentCards ──────────────────────────────────────────────────
// departments format: "Icon | Name | Short description | Link" per line

const DEPARTMENTS_VARIANT_LABELS: Record<string, string> = {
  '1': 'Card grid',
  '2': 'Dark cards',
  '3': 'List rows',
  '4': 'Minimal chips',
}
const DEPARTMENTS_FALLBACK = {
  variant: '1' as const,
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
}

function departmentCardsBody(props: MedicalProps['MedicalDepartmentCards']) {
  const { variant, sectionTitle, sectionSubtitle, departments } = props
  const rows = parsePipeLines(departments, 3)
  const header = (align: 'text-center' | 'text-left', titleClass = '') => (
    <div className={`mb-10 ${align}`}>
      <h2 className={`text-2xl font-bold text-slate-900 md:text-3xl ${titleClass}`}>
        {sectionTitle}
      </h2>
      {sectionSubtitle ? (
        <p
          className={`mt-3 text-slate-500 ${align === 'text-center' ? 'mx-auto max-w-2xl' : 'max-w-2xl'}`}
        >
          {sectionSubtitle}
        </p>
      ) : null}
    </div>
  )
  if (variant === '2')
    return (
      <section className="bg-slate-900 px-6 py-12 md:py-20">
        <div className="mx-auto max-w-5xl">
          {header('text-center', 'text-white')}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
            {rows.map(([icon, name, desc, href], i) => (
              <a
                key={i}
                href={href || '#'}
                className="group rounded-xl bg-white/5 p-5 transition hover:bg-white/10"
              >
                <span className="text-3xl">{icon}</span>
                <p className="mt-3 font-semibold text-white">{name}</p>
                <p className="mt-1 text-sm text-slate-400">{desc}</p>
              </a>
            ))}
          </div>
        </div>
      </section>
    )
  if (variant === '3')
    return (
      <section className="bg-white px-6 py-12 md:py-20">
        <div className="mx-auto max-w-3xl">
          {header('text-left')}
          <div className="flex flex-col divide-y divide-slate-100">
            {rows.map(([icon, name, desc, href], i) => (
              <a key={i} href={href || '#'} className="group flex items-center gap-4 py-4">
                <span className="text-2xl">{icon}</span>
                <div>
                  <p className="font-semibold text-slate-900 group-hover:text-teal-700">{name}</p>
                  <p className="text-sm text-slate-500">{desc}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>
    )
  if (variant === '4')
    return (
      <section className="bg-slate-50 px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-3">
          {rows.map(([icon, name, , href], i) => (
            <a
              key={i}
              href={href || '#'}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm"
            >
              <span>{icon}</span> {name}
            </a>
          ))}
        </div>
      </section>
    )
  return (
    <section className="py-12 md:py-20 px-6 bg-white">
      <div className="mx-auto max-w-5xl">
        {header('text-center')}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {rows.map(([icon, name, desc, href], i) => (
            <a
              key={i}
              href={href || '#'}
              className="group flex gap-4 rounded-xl border border-slate-200 p-5 hover:border-teal-400 hover:shadow-sm transition"
            >
              <span className="text-3xl shrink-0">{icon}</span>
              <div>
                <p className="font-semibold text-slate-900 group-hover:text-teal-700 transition">
                  {name}
                </p>
                <p className="text-sm text-slate-500 mt-1">{desc}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

const MedicalDepartmentCards: Config<MedicalProps>['components']['MedicalDepartmentCards'] = {
  label: 'Department Cards',
  fields: {
    variant: variantField(
      DEPARTMENTS_VARIANT_LABELS,
      liveThumb(departmentCardsBody, DEPARTMENTS_FALLBACK)
    ),
    sectionTitle: { type: 'text' },
    sectionSubtitle: { type: 'textarea' },
    departments: { type: 'textarea' },
  },
  defaultProps: DEPARTMENTS_FALLBACK,
  render: departmentCardsBody,
}

// ─── MedicalPatientTestimonials ───────────────────────────────────────────────
// testimonials format: "Quote | Patient Name | Condition treated" per line

const TESTIMONIALS_VARIANT_LABELS: Record<string, string> = {
  '1': 'Card grid',
  '2': 'Dark, stacked',
  '3': '3-col compact',
  '4': 'Minimal list',
}
const TESTIMONIALS_FALLBACK = {
  variant: '1' as const,
  sectionTitle: 'What Our Patients Say',
  sectionSubtitle: "Real stories from people we've helped on their healing journey.",
  testimonials: [
    'The cardiac team saved my life. I am forever grateful. | Ramesh Nair | Heart Surgery',
    'Best maternity care I could have asked for. | Deepa Krishnan | Maternity',
    'My knee replacement went smoothly and recovery was fast. | Suresh Pillai | Orthopaedics',
    'Very caring staff and world-class facilities. | Anu Thomas | General Medicine',
  ].join('\n'),
}

function testimonialsBody(props: MedicalProps['MedicalPatientTestimonials']) {
  const { variant, sectionTitle, sectionSubtitle, testimonials } = props
  const rows = parsePipeLines(testimonials, 2)
  const header = (align: 'text-center' | 'text-left', titleClass = '') => (
    <div className={`mb-10 ${align}`}>
      <h2 className={`text-2xl font-bold text-slate-900 md:text-3xl ${titleClass}`}>
        {sectionTitle}
      </h2>
      {sectionSubtitle ? (
        <p
          className={`mt-3 text-slate-500 ${align === 'text-center' ? 'mx-auto max-w-2xl' : 'max-w-2xl'}`}
        >
          {sectionSubtitle}
        </p>
      ) : null}
    </div>
  )
  if (variant === '2')
    return (
      <section className="bg-slate-900 px-6 py-12 md:py-20">
        <div className="mx-auto max-w-3xl">
          {header('text-center', 'text-white')}
          <div className="flex flex-col gap-6">
            {rows.map(([quote, name, condition], i) => (
              <figure key={i} className="border-l-2 border-teal-500 pl-5">
                <blockquote className="text-lg text-slate-200">&ldquo;{quote}&rdquo;</blockquote>
                <figcaption className="mt-2 text-sm">
                  <span className="font-semibold text-white">{name}</span>
                  {condition ? <span className="ml-2 text-teal-400">{condition}</span> : null}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
    )
  if (variant === '3')
    return (
      <section className="bg-white px-6 py-12 md:py-20">
        <div className="mx-auto max-w-5xl">
          {header('text-center')}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {rows.map(([quote, name, condition], i) => (
              <figure key={i} className="rounded-lg border border-slate-100 p-5">
                <blockquote className="text-sm text-slate-600">&ldquo;{quote}&rdquo;</blockquote>
                <figcaption className="mt-3 text-sm font-semibold text-slate-900">
                  {name}
                  {condition ? (
                    <span className="ml-1 font-normal text-teal-600">· {condition}</span>
                  ) : null}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
    )
  if (variant === '4')
    return (
      <section className="bg-teal-50 px-6 py-10">
        <div className="mx-auto max-w-3xl">
          {header('text-left')}
          <div className="flex flex-col divide-y divide-teal-100">
            {rows.map(([quote, name], i) => (
              <p key={i} className="py-3 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">{name}: </span>
                &ldquo;{quote}&rdquo;
              </p>
            ))}
          </div>
        </div>
      </section>
    )
  return (
    <section className="py-12 md:py-20 px-6 bg-teal-50">
      <div className="mx-auto max-w-5xl">
        {header('text-center')}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rows.map(([quote, name, condition], i) => (
            <figure
              key={i}
              className="bg-white rounded-xl p-6 shadow-sm border border-teal-100 flex flex-col gap-3"
            >
              <blockquote className="text-slate-700 leading-relaxed">
                &ldquo;{quote}&rdquo;
              </blockquote>
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
}

const MedicalPatientTestimonials: Config<MedicalProps>['components']['MedicalPatientTestimonials'] =
  {
    label: 'Patient Testimonials',
    fields: {
      variant: variantField(
        TESTIMONIALS_VARIANT_LABELS,
        liveThumb(testimonialsBody, TESTIMONIALS_FALLBACK)
      ),
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      testimonials: { type: 'textarea' },
    },
    defaultProps: TESTIMONIALS_FALLBACK,
    render: testimonialsBody,
  }

// ─── MedicalInsuranceStrip ───────────────────────────────────────────────────
// logos format: "Logo URL | Insurer Name" per line

const INSURANCE_VARIANT_LABELS: Record<string, string> = {
  '1': 'Logo row',
  '2': 'Dark strip',
  '3': 'Boxed, centered',
  '4': 'Minimal line',
}
const INSURANCE_FALLBACK = {
  variant: '1' as const,
  heading: 'We Accept All Major Insurers',
  logos: [
    'https://placehold.co/120x48 | Star Health',
    'https://placehold.co/120x48 | HDFC Ergo',
    'https://placehold.co/120x48 | Bajaj Allianz',
    'https://placehold.co/120x48 | New India Assurance',
    'https://placehold.co/120x48 | Care Health',
  ].join('\n'),
  note: "Don't see your insurer? Call us and we'll help.",
}

function insuranceStripBody(props: MedicalProps['MedicalInsuranceStrip']) {
  const { variant, heading, logos, note } = props
  const rows = parsePipeLines(logos, 2)
  if (variant === '2')
    return (
      <section className="bg-slate-900 px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6">
          {heading ? (
            <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">
              {heading}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-center gap-6">
            {rows.map(([src, name], i) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={i}
                src={src}
                alt={name}
                className="h-10 w-auto object-contain brightness-0 invert"
              />
            ))}
          </div>
          {note ? <p className="text-xs text-slate-500">{note}</p> : null}
        </div>
      </section>
    )
  if (variant === '3')
    return (
      <section className="bg-white px-6 py-10">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 rounded-2xl border border-slate-200 p-8 text-center">
          {heading ? (
            <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">
              {heading}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-center gap-6">
            {rows.map(([src, name], i) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img key={i} src={src} alt={name} className="h-9 w-auto object-contain" />
            ))}
          </div>
          {note ? <p className="text-xs text-slate-400">{note}</p> : null}
        </div>
      </section>
    )
  if (variant === '4')
    return (
      <section className="flex flex-wrap items-center justify-center gap-5 bg-slate-50 px-6 py-4">
        {rows.map(([src, name], i) => (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img key={i} src={src} alt={name} className="h-6 w-auto object-contain opacity-70" />
        ))}
      </section>
    )
  return (
    <section className="py-10 px-6 bg-white border-t border-b border-slate-100">
      <div className="mx-auto max-w-5xl flex flex-col items-center gap-6">
        {heading ? (
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest">
            {heading}
          </p>
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
}

const MedicalInsuranceStrip: Config<MedicalProps>['components']['MedicalInsuranceStrip'] = {
  label: 'Insurance / Accreditation Strip',
  fields: {
    variant: variantField(
      INSURANCE_VARIANT_LABELS,
      liveThumb(insuranceStripBody, INSURANCE_FALLBACK)
    ),
    heading: { type: 'text' },
    logos: { type: 'textarea' },
    note: { type: 'text' },
  },
  defaultProps: INSURANCE_FALLBACK,
  render: insuranceStripBody,
}

// ─── MedicalContactHours ─────────────────────────────────────────────────────
// hours format: "Day | Time" per line

const CONTACT_HOURS_VARIANT_LABELS: Record<string, string> = {
  '1': 'Two-column',
  '2': 'Dark, stacked',
  '3': 'Three cards',
  '4': 'Minimal row',
}
const CONTACT_HOURS_FALLBACK = {
  variant: '1' as const,
  sectionTitle: 'Contact Us',
  address: '42, Healthcare Avenue\nMedical District, Bangalore – 560001\nKarnataka, India',
  phone: '+91 80 4567 8900',
  email: 'info@clinicname.in',
  hours: ['Monday – Friday | 8 AM – 8 PM', 'Saturday | 8 AM – 6 PM', 'Sunday | 9 AM – 1 PM'].join(
    '\n'
  ),
  emergencyNote: '24/7 Emergency Services available',
}

function contactHoursBody(props: MedicalProps['MedicalContactHours']) {
  const { variant, sectionTitle, address, phone, email, hours, emergencyNote } = props
  const rows = parsePipeLines(hours, 2)
  if (variant === '2')
    return (
      <section className="bg-slate-900 px-6 py-12 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-8 text-2xl font-bold text-white md:text-3xl">{sectionTitle}</h2>
          <p className="whitespace-pre-line text-slate-300">{address}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm">
            {phone ? (
              <a
                href={`tel:${phone.replace(/\s+/g, '')}`}
                className="text-teal-400 hover:underline"
              >
                {phone}
              </a>
            ) : null}
            {email ? (
              <a href={`mailto:${email}`} className="text-teal-400 hover:underline">
                {email}
              </a>
            ) : null}
          </div>
          <div className="mt-6 flex flex-col gap-1 text-sm text-slate-400">
            {rows.map(([day, time], i) => (
              <div key={i} className="flex justify-center gap-3">
                <span>{day}</span>
                <span>·</span>
                <span>{time}</span>
              </div>
            ))}
          </div>
          {emergencyNote ? (
            <p className="mt-6 text-sm font-medium text-red-400">🚨 {emergencyNote}</p>
          ) : null}
        </div>
      </section>
    )
  if (variant === '3')
    return (
      <section className="bg-white px-6 py-12 md:py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-10 text-center text-2xl font-bold text-slate-900 md:text-3xl">
            {sectionTitle}
          </h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-teal-700">
                Address
              </p>
              <p className="whitespace-pre-line text-sm text-slate-700">{address}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-teal-700">
                Reach us
              </p>
              {phone ? (
                <p>
                  <a href={`tel:${phone.replace(/\s+/g, '')}`} className="text-sm text-slate-800">
                    {phone}
                  </a>
                </p>
              ) : null}
              {email ? (
                <p>
                  <a href={`mailto:${email}`} className="text-sm text-slate-800">
                    {email}
                  </a>
                </p>
              ) : null}
              {emergencyNote ? (
                <p className="mt-2 text-xs font-medium text-red-600">🚨 {emergencyNote}</p>
              ) : null}
            </div>
            <div className="rounded-xl border border-slate-200 p-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-teal-700">
                Hours
              </p>
              {rows.map(([day, time], i) => (
                <div key={i} className="flex justify-between text-sm text-slate-600">
                  <span>{day}</span>
                  <span>{time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    )
  if (variant === '4')
    return (
      <section className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 bg-slate-50 px-6 py-5 text-sm">
        {phone ? (
          <a href={`tel:${phone.replace(/\s+/g, '')}`} className="font-medium text-slate-800">
            {phone}
          </a>
        ) : null}
        {email ? (
          <a href={`mailto:${email}`} className="text-slate-600">
            {email}
          </a>
        ) : null}
        <span className="text-slate-500">{address.split('\n')[0]}</span>
      </section>
    )
  return (
    <section className="py-12 md:py-20 px-6 bg-slate-50">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-10">{sectionTitle}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-semibold text-teal-700 uppercase tracking-widest mb-1">
                Address
              </p>
              <p className="text-slate-700 whitespace-pre-line">{address}</p>
            </div>
            {phone ? (
              <div>
                <p className="text-xs font-semibold text-teal-700 uppercase tracking-widest mb-1">
                  Phone
                </p>
                <a
                  href={`tel:${phone.replace(/\s+/g, '')}`}
                  className="text-slate-800 hover:text-teal-700 transition"
                >
                  {phone}
                </a>
              </div>
            ) : null}
            {email ? (
              <div>
                <p className="text-xs font-semibold text-teal-700 uppercase tracking-widest mb-1">
                  Email
                </p>
                <a
                  href={`mailto:${email}`}
                  className="text-slate-800 hover:text-teal-700 transition"
                >
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
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-widest mb-3">
              Opening Hours
            </p>
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
}

const MedicalContactHours: Config<MedicalProps>['components']['MedicalContactHours'] = {
  label: 'Contact & Hours',
  fields: {
    variant: variantField(
      CONTACT_HOURS_VARIANT_LABELS,
      liveThumb(contactHoursBody, CONTACT_HOURS_FALLBACK)
    ),
    sectionTitle: { type: 'text' },
    address: { type: 'textarea' },
    phone: { type: 'text' },
    email: { type: 'text' },
    hours: { type: 'textarea' },
    emergencyNote: { type: 'text' },
  },
  defaultProps: CONTACT_HOURS_FALLBACK,
  render: contactHoursBody,
}

// ─── MedicalFAQ ──────────────────────────────────────────────────────────────
// items format: "Question | Answer" per line

const FAQ_VARIANT_LABELS: Record<string, string> = {
  '1': 'Accordion',
  '2': 'Dark accordion',
  '3': 'Two-column cards',
  '4': 'Minimal list',
}
const FAQ_FALLBACK = {
  variant: '1' as const,
  sectionTitle: 'Frequently Asked Questions',
  sectionSubtitle: 'Answers to common questions about our services and procedures.',
  items: [
    'How do I book an appointment? | You can book online through our website or call our helpline.',
    'Do you accept walk-in patients? | Yes, walk-ins are welcome but appointments are prioritised.',
    'Is cashless insurance available? | We are empanelled with 30+ insurers for cashless treatment.',
    'What are the visiting hours? | General visiting hours are 10 AM – 12 PM and 4 PM – 7 PM.',
    'Are second opinions available? | Yes, our specialists are happy to provide second opinions.',
  ].join('\n'),
}

function faqBody(props: MedicalProps['MedicalFAQ']) {
  const { variant, sectionTitle, sectionSubtitle, items } = props
  const rows = parsePipeLines(items, 2)
  const header = (align: 'text-center' | 'text-left', titleClass = '') => (
    <div className={`mb-10 ${align}`}>
      <h2 className={`text-2xl font-bold text-slate-900 md:text-3xl ${titleClass}`}>
        {sectionTitle}
      </h2>
      {sectionSubtitle ? (
        <p
          className={`mt-3 text-slate-500 ${align === 'text-center' ? 'mx-auto max-w-xl' : 'max-w-xl'}`}
        >
          {sectionSubtitle}
        </p>
      ) : null}
    </div>
  )
  if (variant === '2')
    return (
      <section className="bg-slate-900 px-6 py-12 md:py-20">
        <div className="mx-auto max-w-3xl">
          {header('text-center', 'text-white')}
          <div className="flex flex-col divide-y divide-white/10">
            {rows.map(([question, answer], i) => (
              <details key={i} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between">
                  <span className="font-medium text-white">{question}</span>
                  <span className="ml-4 shrink-0 text-teal-400 transition-transform group-open:rotate-180">
                    ▾
                  </span>
                </summary>
                <p className="mt-3 leading-relaxed text-slate-400">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    )
  if (variant === '3')
    return (
      <section className="bg-slate-50 px-6 py-12 md:py-20">
        <div className="mx-auto max-w-5xl">
          {header('text-center')}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {rows.map(([question, answer], i) => (
              <div key={i} className="rounded-xl bg-white p-5 shadow-sm">
                <p className="font-semibold text-slate-900">{question}</p>
                <p className="mt-2 text-sm text-slate-500">{answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  if (variant === '4')
    return (
      <section className="bg-white px-6 py-10">
        <div className="mx-auto max-w-2xl">
          {header('text-left')}
          <div className="flex flex-col gap-4">
            {rows.map(([question, answer], i) => (
              <div key={i}>
                <p className="text-sm font-semibold text-slate-900">{question}</p>
                <p className="text-sm text-slate-500">{answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  return (
    <section className="py-12 md:py-20 px-6 bg-white">
      <div className="mx-auto max-w-3xl">
        {header('text-center')}
        <div className="flex flex-col divide-y divide-slate-200">
          {rows.map(([question, answer], i) => (
            <details key={i} className="group py-4">
              <summary className="flex justify-between items-center cursor-pointer list-none">
                <span className="font-medium text-slate-900">{question}</span>
                <span className="ml-4 shrink-0 text-teal-600 group-open:rotate-180 transition-transform">
                  ▾
                </span>
              </summary>
              <p className="mt-3 text-slate-600 leading-relaxed">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

const MedicalFAQ: Config<MedicalProps>['components']['MedicalFAQ'] = {
  label: 'Medical FAQ',
  fields: {
    variant: variantField(FAQ_VARIANT_LABELS, liveThumb(faqBody, FAQ_FALLBACK)),
    sectionTitle: { type: 'text' },
    sectionSubtitle: { type: 'textarea' },
    items: { type: 'textarea' },
  },
  defaultProps: FAQ_FALLBACK,
  render: faqBody,
}

// ─── MedicalTopNav ───────────────────────────────────────────────────────────
// Exact-match port of the design reference's medHeader() — a dark contact
// topbar (welcome text + phone/hours + social) over a sticky white nav
// (brand + links + Appointment button). navLinks format: "Label|Href" lines.

const TOPNAV_VARIANT_LABELS: Record<string, string> = {
  '1': 'Topbar + sticky nav',
  '2': 'Single row, dark',
  '3': 'Centered, stacked',
  '4': 'Minimal',
}
// Mirrors this component's own defaultProps so the thumb has something to
// show before a component is selected / before real content is entered.
const THUMB_FALLBACK = {
  welcomeText: 'Welcome — Your Health, Our Priority!',
  phone: '(123) 456 7890',
  brand: 'Your Brand',
  logoUrl: '',
  navLinks: 'Home|#\nAbout|#\nContact|#',
  ctaLabel: 'Appointment',
  primaryColor: '',
}

// Reads the live props of the currently-selected MedicalTopNav (via Puck's
// own store) so the Design 1-4 thumbnails preview the page's actual logo,
// brand, phone and button color instead of generic placeholder text.
function useTopNavThumbProps() {
  const { selectedItem: selected } = usePuck()
  const props = (selected?.props ?? {}) as Partial<typeof THUMB_FALLBACK>
  return { ...THUMB_FALLBACK, ...props }
}

function TopNavVariantThumb({ variant }: { variant: string }) {
  const { welcomeText, phone, brand, logoUrl, navLinks, ctaLabel, primaryColor } =
    useTopNavThumbProps()
  const links = parsePipeLines(navLinks, 2)
    .slice(0, 3)
    .map(([label]) => label)
  const logo = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt="" className="h-3.5 w-3.5 rounded-full object-contain" />
  ) : null
  const ctaStyle = primaryColor ? { backgroundColor: primaryColor } : undefined
  const cta = ctaLabel ? (
    <span
      style={ctaStyle}
      className="rounded bg-slate-900 px-1.5 py-0.5 text-[7px] font-semibold text-white"
    >
      {ctaLabel}
    </span>
  ) : null

  if (variant === '2')
    return (
      <div className="flex h-16 w-full items-center justify-between gap-2 overflow-hidden rounded-md border border-slate-200 bg-slate-900 px-2.5">
        <span className="flex items-center gap-1 text-[9px] font-bold text-white">
          {logo}
          {brand}
        </span>
        <div className="flex gap-2">
          {links.map((l) => (
            <span key={l} className="text-[7px] text-white/60">
              {l}
            </span>
          ))}
        </div>
        {cta}
      </div>
    )
  if (variant === '3')
    return (
      <div className="flex h-16 w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-md border border-slate-200 bg-white p-2">
        <span className="flex items-center gap-1 text-[9px] font-bold text-slate-800">
          {logo}
          {brand}
        </span>
        <div className="flex gap-2">
          {links.map((l) => (
            <span key={l} className="text-[7px] text-slate-500">
              {l}
            </span>
          ))}
          {cta}
        </div>
      </div>
    )
  if (variant === '4')
    return (
      <div className="flex h-16 w-full items-center justify-between gap-1.5 overflow-hidden rounded-md border border-slate-200 bg-white px-2.5">
        <span className="flex items-center gap-1 text-[9px] font-bold text-slate-800">
          {logo}
          {brand}
        </span>
        {phone ? <span className="truncate text-[7px] text-slate-500">{phone}</span> : null}
        {cta}
      </div>
    )
  return (
    <div className="flex h-16 w-full flex-col overflow-hidden rounded-md border border-slate-200">
      <div className="flex h-4 w-full items-center justify-between bg-slate-900 px-2">
        <span className="truncate text-[6px] text-white/80">{welcomeText}</span>
        <span className="text-[6px] text-white/60">{phone}</span>
      </div>
      <div className="flex flex-1 items-center justify-between bg-white px-2">
        <span className="flex items-center gap-1 text-[9px] font-bold text-slate-800">
          {logo}
          {brand}
        </span>
        <div className="flex gap-1.5">
          {links.map((l) => (
            <span key={l} className="text-[7px] text-slate-500">
              {l}
            </span>
          ))}
        </div>
        {cta}
      </div>
    </div>
  )
}

const MedicalTopNav: Config<MedicalProps>['components']['MedicalTopNav'] = {
  label: 'Top Nav (topbar + sticky nav)',
  fields: {
    variant: variantField(TOPNAV_VARIANT_LABELS, TopNavVariantThumb),
    welcomeText: { type: 'text' },
    phone: { type: 'text' },
    hours: { type: 'text' },
    brand: { type: 'text' },
    logoUrl: { type: 'text' },
    navLinks: { type: 'textarea' },
    ctaLabel: { type: 'text' },
    ctaHref: { type: 'text' },
    primaryColor: { type: 'text' },
  },
  defaultProps: {
    variant: '1',
    welcomeText: 'Welcome — Your Health, Our Priority!',
    phone: '(123) 456 7890',
    hours: 'Mon–Sat: 8:00–18:00',
    brand: 'Your Brand',
    logoUrl: '',
    navLinks: [
      'Home|#',
      'About|#',
      'Services|#',
      'Service detail|#',
      'Products|#',
      'Product detail|#',
      'Pricing|#',
      'Portfolio|#',
    ].join('\n'),
    ctaLabel: 'Appointment',
    ctaHref: '#appointment',
    primaryColor: '',
  },
  render: ({
    variant,
    welcomeText,
    phone,
    hours,
    brand,
    logoUrl,
    navLinks,
    ctaLabel,
    ctaHref,
    primaryColor,
  }) => {
    const links = parsePipeLines(navLinks, 2)
    const logo = logoUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt={brand} className="h-8 w-8 rounded object-contain" />
    ) : null
    const cta = ctaLabel ? (
      <a
        href={ctaHref}
        style={primaryColor ? { backgroundColor: primaryColor } : undefined}
        className="inline-flex rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
      >
        {ctaLabel}
      </a>
    ) : null

    if (variant === '2') {
      return (
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 px-6 py-4">
          <span className="flex items-center gap-2 text-lg font-bold text-white">
            {logo}
            {brand}
          </span>
          <nav className="flex flex-wrap items-center gap-6">
            {links.map(([label, href], i) => (
              <a
                key={i}
                href={href}
                className="text-sm font-medium text-slate-300 hover:text-white"
              >
                {label}
              </a>
            ))}
          </nav>
          {cta}
        </div>
      )
    }
    if (variant === '3') {
      return (
        <div className="flex flex-col items-center gap-3 border-b border-slate-100 bg-white px-6 py-5">
          <span className="flex items-center gap-2 text-lg font-bold text-slate-900">
            {logo}
            {brand}
          </span>
          <nav className="flex flex-wrap items-center justify-center gap-6">
            {links.map(([label, href], i) => (
              <a key={i} href={href} className="text-sm font-medium text-slate-700">
                {label}
              </a>
            ))}
            {cta}
          </nav>
        </div>
      )
    }
    if (variant === '4') {
      return (
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-white px-6 py-4">
          <span className="flex items-center gap-2 text-lg font-bold text-slate-900">
            {logo}
            {brand}
          </span>
          {phone ? (
            <span className="hidden items-center gap-1.5 text-sm text-slate-600 sm:inline-flex">
              <Phone size={14} /> {phone}
            </span>
          ) : null}
          {cta}
        </div>
      )
    }
    return (
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 px-6 py-2 text-xs text-white">
          <span>{welcomeText}</span>
          <div className="flex flex-wrap items-center gap-4">
            {phone ? (
              <span className="inline-flex items-center gap-1.5 opacity-90">
                <Phone size={12} /> {phone}
              </span>
            ) : null}
            {hours ? (
              <span className="inline-flex items-center gap-1.5 opacity-90">
                <Clock size={12} /> {hours}
              </span>
            ) : null}
            <span className="flex gap-2">
              {[Facebook, Twitter, Linkedin].map((Icon, i) => (
                <span key={i} className="grid h-6 w-6 place-items-center rounded-full bg-white/20">
                  <Icon size={11} />
                </span>
              ))}
            </span>
          </div>
        </div>
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-lg font-bold text-slate-900">
              {logo}
              {brand}
            </span>
            <nav className="flex flex-1 flex-wrap justify-center gap-6">
              {links.map(([label, href], i) => (
                <a key={i} href={href} className="text-sm font-medium text-slate-700">
                  {label}
                </a>
              ))}
            </nav>
            {cta}
          </div>
        </div>
      </div>
    )
  },
}

// ─── MedicalHeroSplit ────────────────────────────────────────────────────────
// Exact-match port of medHome()'s hero — two-line heading, lead paragraph,
// dual CTAs, image right.

// Four layout styles ported from the design prototype's ggHeroSlider —
// "fullleft" / "split-light" / "split-navy" / "center-full" — as a Puck
// `variant` field instead of a live slider (the prototype's thumbnail picker
// showed a real scaled render of each; the carousel/rotation behavior itself
// is a separate feature from "pick a layout", so it's not ported here).
type HeroVariantProps = {
  eyebrow: string
  headingLine1: string
  headingLine2: string
  subtext: string
  primaryLabel: string
  primaryHref: string
  secondaryLabel: string
  secondaryHref: string
  image: string
  primaryColor: string
}

function heroCtas(
  { primaryLabel, primaryHref, secondaryLabel, secondaryHref, primaryColor }: HeroVariantProps,
  secondaryLight: boolean
) {
  return (
    <div className="flex flex-wrap gap-3">
      {primaryLabel ? (
        <a
          href={primaryHref}
          style={primaryColor ? { backgroundColor: primaryColor } : undefined}
          className="inline-flex rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white"
        >
          {primaryLabel}
        </a>
      ) : null}
      {secondaryLabel ? (
        <a
          href={secondaryHref}
          style={primaryColor ? { borderColor: primaryColor, color: primaryColor } : undefined}
          className={
            secondaryLight
              ? 'inline-flex rounded-lg border-2 border-white px-6 py-3 font-semibold text-white'
              : 'inline-flex rounded-lg border-2 border-slate-900 px-6 py-3 font-semibold text-slate-900'
          }
        >
          {secondaryLabel}
        </a>
      ) : null}
    </div>
  )
}

function heroVariantBody(variant: string, p: HeroVariantProps) {
  const heading = (
    <>
      {p.headingLine1}
      <br />
      {p.headingLine2}
    </>
  )

  // 1 — fullleft: background image, left-aligned text over a dark gradient.
  if (variant === '1') {
    return (
      <section className="relative min-h-[420px] overflow-hidden px-6 py-16 md:min-h-[480px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/60 to-transparent" />
        <div className="relative mx-auto flex h-full max-w-6xl items-center">
          <div className="max-w-lg">
            {p.eyebrow ? (
              <div className="text-xs font-bold uppercase tracking-wide text-white/80">
                {p.eyebrow}
              </div>
            ) : null}
            <h1 className="mt-3 mb-3 text-4xl font-extrabold tracking-tight text-white md:text-5xl">
              {heading}
            </h1>
            <p className="mb-6 max-w-md text-slate-200">{p.subtext}</p>
            {heroCtas(p, true)}
          </div>
        </div>
      </section>
    )
  }

  // 3 — split-navy: same split layout as 2, dark background, white text.
  if (variant === '3') {
    return (
      <section className="bg-slate-900 px-6 py-16">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 md:grid-cols-2">
          <div>
            {p.eyebrow ? (
              <div className="text-xs font-bold uppercase tracking-wide text-white/70">
                {p.eyebrow}
              </div>
            ) : null}
            <h1 className="mt-3 mb-3 text-4xl font-extrabold tracking-tight text-white md:text-5xl">
              {heading}
            </h1>
            <p className="mb-6 max-w-md text-slate-300">{p.subtext}</p>
            {heroCtas(p, true)}
          </div>
          <div className="min-h-[360px] overflow-hidden rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.image} alt="" className="h-full w-full object-cover" />
          </div>
        </div>
      </section>
    )
  }

  // 4 — center-full: full-bleed background image, dark overlay, centered text.
  if (variant === '4') {
    return (
      <section className="relative min-h-[420px] overflow-hidden px-6 py-16 text-center md:min-h-[480px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 to-slate-950/90" />
        <div className="relative mx-auto flex h-full max-w-2xl flex-col items-center justify-center">
          {p.eyebrow ? (
            <div className="text-xs font-bold uppercase tracking-wide text-white/80">
              {p.eyebrow}
            </div>
          ) : null}
          <h1 className="mt-3 mb-3 text-4xl font-extrabold tracking-tight text-white md:text-5xl">
            {heading}
          </h1>
          <p className="mb-6 text-slate-200">{p.subtext}</p>
          <div className="flex justify-center">{heroCtas(p, true)}</div>
        </div>
      </section>
    )
  }

  // 2 (default) — split-light: light background, text left, image right.
  return (
    <section className="bg-slate-50 px-6 py-16">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 md:grid-cols-2">
        <div>
          {p.eyebrow ? (
            <div className="text-xs font-bold uppercase tracking-wide text-slate-900">
              {p.eyebrow}
            </div>
          ) : null}
          <h1 className="mt-3 mb-3 text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
            {heading}
          </h1>
          <p className="mb-6 max-w-md text-slate-600">{p.subtext}</p>
          {heroCtas(p, false)}
        </div>
        <div className="min-h-[360px] overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.image} alt="" className="h-full w-full object-cover" />
        </div>
      </div>
    </section>
  )
}

const HERO_VARIANT_LABELS: Record<string, string> = {
  '1': 'Full-bleed, left text',
  '2': 'Split, light',
  '3': 'Split, dark',
  '4': 'Full-bleed, centered',
}

// Layout sketches (not live content previews) — abstract rectangles showing
// each variant's structure, cheap to build and enough to tell them apart.
function HeroVariantThumb({ variant }: { variant: string }) {
  const dark = variant === '3' || variant === '1' || variant === '4'
  const base = (
    <div
      className={`h-full w-full rounded ${dark ? 'bg-slate-700' : 'bg-slate-100'}`}
      style={{ position: 'relative' }}
    >
      {variant === '2' || variant === '3' ? (
        <div className="flex h-full w-full gap-1 p-1.5">
          <div className="flex flex-1 flex-col justify-center gap-1">
            <div className={`h-1.5 w-3/4 rounded ${dark ? 'bg-white/70' : 'bg-slate-900/70'}`} />
            <div className={`h-1.5 w-2/3 rounded ${dark ? 'bg-white/50' : 'bg-slate-900/50'}`} />
            <div className={`mt-1 h-2 w-8 rounded ${dark ? 'bg-white' : 'bg-slate-900'}`} />
          </div>
          <div className="flex-1 rounded bg-slate-400/60" />
        </div>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1.5">
          <div className="h-1.5 w-2/3 rounded bg-white/80" />
          <div className="h-1.5 w-1/2 rounded bg-white/60" />
          <div className="mt-1 h-2 w-8 rounded bg-white" />
        </div>
      )}
    </div>
  )
  return (
    <div className="h-16 w-full overflow-hidden rounded-md border border-slate-200">{base}</div>
  )
}

const MedicalHeroSplit: Config<MedicalProps>['components']['MedicalHeroSplit'] = {
  label: 'Hero (split, two-line heading)',
  fields: {
    variant: {
      type: 'custom',
      render: ({ value, onChange }) => (
        <div className="grid grid-cols-2 gap-2">
          {(['1', '2', '3', '4'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className="rounded-md text-left"
              style={{
                outline: value === v ? '2px solid #2563eb' : '1px solid transparent',
                outlineOffset: 2,
              }}
            >
              <HeroVariantThumb variant={v} />
              <div className="mt-1 text-xs font-medium">
                Design {v} — {HERO_VARIANT_LABELS[v]}
                {value === v ? ' · In use' : ''}
              </div>
            </button>
          ))}
        </div>
      ),
    },
    eyebrow: { type: 'text' },
    headingLine1: { type: 'text' },
    headingLine2: { type: 'text' },
    subtext: { type: 'textarea' },
    primaryLabel: { type: 'text' },
    primaryHref: { type: 'text' },
    secondaryLabel: { type: 'text' },
    secondaryHref: { type: 'text' },
    image: { type: 'text' },
    primaryColor: { type: 'text' },
  },
  defaultProps: {
    variant: '2',
    eyebrow: 'Welcome to our clinic',
    headingLine1: 'Your Health',
    headingLine2: 'Our Priority',
    subtext: "We provide the best medical services for you and your family's health.",
    primaryLabel: 'Our Services',
    primaryHref: '#services',
    secondaryLabel: 'Contact Us',
    secondaryHref: '#contact',
    image: 'https://placehold.co/900x800',
    primaryColor: '',
  },
  render: (props) => heroVariantBody(props.variant, props),
}

// ─── MedicalContactInfoCards ─────────────────────────────────────────────────
// Exact-match port of medHome()'s overlapping white info-card row.
// cells format: "icon|Title|Subtitle" — icon in phone|clock|location|email.

const INFO_ICONS = { phone: Phone, clock: Clock, location: MapPin, email: Mail } as const

const MedicalContactInfoCards: Config<MedicalProps>['components']['MedicalContactInfoCards'] = {
  label: 'Contact Info Cards',
  fields: {
    cells: { type: 'textarea' },
  },
  defaultProps: {
    cells: [
      'phone|Emergency Case|(123) 456 7890',
      'clock|Opening Hours|Mon–Sat: 8:00–18:00',
      'location|Location|123 Medical Street, NY',
      'email|Email Us|info@yourbrand.com',
    ].join('\n'),
  },
  render: ({ cells }) => {
    const rows = parsePipeLines(cells, 3)
    return (
      <div className="relative z-[3] -mt-10 px-6">
        <div className="mx-auto grid max-w-6xl grid-cols-1 rounded-2xl bg-white shadow-xl sm:grid-cols-2 md:grid-cols-4">
          {rows.map(([icon, title, subtitle], i) => {
            const Icon = INFO_ICONS[icon as keyof typeof INFO_ICONS] ?? Phone
            return (
              <div
                key={i}
                className={`flex items-center gap-3 p-6 ${i < rows.length - 1 ? 'md:border-r md:border-slate-100' : ''}`}
              >
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-900/10 text-slate-900">
                  <Icon size={20} />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">{title}</div>
                  <div className="text-sm text-slate-500">{subtitle}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
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
  MedicalTopNav,
  MedicalHeroSplit,
  MedicalContactInfoCards,
}

export const medical: ComponentPack = {
  key: 'medical',
  label: 'Medical',
  components: typedComponents as NonNullable<Config['components']>,
  categories: {
    'medical-nav-hero': {
      title: 'Medical — Clinic Template',
      components: ['MedicalTopNav', 'MedicalHeroSplit', 'MedicalContactInfoCards'],
    },
    'medical-hero': { title: 'Medical — Hero', components: ['MedicalHero'] },
    'medical-services': {
      title: 'Medical — Services & Departments',
      components: ['MedicalServicesList', 'MedicalDepartmentCards'],
    },
    'medical-team': {
      title: 'Medical — Team',
      components: ['MedicalDoctorProfiles'],
    },
    'medical-patient': {
      title: 'Medical — Patient',
      components: ['MedicalPatientTestimonials', 'MedicalFAQ'],
    },
    'medical-cta': {
      title: 'Medical — Calls to Action',
      components: ['MedicalAppointmentCTA'],
    },
    'medical-info': {
      title: 'Medical — Info',
      components: ['MedicalInsuranceStrip', 'MedicalContactHours'],
    },
  },
  variants: {
    MedicalTopNav: ['1', '2', '3', '4'],
    MedicalHeroSplit: ['1', '2', '3', '4'],
    MedicalHero: ['1', '2', '3', '4'],
    MedicalServicesList: ['1', '2', '3', '4'],
    MedicalDoctorProfiles: ['1', '2', '3', '4'],
    MedicalAppointmentCTA: ['1', '2', '3', '4'],
    MedicalDepartmentCards: ['1', '2', '3', '4'],
    MedicalPatientTestimonials: ['1', '2', '3', '4'],
    MedicalInsuranceStrip: ['1', '2', '3', '4'],
    MedicalContactHours: ['1', '2', '3', '4'],
    MedicalFAQ: ['1', '2', '3', '4'],
  },
}
