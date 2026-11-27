'use client'

// GDG site chrome: header (floating pill nav + time-of-day switch), footer, page heading with the
// optional sub-menu, the "Join" banner and the sound toggle. Ported from the GDG Vizag site.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentConfig } from '@puckeditor/core'
import {
  Gdg,
  MorphShape,
  TIME_EVENT,
  isDarkTime,
  lines,
  setSfx,
  sfx,
  text,
  area,
  type TimeOfDay,
} from './lib'

const isExternal = (href: string) => /^https?:\/\//i.test(href)
const ext = (href: string) => (isExternal(href) ? { target: '_blank', rel: 'noopener' } : {})
const samePath = (a: string, b: string) => a.replace(/\/+$/, '') === b.replace(/\/+$/, '')

// ─── Header ──────────────────────────────────────────────────────────────────

const TIME_KEY = 'devfest-vizag-time'
const THEME_KEY = 'devfest-vizag-theme'
const TIMES: { t: TimeOfDay; label: string; icon: React.ReactNode }[] = [
  {
    t: 'dawn',
    label: 'Dawn',
    icon: <path d="M3 18h18M7 18a5 5 0 0 1 10 0M12 5v3M5 10l2 2M19 10l-2 2" />,
  },
  {
    t: 'day',
    label: 'Day',
    icon: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
  },
  {
    t: 'dusk',
    label: 'Dusk',
    icon: <path d="M3 19h18M8 19a4 4 0 0 1 8 0M12 7v3M5.5 12l1.5 1.5M18.5 12L17 13.5" />,
  },
  { t: 'night', label: 'Night', icon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /> },
]
const read = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* storage blocked */
  }
}

/** Applies the time of day to <html> and keeps it there while a GDG page is open. */
function useTimeOfDay() {
  const [time, setTime] = useState<TimeOfDay | null>(null)
  useEffect(() => {
    const root = document.documentElement
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const valid = (t: string | null): t is TimeOfDay =>
      !!t && ['dawn', 'day', 'dusk', 'night'].includes(t)
    const byClock = (): TimeOfDay => {
      const h = new Date().getHours()
      return h < 9 ? 'dawn' : h < 16 ? 'day' : 'dusk'
    }
    let chosen: TimeOfDay | null = null
    const saved = read(TIME_KEY)
    if (valid(saved)) chosen = saved
    else {
      const th = read(THEME_KEY)
      chosen = th === 'dark' ? 'night' : th === 'light' ? 'day' : null
    }
    const apply = (t: TimeOfDay) => {
      root.dataset.gdgTime = t
      root.dataset.gdgTheme = isDarkTime(t) ? 'dark' : 'light'
      setTime(t)
      document.dispatchEvent(new CustomEvent(TIME_EVENT, { detail: t }))
    }
    apply(chosen ?? (mq.matches ? 'night' : byClock()))
    const onSystem = () => {
      if (!valid(read(TIME_KEY))) apply(mq.matches ? 'night' : byClock())
    }
    mq.addEventListener('change', onSystem)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      root.classList.add('gdg-no-motion')
    return () => {
      mq.removeEventListener('change', onSystem)
      delete root.dataset.gdgTime
      delete root.dataset.gdgTheme
      root.classList.remove('gdg-no-motion')
    }
  }, [])
  const choose = (t: TimeOfDay) => {
    const root = document.documentElement
    root.dataset.gdgTime = t
    root.dataset.gdgTheme = isDarkTime(t) ? 'dark' : 'light'
    write(TIME_KEY, t)
    write(THEME_KEY, root.dataset.gdgTheme)
    setTime(t)
    document.dispatchEvent(new CustomEvent(TIME_EVENT, { detail: t }))
    sfx('tick')
  }
  return { time, choose }
}

type HeaderProps = {
  brandName: string
  logo: string
  menu: string
  ctaLabel: string
  ctaHref: string
}

export const GdgHeader: ComponentConfig<HeaderProps> = {
  label: 'GDG Header',
  fields: {
    brandName: text('Brand name'),
    logo: text('Logo image URL'),
    menu: area('Menu (one "Label | /link" per line)'),
    ctaLabel: text('Button label'),
    ctaHref: text('Button link'),
  },
  defaultProps: {
    brandName: 'GDG Vizag',
    logo: '/gdg/logo-mark.png',
    menu: 'Home | /\nEvents | /events\nDevFest | /devfest\nCommunity | /community\nLog in | /membership/login',
    ctaLabel: 'Join GDG Vizag',
    ctaHref: 'https://gdg.community.dev/gdg-vizag/',
  },
  render: function Render({ brandName, logo, menu, ctaLabel, ctaHref }) {
    const pathname = usePathname() ?? '/'
    const [open, setOpen] = useState(false)
    const { time, choose } = useTimeOfDay()
    const dark = time ? isDarkTime(time) : false
    const items = lines(menu, 2)
    // A sub-page (/devfest/program) still marks its section (DevFest) as current.
    const current = (href: string) =>
      samePath(pathname, href) ||
      (href !== '/' && !isExternal(href) && pathname.startsWith(href.replace(/\/+$/, '') + '/'))
    return (
      <Gdg>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <header className="nav" id="top">
          <div className="nav-pill">
            <Link className="brand" href="/" aria-label={`${brandName} home`}>
              {logo ? (
                <img className="brand-mark" src={logo} alt="" width={40} height={22} />
              ) : null}
              <span>{brandName}</span>
            </Link>
            <button
              className="menu-btn"
              aria-expanded={open}
              aria-controls="menu"
              aria-label="Toggle menu"
              onClick={() => setOpen((o) => !o)}
            >
              <span></span>
              <span></span>
            </button>
            <nav
              id="menu"
              className={open ? 'menu open' : 'menu'}
              onClick={(e) => (e.target as HTMLElement).closest('a') && setOpen(false)}
            >
              {items.map(([label, href]) => (
                <a
                  key={label + href}
                  href={href || '#'}
                  aria-current={current(href) ? 'page' : undefined}
                  {...ext(href)}
                >
                  {label}
                </a>
              ))}
              {ctaLabel ? (
                <a className="btn btn-sm" href={ctaHref || '#'} {...ext(ctaHref)}>
                  {ctaLabel}
                </a>
              ) : null}
            </nav>
          </div>
          <div className="nav-time" role="radiogroup" aria-label="Time of day and theme">
            {TIMES.map(({ t, label, icon }) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={time === t}
                data-time={t}
                aria-label={label}
                onClick={() => choose(t)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  {icon}
                </svg>
                <span>{label}</span>
              </button>
            ))}
          </div>
          <button
            className="theme-btn"
            id="theme"
            type="button"
            aria-pressed={dark}
            aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={() => choose(dark ? 'day' : 'night')}
          >
            <svg className="moon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
            </svg>
            <svg className="sun" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          </button>
        </header>
        {/* Member pages (login, account) have no page head under the floating header: keep them clear of it. */}
        {pathname.startsWith('/membership') ? (
          <div className="nav-spacer" aria-hidden="true" />
        ) : null}
        <span id="main" />
      </Gdg>
    )
  },
}

// ─── Footer ──────────────────────────────────────────────────────────────────

type FooterProps = {
  logo: string
  logoAlt: string
  blurb: string
  col1Title: string
  col1: string
  col2Title: string
  col2: string
  col3Title: string
  col3: string
  builtMark: string
  builtText: string
  builtWord: string
  legal: string
}

export const GdgFooter: ComponentConfig<FooterProps> = {
  label: 'GDG Footer',
  fields: {
    logo: text('Logo image URL'),
    logoAlt: text('Logo alt text'),
    blurb: area('Text under the logo'),
    col1Title: text('Column 1 title'),
    col1: area('Column 1 links ("Label | link" per line)'),
    col2Title: text('Column 2 title'),
    col2: area('Column 2 links'),
    col3Title: text('Column 3 title'),
    col3: area('Column 3 links'),
    builtMark: text('"Built by" mark image'),
    builtText: text('"Built by" text'),
    builtWord: text('"Built by" wordmark image'),
    legal: area('Legal line'),
  },
  defaultProps: {
    logo: '/gdg/logo-gdg-lockup.png',
    logoAlt: 'Google Developer Groups Vizag',
    blurb: 'Organizers: Usha Ramani Vemuru, Satish K and Sampath Balivada.',
    col1Title: 'Follow',
    col1: [
      'X / Twitter | https://twitter.com/GDGVizag',
      'Instagram | https://www.instagram.com/gdg_vizag',
      'LinkedIn | https://www.linkedin.com/groups/13894985',
      'Facebook | https://www.facebook.com/VizagGDG',
      'YouTube | https://www.youtube.com/channel/UCTCDCd0H-Vaar60vb1bax2A',
    ].join('\n'),
    col2Title: 'Pages',
    col2: 'Home | /\nEvents | /events\nDevFest | /devfest\nCommunity | /community',
    col3Title: 'DevFest',
    col3: 'Program | /devfest/program\nPlay | /devfest/play\nVisit | /devfest/visit\nChapter page | https://gdg.community.dev/gdg-vizag/',
    builtMark: '/gdg/logo-mark.png',
    builtText: 'This website was designed and built by the <b>GDG Vizag</b> team.',
    builtWord: '/gdg/logo-gdg-vizag.png',
    legal:
      'GDG Vizag is a community-run Google Developer Group. This is a community site, not an official Google website. Google and Google Developer Groups are trademarks of Google LLC.',
  },
  render: function Render(p) {
    const cols: [string, string][] = [
      [p.col1Title, p.col1],
      [p.col2Title, p.col2],
      [p.col3Title, p.col3],
    ]
    // Only <b> is allowed in the "built by" line, so an editor can bold the team name.
    const built = (p.builtText ?? '')
      .split(/(<b>.*?<\/b>)/g)
      .map((part, i) =>
        part.startsWith('<b>') ? <b key={i}>{part.slice(3, -4)}</b> : <span key={i}>{part}</span>
      )
    return (
      <Gdg>
        <footer className="footer">
          <div className="foot-grid">
            <div>
              <Link className="foot-logo" href="/" aria-label="Home">
                <img src={p.logo} alt={p.logoAlt} width={900} height={101} loading="lazy" />
              </Link>
              <p>{p.blurb}</p>
            </div>
            {cols.map(([title, links]) => (
              <div key={title}>
                <h4>{title}</h4>
                {lines(links, 2).map(([label, href]) => (
                  <a key={label} href={href || '#'} {...ext(href)}>
                    {label}
                  </a>
                ))}
              </div>
            ))}
          </div>
          <div className="built">
            {p.builtMark ? (
              <img
                className="built-mark"
                src={p.builtMark}
                alt=""
                width={44}
                height={24}
                loading="lazy"
              />
            ) : null}
            <p>{built}</p>
            {p.builtWord ? (
              <img
                className="built-word"
                src={p.builtWord}
                alt="GDG Vizag"
                width={720}
                height={113}
                loading="lazy"
              />
            ) : null}
          </div>
          <p className="legal">{p.legal}</p>
        </footer>
      </Gdg>
    )
  },
}

// ─── Page heading (+ optional sub-menu) ──────────────────────────────────────

type PageHeadProps = {
  eyebrow: string
  title: string
  lead: string
  subnav: string
  subnavLabel: string
}

export const GdgPageHead: ComponentConfig<PageHeadProps> = {
  label: 'GDG Page Heading',
  fields: {
    eyebrow: text('Small line above the title'),
    title: text('Title'),
    lead: area('Intro'),
    subnav: area('Sub-menu (optional, "Label | /link" per line)'),
    subnavLabel: text('Sub-menu name (for screen readers)'),
  },
  defaultProps: {
    eyebrow: 'GDG Vizag',
    title: 'Page title',
    lead: '',
    subnav: '',
    subnavLabel: 'Section pages',
  },
  render: function Render({ eyebrow, title, lead, subnav, subnavLabel }) {
    const pathname = usePathname() ?? '/'
    const sub = lines(subnav, 2)
    return (
      <Gdg>
        <section className="page-head">
          <div className="page-head-copy">
            {eyebrow ? <p className="presents">{eyebrow}</p> : null}
            <h1>{title}</h1>
            {lead ? <p className="lead">{lead}</p> : null}
          </div>
          <div className="page-head-art" aria-hidden="true">
            <MorphShape n={8} amp={0.07} speed={0.8} viewBox="-110 -110 220 220" />
            <MorphShape
              n={5}
              amp={0.16}
              speed={1.1}
              dir={-1}
              phase={1.7}
              viewBox="-110 -110 220 220"
            />
            <MorphShape n={6} amp={0.12} speed={0.7} phase={3.4} viewBox="-110 -110 220 220" />
          </div>
        </section>
        {sub.length ? (
          <nav className="subnav" aria-label={subnavLabel}>
            {sub.map(([label, href]) => (
              <a
                key={href}
                href={href}
                aria-current={samePath(pathname, href) ? 'page' : undefined}
              >
                {label}
              </a>
            ))}
          </nav>
        ) : null}
      </Gdg>
    )
  },
}

// ─── Join banner ─────────────────────────────────────────────────────────────

type JoinProps = {
  title: string
  body: string
  primaryLabel: string
  primaryHref: string
  secondaryLabel: string
  secondaryHref: string
  tag: string
}

export const GdgJoinBanner: ComponentConfig<JoinProps> = {
  label: 'GDG Join Banner',
  fields: {
    title: text('Title'),
    body: area('Text'),
    primaryLabel: text('Main button'),
    primaryHref: text('Main button link'),
    secondaryLabel: text('Second button'),
    secondaryHref: text('Second button link'),
    tag: text('Hashtags'),
  },
  defaultProps: {
    title: 'Join GDG Vizag',
    body: 'Connect with developers, designers and founders in Visakhapatnam. New events are announced on the chapter page first.',
    primaryLabel: 'Join GDG Vizag',
    primaryHref: 'https://gdg.community.dev/gdg-vizag/',
    secondaryLabel: 'Follow on Instagram',
    secondaryHref: 'https://www.instagram.com/gdg_vizag',
    tag: '#GDGVizag',
  },
  render: (p) => (
    <Gdg>
      <section id="register" className="register">
        <MorphShape className="deco d1" n={8} amp={0.09} still />
        <MorphShape className="deco d2" n={5} amp={0.15} still />
        <div className="register-inner">
          <h2>{p.title}</h2>
          <p>{p.body}</p>
          <div className="cta center">
            {p.primaryLabel ? (
              <a className="btn btn-light" href={p.primaryHref} {...ext(p.primaryHref)}>
                {p.primaryLabel}
              </a>
            ) : null}
            {p.secondaryLabel ? (
              <a className="btn btn-outline" href={p.secondaryHref} {...ext(p.secondaryHref)}>
                {p.secondaryLabel}
              </a>
            ) : null}
          </div>
          {p.tag ? <p className="tag">{p.tag}</p> : null}
        </div>
      </section>
    </Gdg>
  ),
}

// ─── Sound toggle ────────────────────────────────────────────────────────────

export const GdgSoundToggle: ComponentConfig<Record<string, never>> = {
  label: 'GDG Sound Toggle',
  fields: {},
  defaultProps: {},
  render: function Render() {
    const [on, setOn] = useState(false)
    useEffect(() => {
      document.documentElement.classList.add('gdg-has-sfx')
      return () => {
        document.documentElement.classList.remove('gdg-has-sfx')
        setSfx(false)
      }
    }, [])
    return (
      <Gdg>
        <button
          className="sfx"
          id="sfx"
          type="button"
          aria-pressed={on}
          aria-label="Sound effects"
          onClick={() => {
            const next = !on
            setOn(next)
            setSfx(next)
            sfx('match')
          }}
        >
          {on ? 'Sound on' : 'Sound off'}
        </button>
      </Gdg>
    )
  },
}

export { ext, isExternal }
