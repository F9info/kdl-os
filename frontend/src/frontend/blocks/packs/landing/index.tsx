import type { CSSProperties, ReactNode } from 'react'
import type { Config } from '@puckeditor/core'
import type { ComponentPack } from '../types'
import { imageField } from '../image-field'
import { ContactFormBlock } from '../general/contact-form'
import { safeHref } from '@/frontend/lib/safe-href'
import { useIdentity } from '@/hooks/useIdentity'
import { FONT_OPTIONS, type FontPair } from './fonts'
import { PALETTE_OPTIONS, type Palette } from './palettes'
import {
  BenefitsDesign,
  CtaDesign,
  FaqDesign,
  ShowcaseDesign,
  StatsDesign,
  TestimonialsDesign,
  type Variant,
} from './section-variants'
import {
  BlogDesign,
  ClientsDesign,
  ContactDesign,
  FooterDesign,
  GalleryDesign,
  NewsletterDesign,
  PeopleDesign,
  PortfolioDesign,
  PricingDesign,
  StepsDesign,
  type BlogProps,
  type ClientsProps,
  type ContactProps,
  type GalleryProps,
  type NewsletterProps,
  type PortfolioProps,
  type PricingProps,
} from './section-designs-more'
import { lines, rows, look, display, SectionHead, type Common } from './shared'

// Landing blocks: big gradient heroes, circular photo frames, floating cards and rich headline fonts,
// for single-purpose landing pages. Every block takes a `palette` and a `font` choice, so one change
// recolours or restyles a section, and every text and picture is an ordinary editable field.

type LandingProps = {
  LandingHero: Common & {
    variant: '1' | '2' | '3' | '4'
    eyebrow: string
    headline: string
    highlight: string
    subtitle: string
    ctaLabel: string
    ctaHref: string
    secondaryLabel: string
    secondaryHref: string
    image: string
    avatars: string
    proofText: string
    badgeValue: string
    badgeLabel: string
    noteTitle: string
    noteText: string
    chartTitle: string
  }
  LandingStats: Common & { variant?: Variant; stats: string }
  LandingBenefits: Common & {
    variant?: Variant
    tone: 'light' | 'dark'
    eyebrow: string
    title: string
    subtitle: string
    columns: '2' | '3' | '4'
    items: string
  }
  LandingShowcase: Common & {
    variant?: Variant
    eyebrow: string
    title: string
    text: string
    bullets: string
    image: string
    reverse: boolean
    ctaLabel: string
    ctaHref: string
  }
  LandingSteps: Common & {
    variant?: Variant
    layout: 'cards' | 'list'
    eyebrow: string
    title: string
    subtitle: string
    items: string
  }
  LandingPeople: Common & {
    variant?: Variant
    eyebrow: string
    title: string
    subtitle: string
    columns: '2' | '3' | '4'
    items: string
  }
  LandingTestimonials: Common & { variant?: Variant; eyebrow: string; title: string; items: string }
  LandingFaq: Common & { variant?: Variant; eyebrow: string; title: string; items: string }
  LandingCta: Common & {
    variant?: Variant
    title: string
    text: string
    buttonLabel: string
    buttonHref: string
    image: string
  }
  LandingPricing: PricingProps & { variant?: Variant }
  LandingPortfolio: PortfolioProps & { variant?: Variant }
  LandingGallery: GalleryProps & { variant?: Variant }
  LandingClients: ClientsProps & { variant?: Variant }
  LandingContact: ContactProps & { variant?: Variant }
  LandingNewsletter: NewsletterProps & { variant?: Variant }
  LandingBlog: BlogProps & { variant?: Variant }
  LandingHeader: Common & { links: string; ctaLabel: string; ctaHref: string }
  LandingFooter: Common & { variant?: Variant; links: string; note: string }
  LandingForm: Common & {
    eyebrow: string
    title: string
    subtitle: string
    formSlug: string
    anchor: string
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// The few keyframes the floating cards use; honours "reduce motion".
const FLOAT_CSS =
  '@media (prefers-reduced-motion:no-preference){@keyframes lp-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}.lp-float{animation:lp-float 6s ease-in-out infinite}.lp-float-b{animation-delay:-3s}}'

/** The headline with the highlight phrase in the accent colour. */
function Headline({
  text,
  highlight,
  color,
  accent,
  f,
  className,
}: {
  text: string
  highlight: string
  color: string
  accent: string
  f: FontPair
  className: string
}) {
  const at = highlight ? text.toLowerCase().indexOf(highlight.toLowerCase()) : -1
  return (
    <h1 className={className} style={{ ...display(f), color }}>
      {at < 0 ? (
        text
      ) : (
        <>
          {text.slice(0, at)}
          <span style={{ color: accent }}>{text.slice(at, at + highlight.length)}</span>
          {text.slice(at + highlight.length)}
        </>
      )}
    </h1>
  )
}

function Avatars({ urls }: { urls: string[] }) {
  return (
    <div className="flex -space-x-3">
      {urls.slice(0, 4).map((u, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={u}
          alt=""
          className="h-9 w-9 rounded-full border-2 border-white object-cover shadow"
        />
      ))}
    </div>
  )
}

function FloatBadge({
  value,
  label,
  p,
  className,
}: {
  value: string
  label: string
  p: Palette
  className: string
}) {
  if (!value && !label) return null
  return (
    <div className={`lp-float absolute rounded-2xl bg-white px-4 py-3 shadow-xl ${className}`}>
      <div className="text-lg font-bold leading-none" style={{ color: p.strong }}>
        {value}
      </div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  )
}

function FloatNote({
  title,
  text,
  avatar,
  className,
}: {
  title: string
  text: string
  avatar?: string
  className: string
}) {
  if (!title && !text) return null
  return (
    <div
      className={`lp-float lp-float-b absolute flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-xl ${className}`}
    >
      {avatar && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
      )}
      <div>
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">{text}</div>
      </div>
    </div>
  )
}

/** A dashboard-style card with a line chart and bars (hero design 3). */
function DashboardCard({ p, title, value }: { p: Palette; title: string; value: string }) {
  const bars = [38, 56, 44, 70, 52, 84, 64, 96]
  return (
    <div className="relative rounded-3xl bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-slate-500">{title}</div>
          <div className="mt-1 text-3xl font-bold" style={{ color: p.strong }}>
            {value}
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
          This year
        </span>
      </div>
      <svg viewBox="0 0 400 130" className="mt-4 h-32 w-full" role="img" aria-label="Growth chart">
        <defs>
          <linearGradient id="lp-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={p.strong} stopOpacity=".28" />
            <stop offset="1" stopColor={p.strong} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0 105 L55 82 L110 92 L165 58 L220 70 L275 36 L330 48 L400 12 V130 H0Z"
          fill="url(#lp-area)"
        />
        <path
          d="M0 105 L55 82 L110 92 L165 58 L220 70 L275 36 L330 48 L400 12"
          fill="none"
          stroke={p.strong}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="400" cy="12" r="6" fill={p.strong} />
      </svg>
      <div className="mt-3 flex h-20 items-end gap-2">
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-lg"
            style={{ height: `${h}%`, background: p.ring, opacity: 0.55 + i * 0.05 }}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function HeroBlock(props: LandingProps['LandingHero']) {
  const { p, f } = look(props)
  const avatars = lines(props.avatars)
  const center = props.variant === '2'
  const cta =
    props.ctaLabel &&
    (() => {
      const filled = p.button.startsWith('linear')
        ? { backgroundImage: p.button }
        : { background: p.button }
      return (
        <a
          href={safeHref(props.ctaHref)}
          className="inline-flex items-center rounded-full px-7 py-3.5 text-sm font-semibold shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
          style={{ ...filled, color: p.buttonText }}
        >
          {props.ctaLabel}
        </a>
      )
    })()

  const copy = (
    <div className={`flex flex-col gap-6 ${center ? 'items-center text-center' : 'items-start'}`}>
      {props.eyebrow && (
        <span
          className="rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white"
          style={{ background: p.pill }}
        >
          {props.eyebrow}
        </span>
      )}
      <Headline
        text={props.headline}
        highlight={props.highlight}
        color={p.ink}
        accent={p.accent}
        f={f}
        className="text-4xl leading-[1.08] md:text-6xl"
      />
      {props.subtitle && (
        <p className="max-w-xl text-base leading-relaxed md:text-lg" style={{ color: p.body }}>
          {props.subtitle}
        </p>
      )}
      <div className={`flex flex-wrap items-center gap-4 ${center ? 'justify-center' : ''}`}>
        {cta}
        {props.secondaryLabel && (
          <a
            href={safeHref(props.secondaryHref)}
            className="inline-flex items-center gap-2 text-sm font-semibold"
            style={{ color: p.ink }}
          >
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-slate-900 shadow">
              ›
            </span>
            {props.secondaryLabel}
          </a>
        )}
      </div>
      {(avatars.length > 0 || props.proofText) && (
        <div className={`flex items-center gap-3 ${center ? 'justify-center' : ''}`}>
          {avatars.length > 0 && <Avatars urls={avatars} />}
          {props.proofText && (
            <span className="text-sm font-medium" style={{ color: p.body }}>
              {props.proofText}
            </span>
          )}
        </div>
      )}
    </div>
  )

  let visual: ReactNode = null
  if (props.variant === '1') {
    visual = (
      <div className="relative mx-auto aspect-square w-full max-w-[540px]">
        <div className="absolute inset-0 rounded-full opacity-70" style={{ background: p.ring }} />
        <div className="absolute inset-[5%] rounded-full bg-white/55" />
        <div className="absolute inset-[10%] rounded-full bg-white/70" />
        {props.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={props.image}
            alt=""
            className="absolute inset-[13%] h-[74%] w-[74%] rounded-full object-cover shadow-2xl"
          />
        )}
        <FloatBadge
          value={props.badgeValue}
          label={props.badgeLabel}
          p={p}
          className="left-0 top-[12%]"
        />
        <FloatNote
          title={props.noteTitle}
          text={props.noteText}
          avatar={avatars[0]}
          className="bottom-[8%] right-0"
        />
      </div>
    )
  } else if (props.variant === '3') {
    visual = (
      <div className="relative mx-auto w-full max-w-[520px]">
        <div
          className="absolute -right-8 -top-8 h-64 w-64 rounded-full opacity-70 blur-2xl"
          style={{ background: p.ring }}
        />
        <DashboardCard p={p} title={props.chartTitle} value={props.badgeValue} />
        <FloatNote
          title={props.noteTitle}
          text={props.noteText}
          avatar={avatars[0]}
          className="-bottom-6 -left-4"
        />
        <FloatBadge value="↑" label={props.badgeLabel} p={p} className="-right-3 top-1/2" />
      </div>
    )
  } else if (props.variant === '4') {
    visual = (
      <div className="relative mx-auto w-full max-w-[560px]">
        <div
          className="absolute -inset-4 rounded-[2.4rem] opacity-70 blur-2xl"
          style={{ background: p.ring }}
        />
        {props.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={props.image}
            alt=""
            className="relative aspect-[4/3] w-full rounded-[2rem] object-cover shadow-2xl ring-1 ring-white/25"
          />
        )}
        <FloatBadge
          value={props.badgeValue}
          label={props.badgeLabel}
          p={p}
          className="-left-4 top-8"
        />
        <FloatNote
          title={props.noteTitle}
          text={props.noteText}
          avatar={avatars[0]}
          className="-bottom-5 right-4"
        />
      </div>
    )
  }

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: p.hero, fontFamily: f.body }}
    >
      <style>{FLOAT_CSS}</style>
      <div className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-white/30 blur-3xl" />
      {center ? (
        <div className="relative mx-auto max-w-4xl px-6 py-16 md:py-24">
          {copy}
          {props.image && (
            <div className="relative mx-auto mt-14 max-w-3xl">
              <div
                className="absolute -inset-4 rounded-[2.4rem] opacity-60 blur-2xl"
                style={{ background: p.ring }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={props.image}
                alt=""
                className="relative aspect-[16/8] w-full rounded-[2rem] object-cover shadow-2xl ring-1 ring-white/30"
              />
              <FloatBadge
                value={props.badgeValue}
                label={props.badgeLabel}
                p={p}
                className="-left-4 top-8 hidden md:block"
              />
              <FloatNote
                title={props.noteTitle}
                text={props.noteText}
                avatar={avatars[0]}
                className="-bottom-5 -right-3 hidden md:flex"
              />
            </div>
          )}
        </div>
      ) : (
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 md:grid-cols-2 md:py-24">
          {copy}
          {visual}
        </div>
      )}
    </section>
  )
}

// ─── Lower sections ───────────────────────────────────────────────────────────

const section = 'px-6 py-16 md:py-24'

function StatsBlock(props: LandingProps['LandingStats']) {
  if (props.variant && props.variant !== '1')
    return <StatsDesign {...props} variant={props.variant} />
  const { stats, palette, font } = props
  const { p, f } = look({ palette, font })
  const items = rows(stats, 2)
  return (
    <section className="px-6 py-12" style={{ fontFamily: f.body }}>
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 md:grid-cols-4">
        {items.map(([value, label], i) => (
          <div
            key={i}
            className="rounded-3xl p-6 text-center shadow-sm ring-1 ring-black/5"
            style={{ background: p.soft }}
          >
            <div className="text-3xl md:text-4xl" style={{ ...display(f), color: p.strong }}>
              {value}
            </div>
            <div className="mt-1 text-sm text-slate-600">{label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function BenefitsBlock(props: LandingProps['LandingBenefits']) {
  if (props.variant && props.variant !== '1')
    return <BenefitsDesign {...props} variant={props.variant} />
  const { p, f } = look(props)
  const dark = props.tone === 'dark'
  const cols =
    { '2': 'md:grid-cols-2', '3': 'md:grid-cols-3', '4': 'md:grid-cols-2 lg:grid-cols-4' }[
      props.columns
    ] ?? 'md:grid-cols-3'
  return (
    <section
      className={section}
      style={{ fontFamily: f.body, background: dark ? '#0f0a24' : '#ffffff' }}
    >
      <div className="mx-auto max-w-6xl">
        <SectionHead
          eyebrow={props.eyebrow}
          title={props.title}
          subtitle={props.subtitle}
          p={p}
          f={f}
          light={dark}
        />
        <div className={`grid gap-6 sm:grid-cols-2 ${cols}`}>
          {rows(props.items, 3).map(([icon, title, text], i) => (
            <div
              key={i}
              className="rounded-3xl p-7 transition hover:-translate-y-1 hover:shadow-xl"
              style={
                dark
                  ? {
                      background: 'rgba(255,255,255,.06)',
                      border: '1px solid rgba(255,255,255,.12)',
                    }
                  : { background: p.soft }
              }
            >
              <span
                className="mb-5 grid h-14 w-14 place-items-center rounded-2xl text-2xl shadow-sm"
                style={{ background: dark ? p.ring : '#fff' }}
              >
                {icon}
              </span>
              <h3 className="text-lg font-semibold" style={{ color: dark ? '#fff' : '#17112b' }}>
                {title}
              </h3>
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: dark ? 'rgba(255,255,255,.72)' : '#5b5675' }}
              >
                {text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ShowcaseBlock(props: LandingProps['LandingShowcase']) {
  if (props.variant && props.variant !== '1')
    return <ShowcaseDesign {...props} variant={props.variant} />
  const { p, f } = look(props)
  return (
    <section className={section} style={{ fontFamily: f.body, background: p.soft }}>
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
        <div className={props.reverse ? 'md:order-2' : ''}>
          {props.eyebrow && (
            <span
              className="text-xs font-semibold uppercase tracking-[0.18em]"
              style={{ color: p.strong }}
            >
              {props.eyebrow}
            </span>
          )}
          <h2
            className="mt-2 text-3xl leading-tight md:text-5xl"
            style={{ ...display(f), color: '#17112b' }}
          >
            {props.title}
          </h2>
          {props.text && (
            <p className="mt-4 text-base leading-relaxed text-slate-600 md:text-lg">{props.text}</p>
          )}
          <ul className="mt-6 space-y-3">
            {lines(props.bullets).map((b, i) => (
              <li key={i} className="flex items-start gap-3 text-slate-700">
                <span
                  className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                  style={{ background: p.strong }}
                >
                  ✓
                </span>
                {b}
              </li>
            ))}
          </ul>
          {props.ctaLabel && (
            <a
              href={safeHref(props.ctaHref)}
              className="mt-8 inline-flex rounded-full px-7 py-3.5 text-sm font-semibold shadow-lg"
              style={{
                ...(p.button.startsWith('linear')
                  ? { backgroundImage: p.button }
                  : { background: p.button }),
                color: p.buttonText,
              }}
            >
              {props.ctaLabel}
            </a>
          )}
        </div>
        <div className="relative">
          <div
            className="absolute -inset-3 rounded-[2.4rem] opacity-60 blur-xl"
            style={{ background: p.ring }}
          />
          {props.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={props.image}
              alt=""
              className="relative aspect-[4/3] w-full rounded-[2rem] object-cover shadow-2xl"
            />
          )}
        </div>
      </div>
    </section>
  )
}

function StepsBlock(props: LandingProps['LandingSteps']) {
  if (props.variant && props.variant !== '1')
    return <StepsDesign {...props} variant={props.variant} />
  const { p, f } = look(props)
  const items = rows(props.items, 3)
  return (
    <section className={section} style={{ fontFamily: f.body, background: '#fff' }}>
      <div className="mx-auto max-w-5xl">
        <SectionHead
          eyebrow={props.eyebrow}
          title={props.title}
          subtitle={props.subtitle}
          p={p}
          f={f}
        />
        {props.layout === 'list' ? (
          <ol className="mx-auto max-w-3xl space-y-4">
            {items.map(([label, title, text], i) => (
              <li
                key={i}
                className="flex flex-col gap-3 rounded-3xl p-6 sm:flex-row sm:items-center sm:gap-6"
                style={{ background: p.soft }}
              >
                <span
                  className="w-fit shrink-0 rounded-full px-4 py-2 text-sm font-bold text-white"
                  style={{ background: p.strong }}
                >
                  {label}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <ol className="grid gap-8 md:grid-cols-3">
            {items.map(([icon, title, text], i) => (
              <li
                key={i}
                className="relative rounded-3xl p-8 text-center"
                style={{ background: p.soft }}
              >
                <span
                  className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full text-2xl text-white shadow-lg"
                  style={{ background: p.band }}
                >
                  {icon}
                </span>
                <span
                  className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: p.strong }}
                >
                  Step {i + 1}
                </span>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm text-slate-600">{text}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}

function PeopleBlock(props: LandingProps['LandingPeople']) {
  if (props.variant && props.variant !== '1')
    return <PeopleDesign {...props} variant={props.variant} />
  const { p, f } = look(props)
  const cols =
    { '2': 'md:grid-cols-2', '3': 'md:grid-cols-3', '4': 'md:grid-cols-2 lg:grid-cols-4' }[
      props.columns
    ] ?? 'md:grid-cols-3'
  return (
    <section className={section} style={{ fontFamily: f.body, background: p.soft }}>
      <div className="mx-auto max-w-6xl">
        <SectionHead
          eyebrow={props.eyebrow}
          title={props.title}
          subtitle={props.subtitle}
          p={p}
          f={f}
        />
        <div className={`grid gap-8 sm:grid-cols-2 ${cols}`}>
          {rows(props.items, 2).map(([name, role, bio, photo], i) => (
            <article
              key={i}
              className="overflow-hidden rounded-3xl bg-white shadow-md transition hover:-translate-y-1 hover:shadow-xl"
            >
              {photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt={name} className="aspect-square w-full object-cover" />
              )}
              <div className="p-6">
                <h3 className="text-lg font-semibold text-slate-900">{name}</h3>
                <p className="text-sm font-medium" style={{ color: p.strong }}>
                  {role}
                </p>
                {bio && <p className="mt-3 text-sm leading-relaxed text-slate-600">{bio}</p>}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function TestimonialsBlock(props: LandingProps['LandingTestimonials']) {
  if (props.variant && props.variant !== '1')
    return <TestimonialsDesign {...props} variant={props.variant} />
  const { p, f } = look(props)
  return (
    <section className={section} style={{ fontFamily: f.body, background: '#fff' }}>
      <div className="mx-auto max-w-6xl">
        <SectionHead eyebrow={props.eyebrow} title={props.title} p={p} f={f} />
        <div className="grid gap-6 md:grid-cols-3">
          {rows(props.items, 2).map(([quote, name, role, photo], i) => (
            <figure
              key={i}
              className="relative rounded-3xl p-8 shadow-lg ring-1 ring-black/5"
              style={{ background: i === 1 ? p.soft : '#fff' }}
            >
              <span
                className="absolute right-6 top-3 text-7xl leading-none opacity-15"
                style={{ color: p.strong, fontFamily: 'Georgia, serif' }}
              >
                “
              </span>
              <div className="text-sm tracking-widest text-amber-400" aria-label="5 out of 5 stars">
                ★★★★★
              </div>
              <blockquote className="mt-4 text-base leading-relaxed text-slate-700">
                {quote}
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                {photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover ring-2 ring-white"
                  />
                )}
                <div>
                  <div className="text-sm font-semibold text-slate-900">{name}</div>
                  <div className="text-xs text-slate-500">{role}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

function FaqBlock(props: LandingProps['LandingFaq']) {
  if (props.variant && props.variant !== '1')
    return <FaqDesign {...props} variant={props.variant} />
  const { p, f } = look(props)
  return (
    <section className={section} style={{ fontFamily: f.body, background: p.soft }}>
      <div className="mx-auto max-w-3xl">
        <SectionHead eyebrow={props.eyebrow} title={props.title} p={p} f={f} />
        <div className="space-y-3">
          {rows(props.items, 2).map(([q, a], i) => (
            <details
              key={i}
              className="group rounded-2xl bg-white px-6 py-5 shadow-sm ring-1 ring-black/5"
              open={i === 0}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-slate-900">
                {q}
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-lg text-white transition group-open:rotate-45"
                  style={{ background: p.strong }}
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function CtaBlock(props: LandingProps['LandingCta']) {
  if (props.variant && props.variant !== '1')
    return <CtaDesign {...props} variant={props.variant} />
  const { p, f } = look(props)
  return (
    <section className="px-6 py-12 md:py-16" style={{ fontFamily: f.body, background: '#fff' }}>
      <div
        className="relative mx-auto grid max-w-6xl items-center gap-8 overflow-hidden rounded-[2.5rem] px-8 py-14 text-white md:px-14"
        style={{ background: p.band, gridTemplateColumns: props.image ? undefined : '1fr' }}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/15" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-white/10" />
        <div
          className={`relative ${props.image ? '' : 'text-center'} ${props.image ? 'md:grid md:grid-cols-[1.2fr_1fr] md:items-center md:gap-10' : ''}`}
        >
          <div className={props.image ? '' : 'mx-auto max-w-2xl'}>
            <h2 className="text-3xl leading-tight md:text-5xl" style={display(f)}>
              {props.title}
            </h2>
            {props.text && <p className="mt-4 text-base text-white/85 md:text-lg">{props.text}</p>}
            {props.buttonLabel && (
              <a
                href={safeHref(props.buttonHref)}
                className="mt-8 inline-flex rounded-full bg-white px-8 py-4 text-sm font-bold shadow-xl transition hover:-translate-y-0.5"
                style={{ color: p.strong }}
              >
                {props.buttonLabel}
              </a>
            )}
          </div>
          {props.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={props.image}
              alt=""
              className="mt-8 aspect-[4/3] w-full rounded-3xl object-cover shadow-2xl md:mt-0"
            />
          )}
        </div>
      </div>
    </section>
  )
}

function FormBlock(props: LandingProps['LandingForm'] & { readOnly: boolean; preview: boolean }) {
  const { p, f } = look(props)
  return (
    <section
      className={section}
      style={
        {
          fontFamily: f.body,
          background: p.hero,
          // The form's Send button reads the primary colour tokens: point them at this palette.
          '--branding_brand_colors_primary_color': p.strong,
          '--buttons_primary_button_text_color': '#ffffff',
        } as CSSProperties
      }
    >
      <div className="mx-auto max-w-2xl">
        <SectionHead
          eyebrow={props.eyebrow}
          title={props.title}
          subtitle={props.subtitle}
          p={p}
          f={f}
          light={p.dark}
        />
        {props.preview ? (
          // "View template": the form does not exist yet, so show what it will look like.
          <div id={props.anchor || undefined} className="mx-auto max-w-xl px-6 py-12">
            <div className="space-y-4 rounded-xl border border-divider bg-card p-6">
              {['Name *', 'Email *', 'Message'].map((label) => (
                <div key={label}>
                  <div className="mb-1 text-sm font-medium text-title">{label}</div>
                  <div
                    className={`w-full rounded-md border border-border bg-background px-3 ${label === 'Message' ? 'h-24' : 'h-10'}`}
                  />
                </div>
              ))}
              <div className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                Send
              </div>
            </div>
          </div>
        ) : (
          <ContactFormBlock
            formSlug={props.formSlug}
            anchor={props.anchor}
            title=""
            readOnly={props.readOnly}
          />
        )}
      </div>
    </section>
  )
}

// ─── Header (logo, name and phone come only from Application Identity) ────────

/**
 * The top bar of a landing page: the company logo and name, optional menu links, the phone number and one
 * call-to-action button. Logo, name and phone are read from Settings > Identity (or the page's own Branding),
 * never typed into the block; only the menu links and the button are.
 */
function HeaderBlock(props: LandingProps['LandingHeader'] & { metaIdentity?: IdentityMap }) {
  const live = useIdentity().identity as IdentityMap
  const id = props.metaIdentity ?? live
  const { p, f } = look(props)
  const get = (k: string) => id[k]?.trim() ?? ''
  const name = get('company_name') || get('app_name')
  const logo = get('company_logo_light') || get('logo_light')
  const phone = get('contact_phone')
  const links = rows(props.links, 2)
  return (
    <header
      style={{ fontFamily: f.body }}
      className="relative z-10 border-b border-black/5 bg-white"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <a href="#" className="flex min-w-0 items-center gap-3">
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={name} className="h-10 w-auto max-w-[160px] object-contain" />
          )}
          {name && (
            <span className="truncate text-xl text-slate-900" style={display(f)}>
              {name}
            </span>
          )}
        </a>
        {links.length > 0 && (
          <nav
            aria-label="Header"
            className="hidden items-center gap-6 text-sm font-medium md:flex"
          >
            {links.map(([label, href], i) => (
              <a
                key={i}
                href={safeHref(href)}
                className="text-slate-700 transition hover:text-slate-950"
              >
                {label}
              </a>
            ))}
          </nav>
        )}
        <div className="flex shrink-0 items-center gap-4">
          {phone && (
            <a
              href={safeHref(`tel:${phone.replace(/[^+\d]/g, '')}`)}
              className="hidden text-sm font-semibold sm:inline"
              style={{ color: p.strong }}
            >
              {phone}
            </a>
          )}
          {props.ctaLabel && (
            <a
              href={safeHref(props.ctaHref || '#contact')}
              className="rounded-full px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              style={{ background: p.strong }}
            >
              {props.ctaLabel}
            </a>
          )}
        </div>
      </div>
    </header>
  )
}

// ─── Brand colours: Identity's primary and secondary colour for the "brand" colour set ─────────────────────

const HEX = /^#[0-9a-fA-F]{3,8}$/

/**
 * Sets --lp-1 and --lp-2 for the block it wraps (display: contents, so layout is untouched). The "brand" colour
 * set in palettes.ts reads them. A landing page's own Branding overrides arrive through `metadata.identity`.
 */
function BrandScope({
  metaIdentity,
  children,
}: {
  metaIdentity?: IdentityMap
  children: ReactNode
}) {
  const live = useIdentity().identity as IdentityMap
  const pick = (k: string) => {
    const v = (metaIdentity?.[k] || live[k] || '').trim()
    return HEX.test(v) ? v : undefined
  }
  const style = {
    display: 'contents',
    '--lp-1': pick('brand_primary'),
    '--lp-2': pick('brand_secondary'),
  } as CSSProperties
  return <div style={style}>{children}</div>
}

// ─── Footer (content comes only from Application Identity) ────────────────────

const SOCIALS: [key: string, label: string][] = [
  ['social_facebook', 'Facebook'],
  ['social_x', 'X'],
  ['social_instagram', 'Instagram'],
  ['social_linkedin', 'LinkedIn'],
  ['social_youtube', 'YouTube'],
]

type IdentityMap = Record<string, string | undefined>

/**
 * The footer shows the company's name, logo, description, contact details and social links straight
 * from Settings > Identity, so there is one place to change them. A landing page's own Branding
 * overrides arrive through `metadata.identity` (see PageRender); otherwise the live Identity is read.
 * Nothing about the company is typed into the block: only the quick links and an extra line are.
 */
function FooterBlock(props: LandingProps['LandingFooter'] & { metaIdentity?: IdentityMap }) {
  const live = useIdentity().identity as IdentityMap
  const id = props.metaIdentity ?? live
  const { p, f } = look(props)
  const get = (k: string) => id[k]?.trim() ?? ''
  const name = get('company_name') || get('app_name')
  const darkLogo = get('company_logo_dark') || get('logo_dark')
  const logo = darkLogo || get('company_logo_light') || get('logo_light')
  const emails = [get('contact_email'), get('contact_email_secondary')].filter(Boolean)
  const phones = [get('contact_phone'), get('contact_phone_secondary')].filter(Boolean)
  const address = get('contact_address')
  const socials = SOCIALS.map(([k, label]) => [label, get(k)] as const).filter(([, url]) => url)
  const links = rows(props.links, 2)
  const copyright =
    get('copyright') || (name ? `© ${new Date().getFullYear()} ${name}. All rights reserved.` : '')
  const hasContact = emails.length + phones.length > 0 || Boolean(address)
  if (props.variant && props.variant !== '1')
    return (
      <FooterDesign
        variant={props.variant}
        palette={props.palette}
        font={props.font}
        data={{
          name,
          logo,
          darkLogo: Boolean(darkLogo),
          description: get('description'),
          emails,
          phones,
          address,
          socials,
          links,
          copyright,
          note: props.note,
        }}
      />
    )
  const heading = 'text-xs font-semibold uppercase tracking-[0.18em]'

  return (
    <footer
      style={{ background: p.footer, fontFamily: f.body }}
      className="px-6 pb-8 pt-16 text-white/75"
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1.2fr]">
          <div>
            {logo && (
              // A light-background logo sits on a white chip; a dark-background logo goes straight on.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt={name}
                className={
                  darkLogo
                    ? 'h-12 w-auto max-w-[200px] object-contain'
                    : 'h-14 w-auto max-w-[200px] rounded-xl bg-white object-contain p-2'
                }
              />
            )}
            {name && (
              <div className={`${logo ? 'mt-4' : ''} text-2xl text-white`} style={display(f)}>
                {name}
              </div>
            )}
            {get('description') && (
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/65">
                {get('description')}
              </p>
            )}
            {socials.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-2">
                {socials.map(([label, url]) => (
                  <li key={label}>
                    <a
                      href={safeHref(url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium text-white/85 transition hover:bg-white/10"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {links.length > 0 && (
            <nav aria-label="Footer">
              <h3 className={heading} style={{ color: p.footerAccent }}>
                Quick links
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                {links.map(([label, href], i) => (
                  <li key={i}>
                    <a href={safeHref(href)} className="transition hover:text-white">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          {hasContact && (
            <div>
              <h3 className={heading} style={{ color: p.footerAccent }}>
                Contact
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                {emails.map((e) => (
                  <li key={e}>
                    <a href={safeHref(`mailto:${e}`)} className="transition hover:text-white">
                      {e}
                    </a>
                  </li>
                ))}
                {phones.map((t) => (
                  <li key={t}>
                    <a
                      href={safeHref(`tel:${t.replace(/[^+\d]/g, '')}`)}
                      className="transition hover:text-white"
                    >
                      {t}
                    </a>
                  </li>
                ))}
                {address && <li className="whitespace-pre-line text-white/65">{address}</li>}
              </ul>
            </div>
          )}
        </div>
        {(copyright || props.note) && (
          <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/55 sm:flex-row sm:justify-between">
            <span>{copyright}</span>
            {props.note && <span>{props.note}</span>}
          </div>
        )}
      </div>
    </footer>
  )
}

// ─── Registration ─────────────────────────────────────────────────────────────

const styleFields = {
  palette: { type: 'select', options: PALETTE_OPTIONS },
  font: { type: 'select', options: FONT_OPTIONS },
} as const

const columnsField = {
  type: 'radio',
  options: [
    { label: '2', value: '2' },
    { label: '3', value: '3' },
    { label: '4', value: '4' },
  ],
} as const

// Design 1 is the original look; 2-4 live in section-variants.tsx. Same content in all of them.
const designField = () =>
  ({
    type: 'select',
    options: [
      { label: 'Design 1', value: '1' },
      { label: 'Design 2', value: '2' },
      { label: 'Design 3', value: '3' },
      { label: 'Design 4', value: '4' },
    ],
  }) as const

const typedComponents: Config<LandingProps>['components'] = {
  LandingHero: {
    label: 'Landing hero',
    fields: {
      variant: {
        type: 'select',
        options: [
          { label: 'Round photo with rings', value: '1' },
          { label: 'Centered with wide photo', value: '2' },
          { label: 'Dashboard card', value: '3' },
          { label: 'Glowing photo card', value: '4' },
        ],
      },
      ...styleFields,
      eyebrow: { type: 'text' },
      headline: { type: 'textarea' },
      highlight: { type: 'text' },
      subtitle: { type: 'textarea' },
      ctaLabel: { type: 'text' },
      ctaHref: { type: 'text' },
      secondaryLabel: { type: 'text' },
      secondaryHref: { type: 'text' },
      image: imageField('Photo'),
      avatars: { type: 'textarea' },
      proofText: { type: 'text' },
      badgeValue: { type: 'text' },
      badgeLabel: { type: 'text' },
      noteTitle: { type: 'text' },
      noteText: { type: 'text' },
      chartTitle: { type: 'text' },
    },
    defaultProps: {
      variant: '1',
      palette: 'sunset',
      font: 'lobster',
      eyebrow: 'Join us today',
      headline: 'We help you grow faster, the easy way',
      highlight: 'grow faster',
      subtitle: 'One short sentence about who you help and what they get.',
      ctaLabel: 'Get started',
      ctaHref: '#contact',
      secondaryLabel: '',
      secondaryHref: '#',
      image: '',
      avatars: '',
      proofText: '',
      badgeValue: '4.9',
      badgeLabel: 'Average rating',
      noteTitle: '',
      noteText: '',
      chartTitle: 'Growth',
    },
    render: (props) => <HeroBlock {...props} />,
  },
  LandingStats: {
    label: 'Landing numbers',
    fields: { variant: designField(), ...styleFields, stats: { type: 'textarea' } },
    defaultProps: {
      variant: '1',
      palette: 'sunset',
      font: 'bricolage',
      stats:
        '2,500+|Happy customers\n98%|Would recommend us\n24h|Average reply time\n12|Years of experience',
    },
    render: (props) => <StatsBlock {...props} />,
  },
  LandingBenefits: {
    label: 'Landing benefits',
    fields: {
      variant: designField(),
      ...styleFields,
      tone: {
        type: 'radio',
        options: [
          { label: 'Light', value: 'light' },
          { label: 'Dark', value: 'dark' },
        ],
      },
      eyebrow: { type: 'text' },
      title: { type: 'text' },
      subtitle: { type: 'textarea' },
      columns: columnsField,
      items: { type: 'textarea' },
    },
    defaultProps: {
      variant: '1',
      palette: 'sunset',
      font: 'bricolage',
      tone: 'light',
      eyebrow: 'Why us',
      title: 'Everything you need',
      subtitle: 'Three reasons people choose us.',
      columns: '3',
      items:
        '⚡ | Fast | Describe the first benefit.\n✅ | Simple | Describe the second benefit.\n🔒 | Trusted | Describe the third benefit.',
    },
    render: (props) => <BenefitsBlock {...props} />,
  },
  LandingShowcase: {
    label: 'Landing picture and points',
    fields: {
      variant: designField(),
      ...styleFields,
      eyebrow: { type: 'text' },
      title: { type: 'text' },
      text: { type: 'textarea' },
      bullets: { type: 'textarea' },
      image: imageField('Photo'),
      reverse: {
        type: 'radio',
        options: [
          { label: 'Picture on the right', value: false },
          { label: 'Picture on the left', value: true },
        ],
      },
      ctaLabel: { type: 'text' },
      ctaHref: { type: 'text' },
    },
    defaultProps: {
      variant: '1',
      palette: 'sunset',
      font: 'bricolage',
      eyebrow: 'How we work',
      title: 'Made simple, from the first call',
      text: 'A short paragraph that explains your approach.',
      bullets:
        'A clear plan before we start\nHonest updates every week\nSupport whenever you need it',
      image: '',
      reverse: false,
      ctaLabel: '',
      ctaHref: '#contact',
    },
    render: (props) => <ShowcaseBlock {...props} />,
  },
  LandingSteps: {
    label: 'Landing steps or agenda',
    fields: {
      variant: designField(),
      ...styleFields,
      layout: {
        type: 'radio',
        options: [
          { label: 'Step cards', value: 'cards' },
          { label: 'Agenda list', value: 'list' },
        ],
      },
      eyebrow: { type: 'text' },
      title: { type: 'text' },
      subtitle: { type: 'textarea' },
      items: { type: 'textarea' },
    },
    defaultProps: {
      variant: '1',
      palette: 'sunset',
      font: 'bricolage',
      layout: 'cards',
      eyebrow: 'Simple process',
      title: 'How it works',
      subtitle: 'Three easy steps.',
      items:
        '📝 | Tell us | Share what you need.\n📞 | We reply | A real person gets back to you.\n🎉 | Done | Enjoy the result.',
    },
    render: (props) => <StepsBlock {...props} />,
  },
  LandingPeople: {
    label: 'Landing people',
    fields: {
      variant: designField(),
      ...styleFields,
      eyebrow: { type: 'text' },
      title: { type: 'text' },
      subtitle: { type: 'textarea' },
      columns: columnsField,
      items: { type: 'textarea' },
    },
    defaultProps: {
      variant: '1',
      palette: 'sunset',
      font: 'bricolage',
      eyebrow: 'The team',
      title: 'Meet the people',
      subtitle: '',
      columns: '3',
      items: 'Name|Role|A short line about them.|',
    },
    render: (props) => <PeopleBlock {...props} />,
  },
  LandingTestimonials: {
    label: 'Landing quotes',
    fields: {
      variant: designField(),
      ...styleFields,
      eyebrow: { type: 'text' },
      title: { type: 'text' },
      items: { type: 'textarea' },
    },
    defaultProps: {
      variant: '1',
      palette: 'sunset',
      font: 'bricolage',
      eyebrow: 'Loved by customers',
      title: 'What people say',
      items: 'A short, specific quote from a happy customer.|Name|Role|',
    },
    render: (props) => <TestimonialsBlock {...props} />,
  },
  LandingFaq: {
    label: 'Landing questions',
    fields: {
      variant: designField(),
      ...styleFields,
      eyebrow: { type: 'text' },
      title: { type: 'text' },
      items: { type: 'textarea' },
    },
    defaultProps: {
      variant: '1',
      palette: 'sunset',
      font: 'bricolage',
      eyebrow: 'Good to know',
      title: 'Questions, answered',
      items: 'A common question?|A clear, short answer.',
    },
    render: (props) => <FaqBlock {...props} />,
  },
  LandingCta: {
    label: 'Landing call to action',
    fields: {
      variant: designField(),
      ...styleFields,
      title: { type: 'text' },
      text: { type: 'textarea' },
      buttonLabel: { type: 'text' },
      buttonHref: { type: 'text' },
      image: imageField('Photo (optional)'),
    },
    defaultProps: {
      variant: '1',
      palette: 'sunset',
      font: 'bricolage',
      title: 'Ready to get started?',
      text: 'Tell us what you need and we will take it from there.',
      buttonLabel: 'Get in touch',
      buttonHref: '#contact',
      image: '',
    },
    render: (props) => <CtaBlock {...props} />,
  },
  LandingPricing: {
    label: 'Landing pricing',
    fields: {
      variant: designField(),
      ...styleFields,
      eyebrow: { type: 'text' },
      title: { type: 'text' },
      subtitle: { type: 'textarea' },
      items: { type: 'textarea' },
    },
    defaultProps: {
      variant: '1',
      palette: 'violet',
      font: 'bricolage',
      eyebrow: 'Pricing',
      title: 'Simple, honest pricing',
      subtitle:
        'One line per plan: Name | Price | Period | Feature; Feature | Button | Link | popular',
      items:
        'Starter|₹0|per month|3 projects; Email support|Get started|#contact\nPro|₹999|per month|Unlimited projects; Priority support; Reports|Start free trial|#contact|popular\nBusiness|Custom|per year|Single sign-on; Audit logs; Dedicated manager|Talk to us|#contact',
    },
    render: (props) => <PricingDesign {...props} variant={props.variant ?? '1'} />,
  },
  LandingPortfolio: {
    label: 'Landing portfolio',
    fields: {
      variant: designField(),
      ...styleFields,
      eyebrow: { type: 'text' },
      title: { type: 'text' },
      subtitle: { type: 'textarea' },
      items: { type: 'textarea' },
    },
    defaultProps: {
      variant: '1',
      palette: 'blaze',
      font: 'playfair',
      eyebrow: 'Portfolio',
      title: 'Selected projects',
      subtitle: '',
      items:
        'Project one|Branding|/landing-templates/photos/team-work.jpg|#\nProject two|Website|/landing-templates/photos/hero-laptop.jpg|#\nProject three|App design|/landing-templates/photos/launch-glow.jpg|#',
    },
    render: (props) => <PortfolioDesign {...props} variant={props.variant ?? '1'} />,
  },
  LandingGallery: {
    label: 'Landing gallery',
    fields: {
      variant: designField(),
      ...styleFields,
      eyebrow: { type: 'text' },
      title: { type: 'text' },
      subtitle: { type: 'textarea' },
      items: { type: 'textarea' },
    },
    defaultProps: {
      variant: '1',
      palette: 'ocean',
      font: 'fraunces',
      eyebrow: 'Gallery',
      title: 'Moments from our work',
      subtitle: '',
      items:
        '/landing-templates/photos/community.jpg|Community day\n/landing-templates/photos/high-five.jpg|Team win\n/landing-templates/photos/event-workshop.jpg|Workshop\n/landing-templates/photos/event-speaker.jpg|Keynote',
    },
    render: (props) => <GalleryDesign {...props} variant={props.variant ?? '1'} />,
  },
  LandingClients: {
    label: 'Landing clients',
    fields: {
      variant: designField(),
      ...styleFields,
      eyebrow: { type: 'text' },
      title: { type: 'text' },
      items: { type: 'textarea' },
    },
    defaultProps: {
      variant: '1',
      palette: 'ocean',
      font: 'bricolage',
      eyebrow: '',
      title: 'Trusted by teams at',
      items: 'Acme\nGlobex\nInitech\nUmbrella\nHooli',
    },
    render: (props) => <ClientsDesign {...props} variant={props.variant ?? '1'} />,
  },
  LandingContact: {
    label: 'Landing contact',
    fields: {
      variant: designField(),
      ...styleFields,
      eyebrow: { type: 'text' },
      title: { type: 'text' },
      subtitle: { type: 'textarea' },
      address: { type: 'text' },
      phone: { type: 'text' },
      email: { type: 'text' },
      hours: { type: 'text' },
      formSlug: { type: 'text' },
      anchor: { type: 'text' },
    },
    defaultProps: {
      variant: '1',
      palette: 'ocean',
      font: 'bricolage',
      eyebrow: 'Contact',
      title: 'Let us talk',
      subtitle: 'Leave your details and we will reply within a day.',
      address: '123 Main Street, Your City',
      phone: '+91 98765 43210',
      email: 'hello@example.com',
      hours: 'Mon to Fri, 9am to 6pm',
      formSlug: 'contact',
      anchor: 'contact',
    },
    render: function LandingContactRender({ puck, ...props }) {
      return (
        <ContactDesign
          {...props}
          variant={props.variant ?? '1'}
          readOnly={Boolean(puck?.isEditing)}
          preview={Boolean(puck?.metadata?.preview)}
        />
      )
    },
  },
  LandingNewsletter: {
    label: 'Landing newsletter',
    fields: {
      variant: designField(),
      ...styleFields,
      title: { type: 'text' },
      text: { type: 'textarea' },
      formSlug: { type: 'text' },
      anchor: { type: 'text' },
    },
    defaultProps: {
      variant: '1',
      palette: 'violet',
      font: 'bricolage',
      title: 'Get our newsletter',
      text: 'One short email a month. No spam.',
      formSlug: 'newsletter',
      anchor: 'newsletter',
    },
    render: function LandingNewsletterRender({ puck, ...props }) {
      return (
        <NewsletterDesign
          {...props}
          variant={props.variant ?? '1'}
          readOnly={Boolean(puck?.isEditing)}
          preview={Boolean(puck?.metadata?.preview)}
        />
      )
    },
  },
  LandingBlog: {
    label: 'Landing blog',
    fields: {
      variant: designField(),
      ...styleFields,
      eyebrow: { type: 'text' },
      title: { type: 'text' },
      subtitle: { type: 'textarea' },
      items: { type: 'textarea' },
    },
    defaultProps: {
      variant: '1',
      palette: 'ocean',
      font: 'fraunces',
      eyebrow: 'Blog',
      title: 'Latest articles',
      subtitle: '',
      items:
        'First post title|12 Nov 2026|A short excerpt that tells readers what the post is about.|/landing-templates/photos/team-desk.jpg|#\nSecond post title|5 Nov 2026|Another short excerpt for the second article.|/landing-templates/photos/community.jpg|#\nThird post title|29 Oct 2026|A third excerpt to complete the row.|/landing-templates/photos/high-five.jpg|#',
    },
    render: (props) => <BlogDesign {...props} variant={props.variant ?? '1'} />,
  },
  LandingHeader: {
    label: 'Landing header',
    fields: {
      ...styleFields,
      links: { type: 'textarea' },
      ctaLabel: { type: 'text' },
      ctaHref: { type: 'text' },
    },
    defaultProps: {
      palette: 'brand',
      font: 'bricolage',
      links: '',
      ctaLabel: 'Get a free quote',
      ctaHref: '#contact',
    },
    render: function LandingHeaderRender({ puck, ...props }) {
      return (
        <HeaderBlock
          {...props}
          metaIdentity={puck?.metadata?.identity as IdentityMap | undefined}
        />
      )
    },
  },
  LandingFooter: {
    label: 'Landing footer',
    fields: {
      variant: designField(),
      ...styleFields,
      links: { type: 'textarea' },
      note: { type: 'text' },
    },
    defaultProps: {
      variant: '1',
      palette: 'brand',
      font: 'bricolage',
      links: 'Back to top|#',
      note: '',
    },
    render: function LandingFooterRender({ puck, ...props }) {
      return (
        <FooterBlock
          {...props}
          metaIdentity={puck?.metadata?.identity as IdentityMap | undefined}
        />
      )
    },
  },
  LandingForm: {
    label: 'Landing form',
    fields: {
      ...styleFields,
      eyebrow: { type: 'text' },
      title: { type: 'text' },
      subtitle: { type: 'textarea' },
      formSlug: { type: 'text' },
      anchor: { type: 'text' },
    },
    defaultProps: {
      palette: 'sunset',
      font: 'bricolage',
      eyebrow: 'Get in touch',
      title: 'Ready to talk?',
      subtitle: 'Leave your details and we will reply within a day.',
      formSlug: 'contact',
      anchor: 'contact',
    },
    render: function LandingFormRender({ puck, ...props }) {
      return (
        <FormBlock
          {...props}
          readOnly={Boolean(puck?.isEditing)}
          preview={Boolean(puck?.metadata?.preview)}
        />
      )
    },
  },
}

// Plain-language names for the editor panel (it shows `label`, else the raw field name).
const FIELD_LABELS: Record<string, string> = {
  variant: 'Design',
  palette: 'Colours',
  font: 'Fonts',
  tone: 'Section tone',
  eyebrow: 'Small label above',
  headline: 'Headline',
  highlight: 'Highlighted words',
  subtitle: 'Text under the headline',
  ctaLabel: 'Button text',
  ctaHref: 'Button link',
  secondaryLabel: 'Second link text',
  secondaryHref: 'Second link address',
  image: 'Photo',
  avatars: 'Small round pictures (one address per line)',
  proofText: 'Proof line',
  badgeValue: 'Floating card: number',
  badgeLabel: 'Floating card: label',
  noteTitle: 'Note card: title',
  noteText: 'Note card: text',
  chartTitle: 'Chart title',
  stats: 'Numbers (number | label, one per line)',
  columns: 'Columns',
  bullets: 'Points (one per line)',
  reverse: 'Picture side',
  layout: 'Layout',
  buttonLabel: 'Button text',
  buttonHref: 'Button link',
  formSlug: 'Form (its slug in Forms)',
  anchor: 'Anchor name (for links like #contact)',
  title: 'Title',
  text: 'Text',
  links: 'Quick links (label | link, one per line)',
  note: 'Extra line at the bottom',
  address: 'Address',
  phone: 'Phone',
  email: 'Email',
  hours: 'Opening hours',
}
// `items` means something different in each block, so its label says how to write a line.
const ITEMS_LABELS: Record<string, string> = {
  LandingBenefits: 'Cards (icon | title | text, one per line)',
  LandingSteps: 'Steps (icon or time | title | text, one per line)',
  LandingPeople: 'People (name | role | about | photo address, one per line)',
  LandingTestimonials: 'Quotes (quote | name | role | photo address, one per line)',
  LandingFaq: 'Questions (question | answer, one per line)',
  LandingPricing:
    'Plans (name | price | period | feature; feature | button | link | popular, one per line)',
  LandingPortfolio: 'Projects (title | category | photo address | link, one per line)',
  LandingGallery: 'Pictures (photo address | caption, one per line)',
  LandingClients: 'Clients (name | logo address (optional), one per line)',
  LandingBlog: 'Posts (title | date | excerpt | photo address | link, one per line)',
}

function withLabels(components: NonNullable<Config['components']>) {
  const out: NonNullable<Config['components']> = {}
  for (const [key, def] of Object.entries(components)) {
    const fields = Object.fromEntries(
      Object.entries(def.fields ?? {}).map(([name, field]) => [
        name,
        {
          ...field,
          label: (name === 'items' ? ITEMS_LABELS[key] : undefined) ?? FIELD_LABELS[name] ?? name,
        },
      ])
    )
    // Every block sits in BrandScope so the "brand" colour set can read Identity's colours.
    const Inner = def.render as (props: Record<string, unknown>) => ReactNode
    const render = (props: Record<string, unknown>) => (
      <BrandScope
        metaIdentity={
          (props.puck as { metadata?: { identity?: IdentityMap } } | undefined)?.metadata?.identity
        }
      >
        <Inner {...props} />
      </BrandScope>
    )
    out[key] = { ...def, fields, render } as (typeof out)[string]
  }
  return out
}

export const landing: ComponentPack = {
  key: 'landing',
  label: 'Landing',
  components: withLabels(typedComponents as NonNullable<Config['components']>),
  categories: {
    landing: {
      title: 'Landing page',
      components: [
        'LandingHeader',
        'LandingHero',
        'LandingStats',
        'LandingBenefits',
        'LandingShowcase',
        'LandingSteps',
        'LandingPeople',
        'LandingTestimonials',
        'LandingFaq',
        'LandingCta',
        'LandingPricing',
        'LandingPortfolio',
        'LandingGallery',
        'LandingClients',
        'LandingContact',
        'LandingNewsletter',
        'LandingBlog',
        'LandingForm',
        'LandingFooter',
      ],
    },
  },
  variants: {
    LandingHero: ['1', '2', '3', '4'],
    LandingStats: ['1', '2', '3', '4'],
    LandingBenefits: ['1', '2', '3', '4'],
    LandingShowcase: ['1', '2', '3', '4'],
    LandingTestimonials: ['1', '2', '3', '4'],
    LandingFaq: ['1', '2', '3', '4'],
    LandingCta: ['1', '2', '3', '4'],
    LandingSteps: ['1', '2', '3', '4'],
    LandingPeople: ['1', '2', '3', '4'],
    LandingPricing: ['1', '2', '3', '4'],
    LandingPortfolio: ['1', '2', '3', '4'],
    LandingGallery: ['1', '2', '3', '4'],
    LandingClients: ['1', '2', '3', '4'],
    LandingContact: ['1', '2', '3', '4'],
    LandingNewsletter: ['1', '2', '3', '4'],
    LandingBlog: ['1', '2', '3', '4'],
    LandingFooter: ['1', '2', '3', '4'],
  },
}
