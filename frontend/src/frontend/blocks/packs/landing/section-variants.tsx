import type { CSSProperties } from 'react'
import { safeHref } from '@/frontend/lib/safe-href'
import { display, lines, look, rows, SectionHead, type Common } from './shared'
import type { Palette } from './palettes'

// Designs 2-4 of the Landing sections that have a Design picker (Design 1 is the original look and
// stays in index.tsx). All of them read the same props as Design 1, so switching the design never
// loses content, and every colour comes from the block's palette and font.

export type Variant = '1' | '2' | '3' | '4'

export type StatsProps = Common & { stats: string }
export type BenefitsProps = Common & {
  tone: 'light' | 'dark'
  eyebrow: string
  title: string
  subtitle: string
  columns: '2' | '3' | '4'
  items: string
}
export type ShowcaseProps = Common & {
  eyebrow: string
  title: string
  text: string
  bullets: string
  image: string
  reverse: boolean
  ctaLabel: string
  ctaHref: string
}
export type TestimonialsProps = Common & { eyebrow: string; title: string; items: string }
export type FaqProps = Common & { eyebrow: string; title: string; items: string }
export type CtaProps = Common & {
  title: string
  text: string
  buttonLabel: string
  buttonHref: string
  image: string
}

const section = 'px-6 py-16 md:py-24'
const INK = '#17112b'
const MUTED = '#5b5675'

const buttonStyle = (p: Palette): CSSProperties => ({
  ...(p.button.startsWith('linear') ? { backgroundImage: p.button } : { background: p.button }),
  color: p.buttonText,
})

/* eslint-disable @next/next/no-img-element */

// ── Numbers ──────────────────────────────────────────────────────────────────

export function StatsDesign({ variant, ...props }: StatsProps & { variant: Variant }) {
  const { p, f } = look(props)
  const items = rows(props.stats, 2)
  if (variant === '2')
    return (
      <section className="px-6 py-14" style={{ fontFamily: f.body, background: p.band }}>
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-y-8 text-center text-white md:grid-cols-4 md:divide-x md:divide-white/25">
          {items.map(([value, label], i) => (
            <div key={i} className="px-4">
              <div className="text-4xl md:text-6xl" style={display(f)}>
                {value}
              </div>
              <div className="mt-2 text-sm text-white/80">{label}</div>
            </div>
          ))}
        </div>
      </section>
    )
  if (variant === '3')
    return (
      <section className="px-6 py-14" style={{ fontFamily: f.body }}>
        <div className="mx-auto grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(([value, label], i) => (
            <div
              key={i}
              className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-black/5"
              style={{ borderTop: `4px solid ${p.strong}` }}
            >
              <div className="text-4xl" style={{ ...display(f), color: INK }}>
                {value}
              </div>
              <div className="mt-2 text-sm" style={{ color: MUTED }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>
    )
  return (
    <section className="px-6 py-14" style={{ fontFamily: f.body, background: p.soft }}>
      <div className="mx-auto flex max-w-5xl flex-wrap justify-center gap-8">
        {items.map(([value, label], i) => (
          <div key={i} className="flex w-40 flex-col items-center text-center">
            <div
              className="grid h-32 w-32 place-items-center rounded-full bg-white text-2xl shadow-lg"
              style={{ ...display(f), color: p.strong, boxShadow: `0 0 0 6px ${p.pill}33` }}
            >
              {value}
            </div>
            <div className="mt-3 text-sm font-medium" style={{ color: INK }}>
              {label}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Services / benefits ──────────────────────────────────────────────────────

export function BenefitsDesign({ variant, ...props }: BenefitsProps & { variant: Variant }) {
  const { p, f } = look(props)
  const dark = props.tone === 'dark'
  const items = rows(props.items, 3)
  const ink = dark ? '#fff' : INK
  const body = dark ? 'rgba(255,255,255,.72)' : MUTED
  const head = (
    <SectionHead
      eyebrow={props.eyebrow}
      title={props.title}
      subtitle={props.subtitle}
      p={p}
      f={f}
      light={dark}
    />
  )
  const wrap = (children: React.ReactNode) => (
    <section
      className={section}
      style={{ fontFamily: f.body, background: dark ? '#0f0a24' : '#ffffff' }}
    >
      <div className="mx-auto max-w-6xl">
        {head}
        {children}
      </div>
    </section>
  )
  if (variant === '2')
    return wrap(
      <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(([icon, title, text], i) => (
          <div key={i} className="text-center">
            <span
              className="mx-auto grid h-20 w-20 place-items-center rounded-full text-3xl"
              style={{ background: p.soft, boxShadow: `0 0 0 8px ${p.pill}22` }}
            >
              {icon}
            </span>
            <h3 className="mt-5 text-lg font-semibold" style={{ color: ink }}>
              {title}
            </h3>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed" style={{ color: body }}>
              {text}
            </p>
          </div>
        ))}
      </div>
    )
  if (variant === '3')
    return wrap(
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(([icon, title, text], i) => (
          <div
            key={i}
            className="relative overflow-hidden rounded-3xl p-7 pt-14 shadow-md ring-1 ring-black/5"
            style={{ background: dark ? 'rgba(255,255,255,.06)' : '#fff' }}
          >
            <span
              className="absolute left-6 top-2 text-6xl leading-none opacity-20"
              style={{ ...display(f), color: p.strong }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="text-2xl">{icon}</span>
            <h3 className="mt-3 text-lg font-semibold" style={{ color: ink }}>
              {title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: body }}>
              {text}
            </p>
            <span className="mt-5 block h-1 w-12 rounded-full" style={{ background: p.strong }} />
          </div>
        ))}
      </div>
    )
  const [first, ...rest] = items
  return wrap(
    <div className="grid gap-6 lg:grid-cols-5">
      {first && (
        <div
          className="rounded-[2rem] p-9 text-white shadow-xl lg:col-span-2"
          style={{ background: p.band }}
        >
          <span className="text-4xl">{first[0]}</span>
          <h3 className="mt-5 text-2xl" style={display(f)}>
            {first[1]}
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-white/85">{first[2]}</p>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-3">
        {rest.map(([icon, title, text], i) => (
          <div
            key={i}
            className="flex gap-4 rounded-2xl p-5 ring-1 ring-black/5"
            style={{ background: dark ? 'rgba(255,255,255,.06)' : p.soft }}
          >
            <span className="text-2xl">{icon}</span>
            <div>
              <h3 className="font-semibold" style={{ color: ink }}>
                {title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed" style={{ color: body }}>
                {text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── About / showcase ─────────────────────────────────────────────────────────

export function ShowcaseDesign({ variant, ...props }: ShowcaseProps & { variant: Variant }) {
  const { p, f } = look(props)
  const bullets = lines(props.bullets)
  const cta = props.ctaLabel && (
    <a
      href={safeHref(props.ctaHref)}
      className="mt-8 inline-flex rounded-full px-7 py-3.5 text-sm font-semibold shadow-lg"
      style={buttonStyle(p)}
    >
      {props.ctaLabel}
    </a>
  )
  const eyebrow = props.eyebrow && (
    <span className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: p.strong }}>
      {props.eyebrow}
    </span>
  )
  const title = (
    <h2 className="mt-2 text-3xl leading-tight md:text-5xl" style={{ ...display(f), color: INK }}>
      {props.title}
    </h2>
  )
  if (variant === '2')
    return (
      <section className={section} style={{ fontFamily: f.body, background: '#fff' }}>
        <div className="mx-auto max-w-4xl text-center">
          {eyebrow}
          {title}
          {props.text && (
            <p
              className="mx-auto mt-4 max-w-2xl text-base leading-relaxed md:text-lg"
              style={{ color: MUTED }}
            >
              {props.text}
            </p>
          )}
          {props.image && (
            <img
              src={props.image}
              alt=""
              className="mt-10 aspect-[16/8] w-full rounded-[2rem] object-cover shadow-2xl"
            />
          )}
          <ul className="mt-8 grid gap-3 text-left sm:grid-cols-2">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-3" style={{ color: INK }}>
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
          {cta}
        </div>
      </section>
    )
  if (variant === '3')
    return (
      <section className={section} style={{ fontFamily: f.body, background: p.soft }}>
        <div className="relative mx-auto max-w-6xl md:min-h-[460px]">
          {props.image && (
            <img
              src={props.image}
              alt=""
              className={`aspect-[4/3] w-full rounded-[2rem] object-cover shadow-2xl md:absolute md:top-0 md:h-full md:w-3/5 md:aspect-auto ${props.reverse ? 'md:left-0' : 'md:right-0'}`}
            />
          )}
          <div
            className={`relative mt-[-3rem] ml-4 mr-4 rounded-[2rem] bg-white p-8 shadow-2xl md:absolute md:top-1/2 md:mx-0 md:mt-0 md:w-1/2 md:-translate-y-1/2 ${props.reverse ? 'md:right-0' : 'md:left-0'}`}
          >
            {eyebrow}
            {title}
            {props.text && (
              <p className="mt-4 text-sm leading-relaxed md:text-base" style={{ color: MUTED }}>
                {props.text}
              </p>
            )}
            <ul className="mt-5 space-y-2">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm" style={{ color: INK }}>
                  <span style={{ color: p.strong }}>●</span>
                  {b}
                </li>
              ))}
            </ul>
            {cta}
          </div>
        </div>
      </section>
    )
  return (
    <section className={section} style={{ fontFamily: f.body, background: '#fff' }}>
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[2.2rem] shadow-2xl ring-1 ring-black/5">
        {props.image && (
          <img src={props.image} alt="" className="aspect-[16/7] w-full object-cover" />
        )}
        <div
          className="grid gap-8 p-8 md:grid-cols-[1.2fr_1fr] md:p-12"
          style={{ background: p.soft }}
        >
          <div>
            {eyebrow}
            {title}
            {props.text && (
              <p className="mt-4 text-base leading-relaxed" style={{ color: MUTED }}>
                {props.text}
              </p>
            )}
            {cta}
          </div>
          <ul className="space-y-3 self-center">
            {bullets.map((b, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-2xl bg-white p-4 text-sm shadow-sm"
                style={{ color: INK }}
              >
                <span
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                  style={{ background: p.strong }}
                >
                  ✓
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

// ── Testimonials ─────────────────────────────────────────────────────────────

function Person({
  name = '',
  role,
  photo,
  dark = false,
}: {
  name?: string
  role?: string
  photo?: string
  dark?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      {photo && (
        <img src={photo} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-white" />
      )}
      <div>
        <div className="text-sm font-semibold" style={{ color: dark ? '#fff' : INK }}>
          {name}
        </div>
        <div className="text-xs" style={{ color: dark ? 'rgba(255,255,255,.65)' : '#64748b' }}>
          {role}
        </div>
      </div>
    </div>
  )
}

export function TestimonialsDesign({
  variant,
  ...props
}: TestimonialsProps & { variant: Variant }) {
  const { p, f } = look(props)
  const items = rows(props.items, 2)
  if (variant === '2') {
    const [lead, ...rest] = items
    return (
      <section className={section} style={{ fontFamily: f.body, background: p.soft }}>
        <div className="mx-auto max-w-4xl">
          <SectionHead eyebrow={props.eyebrow} title={props.title} p={p} f={f} />
          {lead && (
            <figure className="rounded-[2rem] bg-white p-8 text-center shadow-xl md:p-12">
              <div className="text-sm tracking-widest text-amber-400" aria-label="5 out of 5 stars">
                ★★★★★
              </div>
              <blockquote
                className="mt-5 text-xl leading-relaxed md:text-2xl"
                style={{ color: INK }}
              >
                “{lead[0]}”
              </blockquote>
              <figcaption className="mt-6 flex justify-center">
                <Person name={lead[1]} role={lead[2]} photo={lead[3]} />
              </figcaption>
            </figure>
          )}
          {rest.length > 0 && (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {rest.map(([quote, name, role, photo], i) => (
                <figure key={i} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                  <blockquote className="text-sm leading-relaxed" style={{ color: MUTED }}>
                    “{quote}”
                  </blockquote>
                  <figcaption className="mt-4">
                    <Person name={name} role={role} photo={photo} />
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </section>
    )
  }
  if (variant === '3')
    return (
      <section className={section} style={{ fontFamily: f.body, background: '#0f0a24' }}>
        <div className="mx-auto max-w-6xl">
          <SectionHead eyebrow={props.eyebrow} title={props.title} p={p} f={f} light />
          <div className="gap-5 [column-fill:_balance] md:columns-2 lg:columns-3">
            {items.map(([quote, name, role, photo], i) => (
              <figure
                key={i}
                className="mb-5 break-inside-avoid rounded-3xl p-7"
                style={{
                  background: 'rgba(255,255,255,.07)',
                  border: '1px solid rgba(255,255,255,.12)',
                }}
              >
                <blockquote className="text-sm leading-relaxed text-white/85">“{quote}”</blockquote>
                <figcaption className="mt-5">
                  <Person name={name} role={role} photo={photo} dark />
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
    )
  return (
    <section className={section} style={{ fontFamily: f.body, background: '#fff' }}>
      <div className="mx-auto max-w-6xl">
        <SectionHead eyebrow={props.eyebrow} title={props.title} p={p} f={f} />
        <div className="-mx-6 flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-4">
          {items.map(([quote, name, role, photo], i) => (
            <figure
              key={i}
              className="w-[85%] shrink-0 snap-center rounded-3xl p-8 shadow-lg ring-1 ring-black/5 sm:w-[46%] lg:w-[32%]"
              style={{ background: i % 2 ? p.soft : '#fff', borderBottom: `4px solid ${p.strong}` }}
            >
              <div className="text-sm tracking-widest text-amber-400">★★★★★</div>
              <blockquote className="mt-4 text-base leading-relaxed" style={{ color: INK }}>
                {quote}
              </blockquote>
              <figcaption className="mt-6">
                <Person name={name} role={role} photo={photo} />
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── FAQ ──────────────────────────────────────────────────────────────────────

export function FaqDesign({ variant, ...props }: FaqProps & { variant: Variant }) {
  const { p, f } = look(props)
  const items = rows(props.items, 2)
  if (variant === '2')
    return (
      <section className={section} style={{ fontFamily: f.body, background: p.soft }}>
        <div className="mx-auto max-w-6xl">
          <SectionHead eyebrow={props.eyebrow} title={props.title} p={p} f={f} />
          <div className="grid gap-5 md:grid-cols-2">
            {items.map(([q, a], i) => (
              <div key={i} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                <h3 className="flex gap-3 text-base font-semibold" style={{ color: INK }}>
                  <span style={{ color: p.strong }}>Q.</span>
                  {q}
                </h3>
                <p className="mt-3 pl-8 text-sm leading-relaxed" style={{ color: MUTED }}>
                  {a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  if (variant === '3')
    return (
      <section className={section} style={{ fontFamily: f.body, background: '#fff' }}>
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1fr_1.6fr]">
          <div className="md:sticky md:top-24 md:self-start">
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
              style={{ ...display(f), color: INK }}
            >
              {props.title}
            </h2>
          </div>
          <div className="space-y-3">
            {items.map(([q, a], i) => (
              <details
                key={i}
                className="group rounded-2xl px-6 py-5"
                style={{ background: p.soft }}
                open={i === 0}
              >
                <summary
                  className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold"
                  style={{ color: INK }}
                >
                  {q}
                  <span
                    className="text-xl transition group-open:rotate-45"
                    style={{ color: p.strong }}
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: MUTED }}>
                  {a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
    )
  return (
    <section className={section} style={{ fontFamily: f.body, background: '#fff' }}>
      <div className="mx-auto max-w-3xl">
        <SectionHead eyebrow={props.eyebrow} title={props.title} p={p} f={f} />
        <ol className="divide-y divide-slate-200 border-y border-slate-200">
          {items.map(([q, a], i) => (
            <li key={i} className="flex gap-5 py-6">
              <span className="text-3xl leading-none" style={{ ...display(f), color: p.strong }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <h3 className="text-base font-semibold" style={{ color: INK }}>
                  {q}
                </h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: MUTED }}>
                  {a}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

// ── Call to action ───────────────────────────────────────────────────────────

export function CtaDesign({ variant, ...props }: CtaProps & { variant: Variant }) {
  const { p, f } = look(props)
  const button = (dark: boolean) =>
    props.buttonLabel && (
      <a
        href={safeHref(props.buttonHref)}
        className="inline-flex shrink-0 rounded-full px-8 py-4 text-sm font-bold shadow-xl transition hover:-translate-y-0.5"
        style={dark ? { background: '#fff', color: p.strong } : buttonStyle(p)}
      >
        {props.buttonLabel}
      </a>
    )
  if (variant === '2')
    return (
      <section className="px-6 py-12" style={{ fontFamily: f.body, background: p.soft }}>
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 rounded-3xl bg-white p-8 shadow-lg ring-1 ring-black/5 md:flex-row md:items-center md:p-10">
          <div>
            <h2 className="text-2xl md:text-4xl" style={{ ...display(f), color: INK }}>
              {props.title}
            </h2>
            {props.text && (
              <p className="mt-2 max-w-xl text-base" style={{ color: MUTED }}>
                {props.text}
              </p>
            )}
          </div>
          {button(false)}
        </div>
      </section>
    )
  if (variant === '3')
    return (
      <section
        className="relative overflow-hidden px-6 py-20 text-center text-white"
        style={{ fontFamily: f.body, background: '#0f0a24' }}
      >
        <div
          className="pointer-events-none absolute -left-20 top-0 h-72 w-72 rounded-full opacity-40 blur-3xl"
          style={{ background: p.ring }}
        />
        <div
          className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full opacity-40 blur-3xl"
          style={{ background: p.band }}
        />
        <div className="relative mx-auto max-w-3xl">
          <h2 className="text-4xl leading-tight md:text-6xl" style={display(f)}>
            {props.title}
          </h2>
          {props.text && <p className="mt-5 text-base text-white/80 md:text-lg">{props.text}</p>}
          <div className="mt-9">{button(true)}</div>
        </div>
      </section>
    )
  return (
    <section className="px-6 py-12 md:py-16" style={{ fontFamily: f.body, background: '#fff' }}>
      <div
        className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] px-8 py-16 text-white md:px-16"
        style={{ background: p.band }}
      >
        {props.image && (
          <>
            <img src={props.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(90deg, rgba(15,10,36,.85), rgba(15,10,36,.35))',
              }}
            />
          </>
        )}
        <div className="relative max-w-xl">
          <h2 className="text-3xl leading-tight md:text-5xl" style={display(f)}>
            {props.title}
          </h2>
          {props.text && <p className="mt-4 text-base text-white/85 md:text-lg">{props.text}</p>}
          <div className="mt-8">{button(true)}</div>
        </div>
      </div>
    </section>
  )
}
