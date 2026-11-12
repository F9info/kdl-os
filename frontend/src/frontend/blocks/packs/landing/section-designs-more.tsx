import type { CSSProperties } from 'react'
import { safeHref } from '@/frontend/lib/safe-href'
import { ContactFormBlock } from '../general/contact-form'
import { display, look, rows, SectionHead, type Common } from './shared'
import type { Palette } from './palettes'
import type { Variant } from './section-variants'

// Sections added to the Landing pack with FOUR genuinely different designs each (layout, not just colour):
// Pricing, Portfolio, Gallery, Clients, Contact, Newsletter, Blog, plus designs 2-4 of Steps and People
// (design 1 of those two stays in index.tsx). Every design reads the same props, so switching the design
// never loses content, and every colour comes from the block's palette and font.

export type PricingProps = Common & {
  eyebrow: string
  title: string
  subtitle: string
  items: string
}
export type PortfolioProps = Common & {
  eyebrow: string
  title: string
  subtitle: string
  items: string
}
export type GalleryProps = Common & {
  eyebrow: string
  title: string
  subtitle: string
  items: string
}
export type ClientsProps = Common & { eyebrow: string; title: string; items: string }
export type ContactProps = Common & {
  eyebrow: string
  title: string
  subtitle: string
  address: string
  phone: string
  email: string
  hours: string
  formSlug: string
  anchor: string
  readOnly?: boolean
  preview?: boolean
}
export type NewsletterProps = Common & {
  title: string
  text: string
  formSlug: string
  anchor: string
  readOnly?: boolean
  preview?: boolean
}
export type BlogProps = Common & { eyebrow: string; title: string; subtitle: string; items: string }
export type StepsProps = Common & {
  layout?: 'cards' | 'list'
  eyebrow: string
  title: string
  subtitle: string
  items: string
}
export type PeopleProps = Common & {
  eyebrow: string
  title: string
  subtitle: string
  columns: '2' | '3' | '4'
  items: string
}

type Cells = [string, string, string, string, string, string, string, string]
// Pipe-separated rows padded to eight cells, so every cell is a string (never undefined).
const cells = (raw: string | undefined, min: number): Cells[] =>
  rows(raw, min).map((r) => Array.from({ length: 8 }, (_, i) => r[i] ?? '') as Cells)

const section = 'px-6 py-16 md:py-24'
const INK = '#17112b'
const MUTED = '#5b5675'
const btn = (p: Palette): CSSProperties => ({
  ...(p.button.startsWith('linear') ? { backgroundImage: p.button } : { background: p.button }),
  color: p.buttonText,
})

/* eslint-disable @next/next/no-img-element */

const Pic = ({ src, alt, className }: { src?: string; alt: string; className: string }) =>
  src ? (
    <img src={src} alt={alt} className={className} loading="lazy" />
  ) : (
    <div className={`${className} bg-slate-200`} aria-hidden />
  )

// ── Pricing ──────────────────────────────────────────────────────────────────
// Row: Plan | Price | Period | Feature one; Feature two | Button label | Button link | popular (optional)

const plan = (r: Cells) => ({
  name: r[0],
  price: r[1],
  period: r[2] ?? '',
  features: (r[3] ?? '')
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean),
  cta: r[4] || 'Get started',
  href: r[5] || '#contact',
  popular: /^(popular|yes|true|1)$/i.test(r[6] ?? ''),
})

export function PricingDesign({ variant, ...props }: PricingProps & { variant: Variant }) {
  const { p, f } = look(props)
  const plans = cells(props.items, 2).map(plan)
  const head = (
    <SectionHead
      eyebrow={props.eyebrow}
      title={props.title}
      subtitle={props.subtitle}
      p={p}
      f={f}
    />
  )

  if (variant === '2')
    // Compact comparison rows: one plan per line.
    return (
      <section className={section} style={{ fontFamily: f.body, background: p.soft }}>
        <div className="mx-auto max-w-4xl">
          {head}
          <div className="space-y-4">
            {plans.map((x, i) => (
              <div
                key={i}
                className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5 md:flex-row md:items-center"
                style={x.popular ? { outline: `2px solid ${p.strong}` } : undefined}
              >
                <div className="md:w-1/4">
                  <h3 className="text-lg font-semibold" style={{ color: INK }}>
                    {x.name}
                  </h3>
                  {x.popular && (
                    <span className="text-xs font-bold uppercase" style={{ color: p.strong }}>
                      Most popular
                    </span>
                  )}
                </div>
                <ul className="flex-1 space-y-1 text-sm" style={{ color: MUTED }}>
                  {x.features.map((t) => (
                    <li key={t}>✓ {t}</li>
                  ))}
                </ul>
                <div className="text-right md:w-1/4">
                  <div className="text-2xl" style={{ ...display(f), color: p.strong }}>
                    {x.price}
                  </div>
                  <div className="text-xs" style={{ color: MUTED }}>
                    {x.period}
                  </div>
                  <a
                    href={safeHref(x.href)}
                    className="mt-3 inline-block rounded-full px-5 py-2 text-sm font-semibold"
                    style={btn(p)}
                  >
                    {x.cta}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )

  if (variant === '3')
    // Dark band, highlighted middle plan.
    return (
      <section className={section} style={{ fontFamily: f.body, background: p.band }}>
        <div className="mx-auto max-w-6xl">
          <SectionHead
            eyebrow={props.eyebrow}
            title={props.title}
            subtitle={props.subtitle}
            p={p}
            f={f}
            light
          />
          <div className="grid items-center gap-6 md:grid-cols-3">
            {plans.map((x, i) => (
              <div
                key={i}
                className={`rounded-3xl p-8 ${x.popular ? 'bg-white shadow-2xl md:scale-105' : 'bg-white/10 text-white ring-1 ring-white/20'}`}
              >
                <h3
                  className="text-lg font-semibold"
                  style={x.popular ? { color: INK } : undefined}
                >
                  {x.name}
                </h3>
                <div
                  className="mt-3 text-4xl"
                  style={{ ...display(f), color: x.popular ? p.strong : '#fff' }}
                >
                  {x.price}
                </div>
                <div className="text-sm opacity-70">{x.period}</div>
                <ul
                  className="my-6 space-y-2 text-sm"
                  style={x.popular ? { color: MUTED } : undefined}
                >
                  {x.features.map((t) => (
                    <li key={t}>✓ {t}</li>
                  ))}
                </ul>
                <a
                  href={safeHref(x.href)}
                  className="block rounded-full px-5 py-3 text-center text-sm font-semibold"
                  style={x.popular ? btn(p) : { background: '#fff', color: INK }}
                >
                  {x.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>
    )

  if (variant === '4')
    // Minimal outlined columns, price on top, no shadows.
    return (
      <section className={section} style={{ fontFamily: f.body, background: '#fff' }}>
        <div className="mx-auto max-w-6xl">
          {head}
          <div className="grid gap-0 divide-y divide-slate-200 overflow-hidden rounded-3xl border border-slate-200 md:grid-cols-3 md:divide-x md:divide-y-0">
            {plans.map((x, i) => (
              <div key={i} className="p-8" style={x.popular ? { background: p.soft } : undefined}>
                <div className="text-5xl" style={{ ...display(f), color: p.strong }}>
                  {x.price}
                </div>
                <div className="mb-4 text-sm" style={{ color: MUTED }}>
                  {x.period}
                </div>
                <h3 className="text-lg font-semibold" style={{ color: INK }}>
                  {x.name}
                </h3>
                <ul className="my-5 space-y-2 text-sm" style={{ color: MUTED }}>
                  {x.features.map((t) => (
                    <li key={t}>— {t}</li>
                  ))}
                </ul>
                <a
                  href={safeHref(x.href)}
                  className="text-sm font-semibold underline"
                  style={{ color: p.strong }}
                >
                  {x.cta} →
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>
    )

  // Design 1: three cards, popular one raised.
  return (
    <section className={section} style={{ fontFamily: f.body, background: '#fff' }}>
      <div className="mx-auto max-w-6xl">
        {head}
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((x, i) => (
            <div
              key={i}
              className="relative rounded-3xl p-8 shadow-lg ring-1 ring-black/5"
              style={{
                background: x.popular ? p.soft : '#fff',
                transform: x.popular ? 'translateY(-8px)' : undefined,
              }}
            >
              {x.popular && (
                <span
                  className="absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-bold"
                  style={btn(p)}
                >
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-semibold" style={{ color: INK }}>
                {x.name}
              </h3>
              <div className="mt-2 text-4xl" style={{ ...display(f), color: p.strong }}>
                {x.price}
              </div>
              <div className="text-sm" style={{ color: MUTED }}>
                {x.period}
              </div>
              <ul className="my-6 space-y-2 text-sm" style={{ color: MUTED }}>
                {x.features.map((t) => (
                  <li key={t}>✓ {t}</li>
                ))}
              </ul>
              <a
                href={safeHref(x.href)}
                className="block rounded-full px-5 py-3 text-center text-sm font-semibold"
                style={btn(p)}
              >
                {x.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Portfolio / Projects ─────────────────────────────────────────────────────
// Row: Title | Category | Image | Link (optional)

export function PortfolioDesign({ variant, ...props }: PortfolioProps & { variant: Variant }) {
  const { p, f } = look(props)
  const items = cells(props.items, 2)
  const head = (
    <SectionHead
      eyebrow={props.eyebrow}
      title={props.title}
      subtitle={props.subtitle}
      p={p}
      f={f}
    />
  )

  if (variant === '2')
    // Masonry-style: first card tall.
    return (
      <section className={section} style={{ fontFamily: f.body, background: p.soft }}>
        <div className="mx-auto max-w-6xl">
          {head}
          <div className="grid auto-rows-[220px] gap-4 md:grid-cols-3">
            {items.map(([title, cat, img, href], i) => (
              <a
                key={i}
                href={safeHref(href || '#')}
                className={`group relative overflow-hidden rounded-3xl ${i === 0 ? 'md:row-span-2' : ''}`}
              >
                <Pic
                  src={img}
                  alt={title}
                  className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-4 left-5 text-white">
                  <div className="text-xs uppercase tracking-wider opacity-80">{cat}</div>
                  <div className="text-lg font-semibold">{title}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>
    )

  if (variant === '3')
    // Alternating rows: big image + text.
    return (
      <section className={section} style={{ fontFamily: f.body, background: '#fff' }}>
        <div className="mx-auto max-w-5xl">
          {head}
          <div className="space-y-14">
            {items.map(([title, cat, img, href], i) => (
              <div
                key={i}
                className={`flex flex-col items-center gap-8 md:flex-row ${i % 2 ? 'md:flex-row-reverse' : ''}`}
              >
                <Pic
                  src={img}
                  alt={title}
                  className="aspect-[4/3] w-full rounded-3xl object-cover shadow-lg md:w-3/5"
                />
                <div className="md:w-2/5">
                  <div
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: p.strong }}
                  >
                    {cat}
                  </div>
                  <h3 className="mt-2 text-2xl" style={{ ...display(f), color: INK }}>
                    {title}
                  </h3>
                  <a
                    href={safeHref(href || '#')}
                    className="mt-4 inline-block text-sm font-semibold underline"
                    style={{ color: p.strong }}
                  >
                    View project →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )

  if (variant === '4')
    // Text-first list with small thumbnail.
    return (
      <section className={section} style={{ fontFamily: f.body, background: '#fff' }}>
        <div className="mx-auto max-w-4xl">
          {head}
          <ul className="divide-y divide-slate-200 border-y border-slate-200">
            {items.map(([title, cat, img, href], i) => (
              <li key={i}>
                <a
                  href={safeHref(href || '#')}
                  className="flex items-center gap-5 py-5 transition hover:bg-slate-50"
                >
                  <span className="w-8 text-sm" style={{ color: MUTED }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <Pic src={img} alt={title} className="h-16 w-24 rounded-xl object-cover" />
                  <span className="flex-1 text-lg font-semibold" style={{ color: INK }}>
                    {title}
                  </span>
                  <span className="hidden text-sm sm:block" style={{ color: MUTED }}>
                    {cat}
                  </span>
                  <span style={{ color: p.strong }}>→</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    )

  // Design 1: three-column image cards.
  return (
    <section className={section} style={{ fontFamily: f.body, background: '#fff' }}>
      <div className="mx-auto max-w-6xl">
        {head}
        <div className="grid gap-6 md:grid-cols-3">
          {items.map(([title, cat, img, href], i) => (
            <a
              key={i}
              href={safeHref(href || '#')}
              className="group overflow-hidden rounded-3xl shadow-md ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-xl"
            >
              <Pic src={img} alt={title} className="aspect-[4/3] w-full object-cover" />
              <div className="p-5">
                <div
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: p.strong }}
                >
                  {cat}
                </div>
                <h3 className="mt-1 text-lg font-semibold" style={{ color: INK }}>
                  {title}
                </h3>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Gallery ──────────────────────────────────────────────────────────────────
// Row: Image | Caption (optional)

export function GalleryDesign({ variant, ...props }: GalleryProps & { variant: Variant }) {
  const { p, f } = look(props)
  const items = cells(props.items, 1)
  const head = (
    <SectionHead
      eyebrow={props.eyebrow}
      title={props.title}
      subtitle={props.subtitle}
      p={p}
      f={f}
    />
  )

  if (variant === '2')
    // Masonry columns.
    return (
      <section className={section} style={{ fontFamily: f.body, background: p.soft }}>
        <div className="mx-auto max-w-6xl">
          {head}
          <div className="columns-2 gap-4 md:columns-3 [&>figure]:mb-4">
            {items.map(([img, cap], i) => (
              <figure key={i} className="break-inside-avoid overflow-hidden rounded-2xl">
                <Pic
                  src={img}
                  alt={cap || ''}
                  className={`w-full object-cover ${i % 3 === 0 ? 'aspect-[3/4]' : 'aspect-square'}`}
                />
              </figure>
            ))}
          </div>
        </div>
      </section>
    )

  if (variant === '3')
    // One large feature + strip of thumbnails.
    return (
      <section className={section} style={{ fontFamily: f.body, background: '#fff' }}>
        <div className="mx-auto max-w-5xl">
          {head}
          {items[0] && (
            <figure>
              <Pic
                src={items[0][0]}
                alt={items[0][1] || ''}
                className="aspect-[16/9] w-full rounded-3xl object-cover shadow-lg"
              />
              {items[0][1] && (
                <figcaption className="mt-3 text-center text-sm" style={{ color: MUTED }}>
                  {items[0][1]}
                </figcaption>
              )}
            </figure>
          )}
          <div className="mt-4 grid grid-cols-3 gap-4 md:grid-cols-5">
            {items.slice(1).map(([img, cap], i) => (
              <Pic
                key={i}
                src={img}
                alt={cap || ''}
                className="aspect-square w-full rounded-2xl object-cover"
              />
            ))}
          </div>
        </div>
      </section>
    )

  if (variant === '4')
    // Captioned cards in a 2-up grid.
    return (
      <section className={section} style={{ fontFamily: f.body, background: '#fff' }}>
        <div className="mx-auto max-w-5xl">
          {head}
          <div className="grid gap-6 sm:grid-cols-2">
            {items.map(([img, cap], i) => (
              <figure
                key={i}
                className="overflow-hidden rounded-3xl bg-white shadow-md ring-1 ring-black/5"
              >
                <Pic src={img} alt={cap || ''} className="aspect-[16/10] w-full object-cover" />
                {cap && (
                  <figcaption className="p-4 text-sm font-medium" style={{ color: INK }}>
                    {cap}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </div>
      </section>
    )

  // Design 1: even square grid.
  return (
    <section className={section} style={{ fontFamily: f.body, background: '#fff' }}>
      <div className="mx-auto max-w-6xl">
        {head}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {items.map(([img, cap], i) => (
            <Pic
              key={i}
              src={img}
              alt={cap || ''}
              className="aspect-square w-full rounded-2xl object-cover transition hover:scale-[1.02]"
            />
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Clients / Partners ───────────────────────────────────────────────────────
// Row: Name | Logo image (optional)

export function ClientsDesign({ variant, ...props }: ClientsProps & { variant: Variant }) {
  const { p, f } = look(props)
  const items = cells(props.items, 1)
  const logo = (name: string, src: string | undefined, cls: string) =>
    src ? (
      <img src={src} alt={name} className={cls} loading="lazy" />
    ) : (
      <span className="text-lg font-semibold" style={{ ...display(f), color: MUTED }}>
        {name}
      </span>
    )

  if (variant === '2')
    // Dark band, white text.
    return (
      <section className="px-6 py-14" style={{ fontFamily: f.body, background: p.band }}>
        <div className="mx-auto max-w-6xl text-center text-white">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] opacity-80">
            {props.title}
          </h2>
          <div className="mt-8 grid grid-cols-2 items-center gap-8 md:grid-cols-5">
            {items.map(([n, s], i) => (
              <div
                key={i}
                className="opacity-90 [&_*]:!text-white [&_img]:brightness-0 [&_img]:invert"
              >
                {logo(n, s, 'mx-auto h-9 w-auto object-contain')}
              </div>
            ))}
          </div>
        </div>
      </section>
    )

  if (variant === '3')
    // Boxed logo tiles.
    return (
      <section className={section} style={{ fontFamily: f.body, background: p.soft }}>
        <div className="mx-auto max-w-5xl">
          <SectionHead eyebrow={props.eyebrow} title={props.title} p={p} f={f} />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {items.map(([n, s], i) => (
              <div
                key={i}
                className="grid h-24 place-items-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5"
              >
                {logo(n, s, 'h-10 w-auto max-w-[70%] object-contain')}
              </div>
            ))}
          </div>
        </div>
      </section>
    )

  if (variant === '4')
    // Infinite-style marquee strip (static, wraps on small screens).
    return (
      <section
        className="overflow-hidden border-y border-slate-200 bg-white py-8"
        style={{ fontFamily: f.body }}
      >
        <p
          className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.18em]"
          style={{ color: MUTED }}
        >
          {props.title}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-14 gap-y-4 px-6">
          {items.map(([n, s], i) => (
            <span key={i} className="grayscale transition hover:grayscale-0">
              {logo(n, s, 'h-8 w-auto object-contain')}
            </span>
          ))}
        </div>
      </section>
    )

  // Design 1: simple centered row.
  return (
    <section className="bg-white px-6 py-14" style={{ fontFamily: f.body }}>
      <div className="mx-auto max-w-6xl text-center">
        <h2
          className="text-sm font-semibold uppercase tracking-[0.18em]"
          style={{ color: p.strong }}
        >
          {props.title}
        </h2>
        <div className="mt-8 grid grid-cols-2 items-center gap-8 md:grid-cols-5">
          {items.map(([n, s], i) => (
            <div key={i}>{logo(n, s, 'mx-auto h-10 w-auto object-contain')}</div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Contact ──────────────────────────────────────────────────────────────────

function ContactForm(props: ContactProps) {
  if (props.preview)
    return (
      <div className="space-y-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        {['Name *', 'Email *', 'Message'].map((l) => (
          <div key={l}>
            <div className="mb-1 text-sm font-medium">{l}</div>
            <div
              className={`w-full rounded-md border border-slate-200 ${l === 'Message' ? 'h-24' : 'h-10'}`}
            />
          </div>
        ))}
        <div className="inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          Send
        </div>
      </div>
    )
  return (
    <ContactFormBlock
      formSlug={props.formSlug}
      anchor={props.anchor}
      title=""
      readOnly={Boolean(props.readOnly)}
    />
  )
}

export function ContactDesign({ variant, ...props }: ContactProps & { variant: Variant }) {
  const { p, f } = look(props)
  const details = [
    ['📍', 'Visit us', props.address],
    ['📞', 'Call us', props.phone],
    ['✉️', 'Email us', props.email],
    ['🕒', 'Hours', props.hours],
  ].filter((d) => d[2])
  const info = (
    <ul className="space-y-5">
      {details.map(([i, l, v]) => (
        <li key={l} className="flex gap-4">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg"
            style={{ background: p.soft }}
          >
            {i}
          </span>
          <div>
            <div
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: p.strong }}
            >
              {l}
            </div>
            <div className="text-sm" style={{ color: INK }}>
              {v}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
  const form = (
    <div id={props.anchor || undefined}>
      <ContactForm {...props} />
    </div>
  )
  const head = (
    <SectionHead
      eyebrow={props.eyebrow}
      title={props.title}
      subtitle={props.subtitle}
      p={p}
      f={f}
    />
  )

  if (variant === '2')
    // Form on the left, details on the right.
    return (
      <section className={section} style={{ fontFamily: f.body, background: p.soft }}>
        <div className="mx-auto grid max-w-6xl items-start gap-10 md:grid-cols-2">
          {form}
          <div>
            {head}
            {info}
          </div>
        </div>
      </section>
    )

  if (variant === '3')
    // Details as four cards above a centred form.
    return (
      <section className={section} style={{ fontFamily: f.body, background: '#fff' }}>
        <div className="mx-auto max-w-5xl">
          {head}
          <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {details.map(([i, l, v]) => (
              <div key={l} className="rounded-2xl p-5 text-center" style={{ background: p.soft }}>
                <div className="text-2xl">{i}</div>
                <div
                  className="mt-2 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: p.strong }}
                >
                  {l}
                </div>
                <div className="mt-1 text-sm" style={{ color: INK }}>
                  {v}
                </div>
              </div>
            ))}
          </div>
          <div className="mx-auto max-w-xl">{form}</div>
        </div>
      </section>
    )

  if (variant === '4')
    // Coloured panel with details, form beside it.
    return (
      <section className={section} style={{ fontFamily: f.body, background: '#fff' }}>
        <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl shadow-xl md:grid-cols-5">
          <div className="p-8 text-white md:col-span-2" style={{ background: p.band }}>
            <h2 className="text-3xl" style={display(f)}>
              {props.title}
            </h2>
            <p className="mb-8 mt-2 text-sm opacity-80">{props.subtitle}</p>
            <ul className="space-y-4 text-sm">
              {details.map(([i, l, v]) => (
                <li key={l}>
                  {i} {v}
                </li>
              ))}
            </ul>
          </div>
          <div className="p-8 md:col-span-3">{form}</div>
        </div>
      </section>
    )

  // Design 1: details left, form right.
  return (
    <section className={section} style={{ fontFamily: f.body, background: '#fff' }}>
      <div className="mx-auto grid max-w-6xl items-start gap-10 md:grid-cols-2">
        <div>
          {head}
          {info}
        </div>
        {form}
      </div>
    </section>
  )
}

// ── Newsletter ───────────────────────────────────────────────────────────────

export function NewsletterDesign({ variant, ...props }: NewsletterProps & { variant: Variant }) {
  const { p, f } = look(props)
  const form = props.preview ? (
    <div className="flex gap-2">
      <div className="h-11 flex-1 rounded-full border border-slate-200 bg-white" />
      <div className="rounded-full px-5 py-3 text-sm font-semibold" style={btn(p)}>
        Subscribe
      </div>
    </div>
  ) : (
    <div id={props.anchor || undefined}>
      <ContactFormBlock
        formSlug={props.formSlug}
        anchor={props.anchor}
        title=""
        readOnly={Boolean(props.readOnly)}
      />
    </div>
  )

  if (variant === '2')
    // Dark band, centred.
    return (
      <section className="px-6 py-16" style={{ fontFamily: f.body, background: p.band }}>
        <div className="mx-auto max-w-xl text-center text-white">
          <h2 className="text-3xl md:text-4xl" style={display(f)}>
            {props.title}
          </h2>
          <p className="mb-6 mt-3 opacity-80">{props.text}</p>
          <div className="rounded-2xl bg-white p-4 text-left text-slate-900">{form}</div>
        </div>
      </section>
    )

  if (variant === '3')
    // Split: text left, form right in a card.
    return (
      <section className={section} style={{ fontFamily: f.body, background: p.soft }}>
        <div className="mx-auto grid max-w-5xl items-center gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-3xl md:text-4xl" style={{ ...display(f), color: INK }}>
              {props.title}
            </h2>
            <p className="mt-3" style={{ color: MUTED }}>
              {props.text}
            </p>
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-lg">{form}</div>
        </div>
      </section>
    )

  if (variant === '4')
    // Slim strip.
    return (
      <section
        className="border-y border-slate-200 bg-white px-6 py-8"
        style={{ fontFamily: f.body }}
      >
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 md:flex-row md:justify-between">
          <div>
            <div className="text-lg font-semibold" style={{ color: INK }}>
              {props.title}
            </div>
            <div className="text-sm" style={{ color: MUTED }}>
              {props.text}
            </div>
          </div>
          <div className="w-full md:w-1/2">{form}</div>
        </div>
      </section>
    )

  // Design 1: card centred on soft background.
  return (
    <section className={section} style={{ fontFamily: f.body, background: '#fff' }}>
      <div
        className="mx-auto max-w-2xl rounded-3xl p-10 text-center shadow-lg ring-1 ring-black/5"
        style={{ background: p.soft }}
      >
        <h2 className="text-3xl md:text-4xl" style={{ ...display(f), color: INK }}>
          {props.title}
        </h2>
        <p className="mb-6 mt-3" style={{ color: MUTED }}>
          {props.text}
        </p>
        <div className="text-left">{form}</div>
      </div>
    </section>
  )
}

// ── Blog ─────────────────────────────────────────────────────────────────────
// Row: Title | Date | Excerpt | Image | Link (optional)

export function BlogDesign({ variant, ...props }: BlogProps & { variant: Variant }) {
  const { p, f } = look(props)
  const items = cells(props.items, 2)
  const head = (
    <SectionHead
      eyebrow={props.eyebrow}
      title={props.title}
      subtitle={props.subtitle}
      p={p}
      f={f}
    />
  )

  if (variant === '2')
    // Featured first post, others stacked.
    return (
      <section className={section} style={{ fontFamily: f.body, background: p.soft }}>
        <div className="mx-auto max-w-6xl">
          {head}
          <div className="grid gap-6 md:grid-cols-5">
            {items[0] && (
              <a
                href={safeHref(items[0][4] || '#')}
                className="overflow-hidden rounded-3xl bg-white shadow-md md:col-span-3"
              >
                <Pic
                  src={items[0][3]}
                  alt={items[0][0]}
                  className="aspect-[16/10] w-full object-cover"
                />
                <div className="p-6">
                  <div className="text-xs" style={{ color: p.strong }}>
                    {items[0][1]}
                  </div>
                  <h3 className="mt-1 text-2xl" style={{ ...display(f), color: INK }}>
                    {items[0][0]}
                  </h3>
                  <p className="mt-2 text-sm" style={{ color: MUTED }}>
                    {items[0][2]}
                  </p>
                </div>
              </a>
            )}
            <div className="space-y-4 md:col-span-2">
              {items.slice(1).map(([t, d, e, img, href], i) => (
                <a
                  key={i}
                  href={safeHref(href || '#')}
                  className="flex gap-4 rounded-2xl bg-white p-3 shadow-sm"
                >
                  <Pic src={img} alt={t} className="h-24 w-28 shrink-0 rounded-xl object-cover" />
                  <div>
                    <div className="text-xs" style={{ color: p.strong }}>
                      {d}
                    </div>
                    <h3 className="font-semibold" style={{ color: INK }}>
                      {t}
                    </h3>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>
    )

  if (variant === '3')
    // Text-only list with dates.
    return (
      <section className={section} style={{ fontFamily: f.body, background: '#fff' }}>
        <div className="mx-auto max-w-3xl">
          {head}
          <ul className="divide-y divide-slate-200">
            {items.map(([t, d, e, , href], i) => (
              <li key={i} className="py-6">
                <a href={safeHref(href || '#')}>
                  <div
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: p.strong }}
                  >
                    {d}
                  </div>
                  <h3 className="mt-1 text-xl" style={{ ...display(f), color: INK }}>
                    {t}
                  </h3>
                  <p className="mt-1 text-sm" style={{ color: MUTED }}>
                    {e}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    )

  if (variant === '4')
    // Image-overlay tiles.
    return (
      <section className={section} style={{ fontFamily: f.body, background: '#fff' }}>
        <div className="mx-auto max-w-6xl">
          {head}
          <div className="grid gap-4 md:grid-cols-3">
            {items.map(([t, d, , img, href], i) => (
              <a
                key={i}
                href={safeHref(href || '#')}
                className="group relative block aspect-[4/5] overflow-hidden rounded-3xl"
              >
                <Pic
                  src={img}
                  alt={t}
                  className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 text-white">
                  <div className="text-xs opacity-80">{d}</div>
                  <h3 className="text-lg font-semibold">{t}</h3>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>
    )

  // Design 1: three cards.
  return (
    <section className={section} style={{ fontFamily: f.body, background: '#fff' }}>
      <div className="mx-auto max-w-6xl">
        {head}
        <div className="grid gap-6 md:grid-cols-3">
          {items.map(([t, d, e, img, href], i) => (
            <a
              key={i}
              href={safeHref(href || '#')}
              className="overflow-hidden rounded-3xl shadow-md ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-xl"
            >
              <Pic src={img} alt={t} className="aspect-[16/10] w-full object-cover" />
              <div className="p-5">
                <div className="text-xs" style={{ color: p.strong }}>
                  {d}
                </div>
                <h3 className="mt-1 font-semibold" style={{ color: INK }}>
                  {t}
                </h3>
                <p className="mt-2 text-sm" style={{ color: MUTED }}>
                  {e}
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Process / How it works: designs 2-4 (design 1 = cards or list in index.tsx) ─

export function StepsDesign({ variant, ...props }: StepsProps & { variant: Variant }) {
  const { p, f } = look(props)
  const items = cells(props.items, 3)
  const head = (
    <SectionHead
      eyebrow={props.eyebrow}
      title={props.title}
      subtitle={props.subtitle}
      p={p}
      f={f}
    />
  )

  if (variant === '2')
    // Horizontal timeline with connecting line.
    return (
      <section className={section} style={{ fontFamily: f.body, background: '#fff' }}>
        <div className="mx-auto max-w-6xl">
          {head}
          <ol className="relative grid gap-8 md:grid-cols-[repeat(auto-fit,minmax(0,1fr))]">
            <span
              className="absolute left-0 right-0 top-6 hidden h-0.5 md:block"
              style={{ background: p.soft }}
              aria-hidden
            />
            {items.map(([icon, title, text], i) => (
              <li key={i} className="relative text-center">
                <span
                  className="relative mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full text-lg font-bold text-white"
                  style={{ background: p.strong }}
                >
                  {i + 1}
                </span>
                <div className="text-2xl">{icon}</div>
                <h3 className="mt-1 font-semibold" style={{ color: INK }}>
                  {title}
                </h3>
                <p className="mt-1 text-sm" style={{ color: MUTED }}>
                  {text}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    )

  if (variant === '3')
    // Vertical timeline.
    return (
      <section className={section} style={{ fontFamily: f.body, background: p.soft }}>
        <div className="mx-auto max-w-2xl">
          {head}
          <ol className="relative space-y-8 border-l-2 pl-8" style={{ borderColor: p.strong }}>
            {items.map(([icon, title, text], i) => (
              <li key={i} className="relative">
                <span
                  className="absolute -left-[3.05rem] grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-white"
                  style={{ background: p.strong }}
                >
                  {i + 1}
                </span>
                <h3 className="text-lg font-semibold" style={{ color: INK }}>
                  {icon} {title}
                </h3>
                <p className="mt-1 text-sm" style={{ color: MUTED }}>
                  {text}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    )

  // Design 4: big numbers on a dark band.
  return (
    <section className={section} style={{ fontFamily: f.body, background: p.band }}>
      <div className="mx-auto max-w-6xl">
        <SectionHead
          eyebrow={props.eyebrow}
          title={props.title}
          subtitle={props.subtitle}
          p={p}
          f={f}
          light
        />
        <ol className="grid gap-8 text-white md:grid-cols-3">
          {items.map(([icon, title, text], i) => (
            <li key={i}>
              <div className="text-7xl opacity-30" style={display(f)}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <h3 className="-mt-2 text-xl font-semibold">
                {icon} {title}
              </h3>
              <p className="mt-2 text-sm opacity-80">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

// ── Team / People: designs 2-4 ───────────────────────────────────────────────

export function PeopleDesign({ variant, ...props }: PeopleProps & { variant: Variant }) {
  const { p, f } = look(props)
  const items = cells(props.items, 2)
  const head = (
    <SectionHead
      eyebrow={props.eyebrow}
      title={props.title}
      subtitle={props.subtitle}
      p={p}
      f={f}
    />
  )

  if (variant === '2')
    // Round portraits, text centred.
    return (
      <section className={section} style={{ fontFamily: f.body, background: '#fff' }}>
        <div className="mx-auto max-w-6xl">
          {head}
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {items.map(([n, r, b, img], i) => (
              <div key={i} className="text-center">
                <Pic
                  src={img}
                  alt={n}
                  className="mx-auto h-36 w-36 rounded-full object-cover ring-4"
                />
                <h3 className="mt-4 font-semibold" style={{ color: INK }}>
                  {n}
                </h3>
                <div className="text-sm font-medium" style={{ color: p.strong }}>
                  {r}
                </div>
                {b && (
                  <p className="mt-2 text-sm" style={{ color: MUTED }}>
                    {b}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    )

  if (variant === '3')
    // Horizontal cards: photo beside text.
    return (
      <section className={section} style={{ fontFamily: f.body, background: p.soft }}>
        <div className="mx-auto max-w-5xl">
          {head}
          <div className="grid gap-5 md:grid-cols-2">
            {items.map(([n, r, b, img], i) => (
              <article key={i} className="flex gap-5 rounded-3xl bg-white p-5 shadow-sm">
                <Pic src={img} alt={n} className="h-28 w-28 shrink-0 rounded-2xl object-cover" />
                <div>
                  <h3 className="font-semibold" style={{ color: INK }}>
                    {n}
                  </h3>
                  <div className="text-sm font-medium" style={{ color: p.strong }}>
                    {r}
                  </div>
                  {b && (
                    <p className="mt-2 text-sm" style={{ color: MUTED }}>
                      {b}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    )

  // Design 4: full-bleed photo tiles with name overlay.
  const cols =
    (
      {
        '2': 'md:grid-cols-2',
        '3': 'md:grid-cols-3',
        '4': 'md:grid-cols-2 lg:grid-cols-4',
      } as Record<string, string>
    )[props.columns] ?? 'md:grid-cols-3'
  return (
    <section className={section} style={{ fontFamily: f.body, background: '#fff' }}>
      <div className="mx-auto max-w-6xl">
        {head}
        <div className={`grid gap-4 sm:grid-cols-2 ${cols}`}>
          {items.map(([n, r, , img], i) => (
            <article key={i} className="group relative aspect-[3/4] overflow-hidden rounded-3xl">
              <Pic
                src={img}
                alt={n}
                className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
              <div className="absolute bottom-4 left-5 text-white">
                <h3 className="text-lg font-semibold">{n}</h3>
                <div className="text-sm opacity-80">{r}</div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Footer: designs 2-4 (design 1 = three columns in index.tsx) ──────────────

export type FooterData = {
  name: string
  logo: string
  darkLogo: boolean
  description: string
  emails: string[]
  phones: string[]
  address: string
  socials: (readonly [string, string])[]
  links: string[][]
  copyright: string
  note: string
}

export function FooterDesign({
  variant,
  palette,
  font,
  data,
}: Common & { variant: Variant; data: FooterData }) {
  const { p, f } = look({ palette, font })
  const d = data
  const brand = (
    <div className="flex items-center gap-3">
      {d.logo && (
        <img
          src={d.logo}
          alt={d.name}
          className={
            d.darkLogo
              ? 'h-10 w-auto max-w-[160px] object-contain'
              : 'h-10 w-auto max-w-[160px] rounded-lg bg-white object-contain p-1.5'
          }
        />
      )}
      {d.name && (
        <span className="text-xl text-white" style={display(f)}>
          {d.name}
        </span>
      )}
    </div>
  )
  const nav = (cls: string) => (
    <nav aria-label="Footer" className={cls}>
      {d.links.map(([label, href], i) => (
        <a key={i} href={safeHref(href ?? '#')} className="transition hover:text-white">
          {label}
        </a>
      ))}
    </nav>
  )
  const social = (
    <ul className="flex flex-wrap gap-2">
      {d.socials.map(([label, url]) => (
        <li key={label}>
          <a
            href={safeHref(url)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/85 hover:bg-white/10"
          >
            {label}
          </a>
        </li>
      ))}
    </ul>
  )
  const legal = (d.copyright || d.note) && (
    <div className="text-xs text-white/55">
      {d.copyright}
      {d.copyright && d.note ? ' · ' : ''}
      {d.note}
    </div>
  )
  const contact = [...d.phones, ...d.emails, d.address].filter(Boolean)

  if (variant === '2')
    // Centered: brand, links, social, legal stacked.
    return (
      <footer
        className="px-6 py-14 text-center text-white/75"
        style={{ background: p.footer, fontFamily: f.body }}
      >
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6">
          {brand}
          {d.description && <p className="max-w-md text-sm text-white/65">{d.description}</p>}
          {nav('flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm')}
          {d.socials.length > 0 && social}
          {legal}
        </div>
      </footer>
    )

  if (variant === '3')
    // Slim single row.
    return (
      <footer
        className="px-6 py-6 text-white/75"
        style={{ background: p.footer, fontFamily: f.body }}
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
          {brand}
          {nav('flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm')}
          {legal}
        </div>
      </footer>
    )

  // Design 4: big call-to-action band, then contact + links columns.
  return (
    <footer
      className="px-6 pb-8 pt-14 text-white/75"
      style={{ background: p.footer, fontFamily: f.body }}
    >
      <div className="mx-auto max-w-6xl">
        <div
          className="mb-10 flex flex-col items-start justify-between gap-4 rounded-3xl p-8 md:flex-row md:items-center"
          style={{ background: p.band }}
        >
          <div className="text-2xl text-white md:text-3xl" style={display(f)}>
            {d.name ? `Work with ${d.name}` : 'Let us work together'}
          </div>
          {d.links[0] && (
            <a
              href={safeHref(d.links[0][1] ?? '#')}
              className="rounded-full px-6 py-3 text-sm font-semibold"
              style={btn(p)}
            >
              {d.links[0][0]}
            </a>
          )}
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          <div className="space-y-3">
            {brand}
            {d.description && <p className="text-sm text-white/65">{d.description}</p>}
          </div>
          <div className="space-y-1.5 text-sm">
            {contact.map((c) => (
              <div key={c}>{c}</div>
            ))}
          </div>
          <div className="space-y-4">
            {nav('flex flex-col gap-1.5 text-sm')}
            {d.socials.length > 0 && social}
          </div>
        </div>
        <div className="mt-8 border-t border-white/10 pt-4">{legal}</div>
      </div>
    </footer>
  )
}
