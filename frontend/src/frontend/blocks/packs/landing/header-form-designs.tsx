import type { CSSProperties, ReactNode } from 'react'
import { safeHref } from '@/frontend/lib/safe-href'
import { display, look, type Common } from './shared'
import type { Variant } from './section-variants'

// Designs 2-4 of the landing Header and Form. Design 1 stays in index.tsx (the original look). Same content in
// every design: the header's logo, name and phone come from Application Identity, the form is the real form.

// The brand links to the site's home. A constant, because the generated site has no next/link of its own.
const HOME = '/'

export type HeaderData = {
  name: string
  logo: string
  phone: string
  links: string[][]
  ctaLabel: string
  ctaHref: string
}

export function HeaderDesign({
  variant,
  palette,
  font,
  data: d,
}: Common & { variant: Variant; data: HeaderData }) {
  const { p, f } = look({ palette, font })
  const dark = variant === '3'
  const ink = dark ? 'text-white' : 'text-slate-900'
  const linkCls = dark
    ? 'text-white/80 transition hover:text-white'
    : 'text-slate-700 transition hover:text-slate-950'

  const brand = (
    <a href={HOME} className="flex min-w-0 items-center gap-3">
      {d.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={d.logo}
          alt={d.name}
          className={
            dark
              ? 'h-10 w-auto max-w-[160px] rounded-lg bg-white object-contain p-1'
              : 'h-10 w-auto max-w-[160px] object-contain'
          }
        />
      )}
      {d.name && (
        <span className={`truncate text-xl ${ink}`} style={display(f)}>
          {d.name}
        </span>
      )}
    </a>
  )
  const nav = (cls: string) =>
    d.links.length > 0 && (
      <nav
        aria-label="Header"
        className={`hidden items-center gap-6 text-sm font-medium md:flex ${cls}`}
      >
        {d.links.map(([label, href], i) => (
          <a key={i} href={safeHref(href ?? '#')} className={linkCls}>
            {label}
          </a>
        ))}
      </nav>
    )
  const phone = d.phone && (
    <a
      href={safeHref(`tel:${d.phone.replace(/[^+\d]/g, '')}`)}
      className="hidden text-sm font-semibold sm:inline"
      style={{ color: dark ? p.accent : p.strong }}
    >
      {d.phone}
    </a>
  )
  const cta = d.ctaLabel && (
    <a
      href={safeHref(d.ctaHref || '#contact')}
      className="rounded-full px-5 py-2 text-sm font-semibold shadow-sm transition hover:opacity-90"
      style={{ background: dark ? p.accent : p.strong, color: dark ? '#17112b' : '#fff' }}
    >
      {d.ctaLabel}
    </a>
  )

  // 2: centred logo, menu on its own row underneath, phone and button on the sides of the logo row.
  if (variant === '2')
    return (
      <header
        style={{ fontFamily: f.body }}
        className="relative z-10 border-b border-black/5 bg-white"
      >
        <div className="mx-auto max-w-6xl px-6 py-3">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="flex">{phone}</div>
            <div className="justify-self-center">{brand}</div>
            <div className="flex justify-end">{cta}</div>
          </div>
          {d.links.length > 0 && (
            <div className="mt-3 hidden justify-center border-t border-black/5 pt-3 md:flex">
              {nav('justify-center')}
            </div>
          )}
        </div>
      </header>
    )

  // 3: solid dark bar in the palette's footer colour, accent button.
  if (variant === '3')
    return (
      <header style={{ fontFamily: f.body, background: p.footer }} className="relative z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          {brand}
          {nav('')}
          <div className="flex shrink-0 items-center gap-4">
            {phone}
            {cta}
          </div>
        </div>
      </header>
    )

  // 4: floating rounded bar inset from the page edges, on a soft shadow.
  return (
    <header style={{ fontFamily: f.body }} className="relative z-10 px-4 pt-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full border border-black/5 bg-white px-5 py-2.5 shadow-lg shadow-black/5">
        {brand}
        {nav('')}
        <div className="flex shrink-0 items-center gap-4">
          {phone}
          {cta}
        </div>
      </div>
    </header>
  )
}

export function FormDesign({
  variant,
  palette,
  font,
  eyebrow,
  title,
  subtitle,
  form,
  anchor,
}: Common & {
  variant: Variant
  eyebrow: string
  title: string
  subtitle: string
  form: ReactNode
  anchor?: string
}) {
  const { p, f } = look({ palette, font })
  const vars = {
    fontFamily: f.body,
    // The form's Send button reads the primary colour tokens: point them at this palette.
    '--branding_brand_colors_primary_color': p.strong,
    '--buttons_primary_button_text_color': '#ffffff',
  } as CSSProperties
  const head = (light: boolean, align: string) => (
    <div className={align}>
      {eyebrow && (
        <span
          className="text-xs font-semibold uppercase tracking-[0.18em]"
          style={{ color: light ? p.accent : p.strong }}
        >
          {eyebrow}
        </span>
      )}
      <h2
        className="mt-2 text-3xl leading-tight md:text-5xl"
        style={{ ...display(f), color: light ? '#fff' : '#17112b' }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className="mt-4 text-base md:text-lg"
          style={{ color: light ? 'rgba(255,255,255,.75)' : '#5b5675' }}
        >
          {subtitle}
        </p>
      )}
    </div>
  )
  const card = 'rounded-2xl bg-white p-1.5 shadow-xl shadow-black/10'

  // 2: heading on the left, form card on the right, on the palette's hero colour.
  if (variant === '2')
    return (
      <section
        id={anchor || undefined}
        className="px-6 py-20 md:py-28"
        style={{ ...vars, background: p.hero }}
      >
        <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2">
          {head(p.dark, 'text-left')}
          <div className={card}>{form}</div>
        </div>
      </section>
    )

  // 3: light page, accent bar across the top of a wide form card, heading left-aligned above it.
  if (variant === '3')
    return (
      <section id={anchor || undefined} className="bg-white px-6 py-20 md:py-28" style={vars}>
        <div className="mx-auto max-w-3xl">
          {head(false, 'mb-8 text-left')}
          <div className="overflow-hidden rounded-2xl border border-black/10 shadow-lg shadow-black/5">
            <div className="h-1.5" style={{ background: p.strong }} />
            <div className="bg-white p-1.5">{form}</div>
          </div>
        </div>
      </section>
    )

  // 4: dark full-width band, centred heading, the form card overlapping the band's lower edge.
  return (
    <section id={anchor || undefined} style={vars}>
      <div className="px-6 pb-32 pt-20 text-center md:pt-28" style={{ background: p.footer }}>
        <div className="mx-auto max-w-2xl">{head(true, 'text-center')}</div>
      </div>
      <div className="px-6 pb-20">
        <div className={`mx-auto -mt-20 max-w-2xl ${card}`}>{form}</div>
      </div>
    </section>
  )
}
