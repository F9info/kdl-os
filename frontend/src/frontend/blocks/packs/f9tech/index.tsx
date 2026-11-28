/* eslint-disable @next/next/no-img-element */
'use client'

// "F9 Tech" block pack: the f9tech.com website, as page blocks. Nothing is fixed in the components:
// text, images and lists come from block props (saved in the page), the header and footer navigation from
// the Menus module, and the company details, logo, copyright and social links from Application Identity.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import type { ComponentPack } from '../types'
import { imageField } from '../image-field'
import { useHeaderMenuTree, type HeaderMenuItem } from '../header-nav-menu'
import { useIdentity } from '@/hooks/useIdentity'
import { safeHref } from '@/frontend/lib/safe-href'
import s from './f9tech.module.css'

type Puck = { puck?: { metadata?: Record<string, unknown>; isEditing?: boolean } }
// Block props are all strings (lists are line-based text); `puck` is added by the editor. A string index
// signature cannot also hold `puck`, hence the loose type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P = Record<string, any>

const lines = (raw?: string) =>
  (raw ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
const rows = (raw: string | undefined, min = 1) =>
  lines(raw)
    .map((l) => l.split(' | ').map((x) => x.trim()))
    .filter((r) => r.length >= min)
const list = (raw?: string) =>
  (raw ?? '')
    .split(' ; ')
    .map((x) => x.trim())
    .filter(Boolean)
const projectOf = (p: Puck) => p.puck?.metadata?.projectId as string | undefined
const isExternal = (u: string) => /^https?:\/\//i.test(u)

function A({
  href,
  children,
  className,
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  const ext = isExternal(href)
  return (
    <a
      href={safeHref(href || '#')}
      className={className}
      {...(ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  )
}

// The website's own colours: the Theme Engine "webapp" theme of the project (Frontend > Color Palette).
// The admin app that previews and serves the site has its own theme loaded on the page, so the blocks ask
// for the website theme themselves and apply the two brand colours to their own wrapper.
const BRAND_VARS = [
  '--branding_brand_colors_primary_color',
  '--branding_brand_colors_secondary_color',
] as const
function cssVar(css: string, name: string): string | undefined {
  const light = css.match(/\[data-theme="light"\]\s*\{([^}]*)\}/)?.[1] ?? css
  return light.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim()
}
function useWebsiteColours(projectId?: string): CSSProperties {
  const { data } = useQuery({
    queryKey: ['website-theme', projectId ?? null],
    queryFn: () =>
      fetch(
        `/api/theme-engine/tokens?platform=webapp${projectId ? `&project_id=${projectId}` : ''}`
      )
        .then((r) => r.json())
        .then((j) => (j?.data?.css as string | undefined) ?? ''),
    staleTime: 60_000,
  })
  const style: Record<string, string> = {}
  if (data)
    for (const v of BRAND_VARS) {
      const val = cssVar(data, v)
      if (val) style[v] = val
    }
  return style as CSSProperties
}

function Wrap({ children }: { children: ReactNode }) {
  const style = useWebsiteColours(process.env.NEXT_PUBLIC_SITE_PROJECT_ID || undefined)
  return (
    <div className={s.root} style={style}>
      {children}
    </div>
  )
}

function SectionTitle({ title, sub }: { title?: string; sub?: string }) {
  if (!title && !sub) return null
  return (
    <div className={s.stRow}>
      <h2 className={`${s.stTitle} ${s.heading}`}>{title}</h2>
      <p className={s.stSub}>{sub}</p>
    </div>
  )
}

// ── Header ──────────────────────────────────────────────────────────────────
function MenuItems({ items, ctaLast }: { items: HeaderMenuItem[]; ctaLast: boolean }) {
  return (
    <>
      {items.map((it, i) => {
        const isCta = ctaLast && i === items.length - 1
        const label = it.no_page ? (
          <span>{it.label}</span>
        ) : (
          <A href={it.url ?? '#'} className={isCta ? s.btnLink : undefined}>
            {it.label}
          </A>
        )
        return (
          <li key={it.id}>
            {label}
            {it.children?.length > 0 && (
              <div className={s.sub}>
                {it.children.map((c) => (
                  <A key={c.id} href={c.url ?? '#'}>
                    {c.label}
                  </A>
                ))}
              </div>
            )}
          </li>
        )
      })}
    </>
  )
}

function F9HeaderView(p: P) {
  const { identity } = useIdentity()
  const tree = useHeaderMenuTree(
    projectOf(p) ?? (process.env.NEXT_PUBLIC_SITE_PROJECT_ID || undefined),
    'header'
  )
  const [open, setOpen] = useState(false)
  const fallback: HeaderMenuItem[] = rows(p.links, 2).map(([label, href], i) => ({
    id: `l${i}`,
    label: label!,
    url: href!,
    open_in_new_tab: false,
    children: [],
  }))
  const items = tree ?? fallback
  const logo = p.logoUrl || identity.logo_light || '/seed/f9tech/logo.svg'
  const ctaLast = p.ctaLast !== 'false'
  return (
    <Wrap>
      <header className={s.header}>
        <div className={`${s.container} ${s.headerRow}`}>
          <Link href="/" className={s.logo}>
            <img src={logo} alt={identity.company_name || 'Logo'} />
          </Link>
          <ul className={s.nav}>
            <MenuItems items={items} ctaLast={ctaLast} />
          </ul>
          <button className={s.burger} aria-label="Menu" onClick={() => setOpen((o) => !o)}>
            {open ? '✕' : '☰'}
          </button>
        </div>
        {open && (
          <nav className={s.drawer}>
            {items.map((it) => (
              <A key={it.id} href={it.url ?? '#'}>
                {it.label}
              </A>
            ))}
          </nav>
        )}
      </header>
    </Wrap>
  )
}

// ── Footer ──────────────────────────────────────────────────────────────────
function F9FooterView(p: P) {
  const { identity } = useIdentity()
  const tree = useHeaderMenuTree(
    projectOf(p) ?? (process.env.NEXT_PUBLIC_SITE_PROJECT_ID || undefined),
    'footer'
  )
  const bottomLabel = (p.bottomMenuLabel || '').toLowerCase()
  const cols = (tree ?? []).filter((i) => i.label.toLowerCase() !== bottomLabel)
  const legal = (tree ?? []).find((i) => i.label.toLowerCase() === bottomLabel)?.children ?? []
  const socials = rows(p.socials, 3)
  const extra = rows(p.bottomLinks, 2)
  const logos = rows(p.partnerLogos, 3)
  const badges = rows(p.badges, 2)
  const logo = p.logoUrl || identity.logo_light || '/seed/f9tech/logo.svg'
  const phone = identity.contact_phone
  const copyright = identity.copyright
  return (
    <Wrap>
      <footer className={s.footer}>
        <div className={s.ftTop}>
          <div className={`${s.container} ${s.ftTopRow}`}>
            <Link href="/" className={s.ftLogoCircle}>
              <img src={logo} alt={identity.company_name || 'Logo'} />
            </Link>
            <ul className={s.ftSocial}>
              {socials.map(([label, href, icon]) => (
                <li key={label}>
                  <A href={href!}>
                    <img src={icon} alt={label} />
                  </A>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className={s.ftMiddle}>
          {p.decoImage && <img className={s.ftDeco1} src={p.decoImage} alt="" />}
          {p.decoImage && <img className={s.ftDeco2} src={p.decoImage} alt="" />}
          <div className={s.container}>
            <div className={s.ftCols}>
              {cols.map((c) => (
                <div key={c.id}>
                  <p className={s.ftTitle}>{c.label}</p>
                  <ul>
                    {c.children.map((ch) => (
                      <li key={ch.id}>
                        <A href={ch.url ?? '#'}>{ch.label}</A>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div>
                {phone && (
                  <A href={`tel:${phone.replace(/[^+\d]/g, '')}`} className={s.ftPhone}>
                    {phone}
                  </A>
                )}
                {identity.contact_email && (
                  <A href={`mailto:${identity.contact_email}`} className={s.ftMail}>
                    {identity.contact_email}
                  </A>
                )}
                {identity.contact_address && (
                  <div className={s.ftAddr}>{identity.contact_address}</div>
                )}
              </div>
            </div>
            <div className={s.ftBottom}>
              <div className={s.ftLogos}>
                {logos.map(([name, img, href]) => (
                  <A key={name} href={href!}>
                    <img src={img} alt={name} />
                  </A>
                ))}
              </div>
              <div>
                <div className={s.ftCopy}>{copyright}</div>
                <div className={s.ftLinks}>
                  {legal.map((l) => (
                    <A key={l.id} href={l.url ?? '#'}>
                      {l.label}
                    </A>
                  ))}
                  {extra.map(([label, href]) => (
                    <A key={label} href={href!}>
                      {label}
                    </A>
                  ))}
                </div>
              </div>
              <div className={s.ftBadges}>
                {badges.map(([img, href]) => (
                  <A key={img} href={href!}>
                    <img src={img} alt="" />
                  </A>
                ))}
              </div>
            </div>
          </div>
        </div>
      </footer>
    </Wrap>
  )
}

// ── Home blocks ─────────────────────────────────────────────────────────────
function F9HeroView(p: P) {
  return (
    <Wrap>
      <section className={s.hero}>
        <div className={`${s.container} ${s.heroGrid}`}>
          <div>
            <h1 className={s.heroLead}>{p.lead}</h1>
            {p.imageIdea ? (
              <img className={s.heroIdea} src={p.imageIdea} alt={p.highlight} />
            ) : (
              <h2 className={s.heading}>{p.highlight}</h2>
            )}
            <p className={s.heroText}>{p.text}</p>
          </div>
          <div className={s.heroPic}>{p.image && <img src={p.image} alt="" />}</div>
        </div>
      </section>
    </Wrap>
  )
}

function F9WelcomeView(p: P) {
  return (
    <Wrap>
      <section className={s.welcome}>
        <div className={`${s.container} ${s.welcomeGrid}`}>
          <div className={s.welcomeCircle}>
            {p.counterValue ? (
              <>
                <span className={s.counter}>{p.counterValue}</span>
                <span className={s.counterLabel}>{p.counterLabel}</span>
              </>
            ) : (
              p.image && <img src={p.image} alt="" />
            )}
          </div>
          <div>
            <h3 className={`${s.welcomeTitle} ${s.heading}`}>{p.title}</h3>
            <p className={s.welcomeText}>{p.text}</p>
          </div>
        </div>
      </section>
    </Wrap>
  )
}

function F9ServiceCardsView(p: P) {
  const cards = rows(p.cards, 2)
  return (
    <Wrap>
      <section className={`${s.section} ${s.bgGrey}`}>
        <div className={s.container}>
          <SectionTitle title={p.title || p.eyebrow} sub={p.subtitle} />
          <div className={s.cards4}>
            {cards.map(([title, body, image]) => (
              <A key={title} href={p.cardsHref || '/services'} className={s.svcCard}>
                <div className={s.svcIcon}>{image && <img src={image} alt="" />}</div>
                <h4 className={`${s.svcTitle} ${s.heading}`}>{title}</h4>
                <p className={s.svcBody}>{body}</p>
              </A>
            ))}
          </div>
        </div>
      </section>
    </Wrap>
  )
}

function F9ExpertiseView(p: P) {
  return (
    <Wrap>
      <section className={s.section}>
        <div className={s.container}>
          <SectionTitle title={p.title} sub={p.subtitle} />
          <div className={s.expertise}>
            {rows(p.items, 1).map(([name, image]) => (
              <div key={name} className={s.expItem}>
                {image && <img src={image} alt={name} />}
                <p>{name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Wrap>
  )
}

function F9ProcessView(p: P) {
  return (
    <Wrap>
      <section className={`${s.section} ${s.bgGrey}`}>
        <div className={s.container}>
          <SectionTitle title={p.title} sub={p.subtitle} />
          <div className={s.processGrid}>
            {p.image && <img src={p.image} alt="" />}
            <div className={s.cards4in}>
              {rows(p.steps, 2).map(([title, body, image]) => (
                <div key={title} className={s.prCard}>
                  <div className={s.prIcon}>{image && <img src={image} alt="" />}</div>
                  <h5 className={`${s.prTitle} ${s.heading}`}>{title}</h5>
                  <p className={s.prBody}>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </Wrap>
  )
}

function F9BusinessModelView(p: P) {
  const models = rows(p.models, 2)
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused || models.length < 2) return
    const t = setInterval(() => setActive((a) => (a + 1) % models.length), 3500)
    return () => clearInterval(t)
  }, [paused, models.length])
  return (
    <Wrap>
      <section className={s.section}>
        <div className={s.container}>
          <SectionTitle title={p.title} sub={p.subtitle} />
          <div
            className={s.bmGrid}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <div>
              {models.map(([title, body], i) => (
                <div
                  key={title}
                  className={`${s.bmItem} ${i === active ? s.bmActive : ''}`}
                  onClick={() => setActive(i)}
                >
                  <h4 className={s.heading}>{title}</h4>
                  <p>{body}</p>
                </div>
              ))}
            </div>
            <div className={s.bmImg}>
              {models[active]?.[2] && <img src={models[active]![2]} alt={models[active]![0]} />}
            </div>
          </div>
        </div>
      </section>
    </Wrap>
  )
}

function F9LetsDiscussView(p: P) {
  return (
    <Wrap>
      <div className={s.discussWrap}>
        <div className={s.discuss}>
          <div>
            <h3 className={s.heading}>{p.title}</h3>
            <p>{p.text}</p>
          </div>
          <A href={p.ctaHref || '/contact'} className={`${s.btn} ${s.btnPill}`}>
            {p.ctaLabel}
          </A>
        </div>
      </div>
    </Wrap>
  )
}

function F9PortfolioView(p: P) {
  const items = rows(p.items, 2)
  const [i, setI] = useState(0)
  useEffect(() => {
    if (items.length < 2) return
    const t = setInterval(() => setI((x) => (x + 1) % items.length), 10000)
    return () => clearInterval(t)
  }, [items.length])
  const cur = items[i]
  const go = (d: number) => setI((x) => (x + d + items.length) % items.length)
  return (
    <Wrap>
      <section className={s.pfSection}>
        <div className={`${s.container} ${s.pfInner}`}>
          <h2 className={`${s.pfHead} ${s.heading}`}>{p.title}</h2>
          {cur && (
            <div className={s.pfGrid}>
              <div className={s.pfText}>
                <h3 className={s.heading}>{cur[0]}</h3>
                <p>{cur[1]}</p>
                <div className={s.pfArrows}>
                  <button aria-label="Previous" onClick={() => go(-1)}>
                    <img src={p.arrowLeft || '/seed/f9tech/arrow_left_alt.svg'} alt="" />
                  </button>
                  <button aria-label="Next" onClick={() => go(1)}>
                    <img src={p.arrowRight || '/seed/f9tech/arrow_right_alt.svg'} alt="" />
                  </button>
                </div>
              </div>
              <div className={s.pfShot}>
                {cur[2] && <img className={s.pfWeb} src={cur[2]} alt={cur[0]} />}
                {cur[4] && <img className={s.pfMobile} src={cur[4]} alt="" />}
              </div>
            </div>
          )}
        </div>
      </section>
    </Wrap>
  )
}

function F9BlogTeasersView(p: P) {
  return (
    <Wrap>
      <section className={s.section}>
        <div className={s.container}>
          <SectionTitle title={p.eyebrow} sub={p.title} />
          <div className={s.blogGrid}>
            {rows(p.items, 2).map(([title, body, href, image]) => (
              <article key={title} className={s.blogCard}>
                {image && <img src={image} alt="" />}
                <div className={s.blogBody}>
                  <h5 className={s.heading}>{title}</h5>
                  <p>{body}</p>
                  <A href={href || '#'} className={`${s.btn} ${s.btnOutline} ${s.blogMore}`}>
                    {p.moreLabel || 'Read More'}
                  </A>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </Wrap>
  )
}

// ── Inner pages ─────────────────────────────────────────────────────────────
function F9PageBannerView(p: P) {
  const [first, ...rest] = (p.title ?? '').split(' / ')
  return (
    <Wrap>
      <section className={s.banner}>
        <div className={`${s.container} ${s.bannerGrid}`}>
          <div>
            <h1 className={`${s.bannerTitle} ${s.heading}`}>
              {first}
              {rest.length > 0 && (
                <span className="accent" style={{ display: 'block', color: 'var(--f9-primary)' }}>
                  {rest.join(' ')}
                </span>
              )}
            </h1>
            <p className={`${s.bannerText} ${s.flex}`}>{p.text}</p>
          </div>
          <div className={s.bannerImg}>{p.image && <img src={p.image} alt="" />}</div>
        </div>
      </section>
    </Wrap>
  )
}

function F9AboutView(p: P) {
  const values = lines(p.values)
  const half = Math.ceil(values.length / 2)
  return (
    <Wrap>
      <section className={s.aboutSection}>
        <div className={s.container}>
          <div className={`${s.aCard} ${s.aCard1}`}>
            <p>{p.intro1}</p>
            {p.image && <img src={p.image} alt="" />}
          </div>
          <div className={`${s.aCard} ${s.aCard2}`}>
            {p.image2 && <img src={p.image2} alt="" />}
            <p>{p.intro2}</p>
          </div>
          {p.intro3 && (
            <div className={`${s.aCard} ${s.aCard1}`}>
              <p>{p.intro3}</p>
            </div>
          )}
          <div className={`${s.aCard} ${s.aCard3}`}>
            <ul className={s.aList}>
              {values.slice(0, half).map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
            {p.image3 && <img src={p.image3} alt="" />}
            <ul className={s.aList}>
              {values.slice(half).map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </Wrap>
  )
}

function F9StatsView(p: P) {
  return (
    <Wrap>
      <div className={s.container}>
        <div className={s.stats}>
          {rows(p.items, 2).map(([label, value]) => (
            <div key={label} className={s.stat}>
              <span>{label}</span>
              <strong className={s.heading}>{value}</strong>
            </div>
          ))}
        </div>
      </div>
    </Wrap>
  )
}

function F9SolutionsView(p: P) {
  return (
    <Wrap>
      <section className={s.solutions}>
        <div className={s.container}>
          <h1 className={s.heading}>{p.title}</h1>
          {rows(p.items, 2).map(([title, body, image, reverse, href]) => (
            <div key={title} className={`${s.solRow} ${reverse === 'true' ? s.solRowRev : ''}`}>
              <div className={s.solImg}>{image && <img src={image} alt={title} />}</div>
              <div className={s.solText}>
                <h2 className={s.heading}>{href ? <A href={href}>{title}</A> : title}</h2>
                <p>{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </Wrap>
  )
}

function F9ServicesListView(p: P) {
  return (
    <Wrap>
      <div className={s.container}>
        <div className={s.svList}>
          {rows(p.items, 1).map(([title, image, links]) => (
            <div key={title} className={s.svCard}>
              <h3 className={s.heading}>{title}</h3>
              <ul>
                {list(links).map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              {image && <img src={image} alt="" />}
            </div>
          ))}
        </div>
      </div>
    </Wrap>
  )
}

interface PublicForm {
  fields: { key: string; type: string; label: string; required?: boolean }[]
  submit_label: string
  success_message: string
}

// The form itself (fields, required flags, success message) is the Forms module's `formSlug`; this only draws
// it the f9tech way: first fields side by side (halfKeys), the rest full width, labels as placeholders.
function F9ContactView(p: P) {
  const slug = p.formSlug || 'contact'
  const readOnly = Boolean(p.puck?.isEditing)
  const { data: form } = useQuery({
    queryKey: ['public-form', slug],
    queryFn: async () => {
      const r = await fetch(`/api/forms/public/${encodeURIComponent(slug)}`)
      if (!r.ok) throw new Error('not found')
      return (await r.json()).data.form as PublicForm
    },
    retry: false,
  })
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle')
  const [message, setMessage] = useState('')
  const half = new Set((p.halfKeys || 'name,email').split(',').map((x: string) => x.trim()))
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (readOnly) return
    setStatus('sending')
    const answers = Object.fromEntries(new FormData(e.currentTarget).entries())
    try {
      const r = await fetch(`/api/forms/public/${encodeURIComponent(slug)}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answers),
      })
      const json = await r.json()
      if (r.ok) {
        setMessage(json.data.message)
        setStatus('done')
        return
      }
      setMessage(r.status === 429 ? 'Too many attempts. Please try again later.' : json.message)
    } catch {
      setMessage('Could not send. Please try again.')
    }
    setStatus('idle')
  }
  return (
    <Wrap>
      <div className={s.contact}>
        <h1 className={s.pageTitle}>{p.title}</h1>
        {!form ? null : status === 'done' ? (
          <p role="status" className={s.ok}>
            {message}
          </p>
        ) : (
          <form onSubmit={submit} noValidate>
            <div className={s.formGrid}>
              {form.fields.map((f) => (
                <div key={f.key} className={`${s.field} ${half.has(f.key) ? '' : s.full}`}>
                  {f.type === 'textarea' ? (
                    <textarea
                      name={f.key}
                      rows={4}
                      placeholder={f.label + (f.required ? ' *' : '')}
                      required={f.required}
                    />
                  ) : (
                    <input
                      name={f.key}
                      type={f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : 'text'}
                      placeholder={f.label + (f.required ? ' *' : '')}
                      required={f.required}
                    />
                  )}
                </div>
              ))}
            </div>
            {message && status === 'idle' && (
              <p className={s.ok} style={{ color: '#b3261e' }}>
                {message}
              </p>
            )}
            <div className={s.submit}>
              <button type="submit" disabled={status === 'sending'}>
                {form.submit_label || 'Submit'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Wrap>
  )
}

function F9LegalView(p: P) {
  return (
    <Wrap>
      <div className={s.legal}>
        <h1 className={s.heading}>{p.title}</h1>
        {p.effectiveDate && <div className={s.legalDate}>{p.effectiveDate}</div>}
        {lines(p.body).map((l, i) =>
          l.startsWith('## ') ? (
            <h2 key={i} className={s.heading}>
              {l.slice(3)}
            </h2>
          ) : l.startsWith('- ') ? (
            <li key={i}>{l.slice(2)}</li>
          ) : (
            <p key={i}>{l}</p>
          )
        )}
      </div>
    </Wrap>
  )
}

function F9SitemapView(p: P) {
  return (
    <Wrap>
      <div className={s.legal}>
        <h1 className={s.heading}>{p.title}</h1>
        {p.subtitle && <div className={s.legalDate}>{p.subtitle}</div>}
        <div className={s.sitemapGrid}>
          {rows(p.groups, 2).map(([group, links]) => (
            <div key={group}>
              <h6 className={s.heading}>{group}</h6>
              {list(links).map((l) => {
                const [label, href] = l.split('=')
                return (
                  <A key={l} href={href || '#'}>
                    {label}
                  </A>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </Wrap>
  )
}

// ── Pack definition ─────────────────────────────────────────────────────────
const t = (label?: string) => ({ type: 'text' as const, label })
const ta = (label?: string) => ({ type: 'textarea' as const, label })
// Image field with its label on the field itself, so screens that list a block's settings can name it.
const img = (label: string) => ({ ...imageField(label), label })

const comps = {
  F9Header: {
    label: 'F9 Header',
    fields: {
      logoUrl: img('Logo (empty = company logo)'),
      ctaLast: {
        type: 'select',
        label: 'Last menu item',
        options: [
          { label: 'Last item is a button', value: 'true' },
          { label: 'Plain links', value: 'false' },
        ],
      },
      links: ta('Fallback links (Label | /href)'),
    },
    defaultProps: { logoUrl: '', ctaLast: 'true', links: '' },
    render: (p: P) => <F9HeaderView {...p} />,
  },
  F9Footer: {
    label: 'F9 Footer',
    fields: {
      logoUrl: img('Logo (empty = company logo)'),
      bottomMenuLabel: t('Footer menu group shown in the bottom bar'),
      socials: ta('Social links (Label | link | icon)'),
      partnerLogos: ta('Partner logos (Name | image | link)'),
      badges: ta('Badges (image | link)'),
      bottomLinks: ta('Extra bottom links (Label | link)'),
      decoImage: img('Decoration image'),
    },
    defaultProps: {
      logoUrl: '',
      bottomMenuLabel: 'Legal',
      socials: '',
      partnerLogos: '',
      badges: '',
      bottomLinks: '',
      decoImage: '',
    },
    render: (p: P) => <F9FooterView {...p} />,
  },
  F9Hero: {
    label: 'F9 Hero',
    fields: {
      lead: t('Lead line'),
      highlight: t('Highlight word'),
      imageIdea: img('Highlight image'),
      text: ta('Text'),
      image: img('Illustration'),
    },
    defaultProps: { lead: '', highlight: '', imageIdea: '', text: '', image: '' },
    render: (p: P) => <F9HeroView {...p} />,
  },
  F9Welcome: {
    label: 'F9 Welcome',
    fields: {
      counterValue: t('Counter value'),
      counterLabel: t('Counter label'),
      image: img('Image'),
      title: t('Title'),
      text: ta('Text'),
    },
    defaultProps: { counterValue: '', counterLabel: '', image: '', title: '', text: '' },
    render: (p: P) => <F9WelcomeView {...p} />,
  },
  F9ServiceCards: {
    label: 'F9 Service cards',
    fields: {
      eyebrow: t('Eyebrow'),
      title: t('Title'),
      subtitle: t('Subtitle'),
      cardsHref: t('Card link'),
      cards: ta('Cards (Title | Text | Icon | Bullets ; …)'),
    },
    defaultProps: { eyebrow: '', title: '', subtitle: '', cardsHref: '/services', cards: '' },
    render: (p: P) => <F9ServiceCardsView {...p} />,
  },
  F9Expertise: {
    label: 'F9 Expertise',
    fields: { title: t('Title'), subtitle: t('Subtitle'), items: ta('Items (Name | Icon)') },
    defaultProps: { title: '', subtitle: '', items: '' },
    render: (p: P) => <F9ExpertiseView {...p} />,
  },
  F9Process: {
    label: 'F9 Development process',
    fields: {
      title: t('Title'),
      subtitle: t('Subtitle'),
      image: img('Illustration'),
      steps: ta('Steps (Title | Text | Icon)'),
    },
    defaultProps: { title: '', subtitle: '', image: '', steps: '' },
    render: (p: P) => <F9ProcessView {...p} />,
  },
  F9BusinessModel: {
    label: 'F9 Business model',
    fields: {
      title: t('Title'),
      subtitle: t('Subtitle'),
      models: ta('Models (Title | Text | Image)'),
    },
    defaultProps: { title: '', subtitle: '', models: '' },
    render: (p: P) => <F9BusinessModelView {...p} />,
  },
  F9LetsDiscuss: {
    label: 'F9 Let’s discuss',
    fields: {
      title: t('Title'),
      text: t('Text'),
      ctaLabel: t('Button label'),
      ctaHref: t('Button link'),
    },
    defaultProps: { title: '', text: '', ctaLabel: '', ctaHref: '/contact' },
    render: (p: P) => <F9LetsDiscussView {...p} />,
  },
  F9Portfolio: {
    label: 'F9 Portfolio',
    fields: {
      title: t('Title'),
      subtitle: t('Subtitle'),
      arrowLeft: img('Previous arrow'),
      arrowRight: img('Next arrow'),
      items: ta('Items (Title | Text | Web image | Link | Mobile image)'),
    },
    defaultProps: { title: '', subtitle: '', arrowLeft: '', arrowRight: '', items: '' },
    render: (p: P) => <F9PortfolioView {...p} />,
  },
  F9BlogTeasers: {
    label: 'F9 Blog teasers',
    fields: {
      eyebrow: t('Eyebrow'),
      title: t('Title'),
      moreLabel: t('Button label'),
      items: ta('Posts (Title | Text | Link | Image)'),
    },
    defaultProps: { eyebrow: '', title: '', moreLabel: 'Read More', items: '' },
    render: (p: P) => <F9BlogTeasersView {...p} />,
  },
  F9PageBanner: {
    label: 'F9 Page banner',
    fields: {
      title: t('Title (use " / " for the coloured second part)'),
      text: ta('Text'),
      image: img('Image'),
    },
    defaultProps: { title: '', text: '', image: '' },
    render: (p: P) => <F9PageBannerView {...p} />,
  },
  F9About: {
    label: 'F9 About',
    fields: {
      intro1: ta('Paragraph 1'),
      intro2: ta('Paragraph 2'),
      intro3: ta('Paragraph 3'),
      valuesTitle: t('Values title'),
      values: ta('Values (one per line)'),
      image: img('Image 1'),
      image2: img('Image 2'),
      image3: img('Image 3'),
    },
    defaultProps: {
      intro1: '',
      intro2: '',
      intro3: '',
      valuesTitle: '',
      values: '',
      image: '',
      image2: '',
      image3: '',
    },
    render: (p: P) => <F9AboutView {...p} />,
  },
  F9Stats: {
    label: 'F9 Stats',
    fields: { items: ta('Stats (Label | Value)') },
    defaultProps: { items: '' },
    render: (p: P) => <F9StatsView {...p} />,
  },
  F9Solutions: {
    label: 'F9 Solutions',
    fields: {
      title: t('Title'),
      subtitle: t('Subtitle'),
      items: ta('Solutions (Title | Text | Image | reverse true/false | Link)'),
    },
    defaultProps: { title: '', subtitle: '', items: '' },
    render: (p: P) => <F9SolutionsView {...p} />,
  },
  F9ServicesList: {
    label: 'F9 Services list',
    fields: { items: ta('Services (Title | Icon | Item ; Item ; …)') },
    defaultProps: { items: '' },
    render: (p: P) => <F9ServicesListView {...p} />,
  },
  F9Contact: {
    label: 'F9 Contact',
    fields: {
      title: t('Title'),
      formSlug: t('Form (Forms module slug)'),
      halfKeys: t('Fields shown side by side (field keys, comma separated)'),
    },
    defaultProps: { title: '', formSlug: 'contact', halfKeys: 'name,email' },
    render: (p: P) => <F9ContactView {...p} />,
  },
  F9Legal: {
    label: 'F9 Legal text',
    fields: {
      title: t('Title'),
      effectiveDate: t('Effective date'),
      body: ta('Text (## heading, - item, plain paragraph)'),
    },
    defaultProps: { title: '', effectiveDate: '', body: '' },
    render: (p: P) => <F9LegalView {...p} />,
  },
  F9Sitemap: {
    label: 'F9 Sitemap',
    fields: {
      title: t('Title'),
      subtitle: t('Subtitle'),
      groups: ta('Groups (Title | Label=link ; Label=link)'),
    },
    defaultProps: { title: '', subtitle: '', groups: '' },
    render: (p: P) => <F9SitemapView {...p} />,
  },
}

export const f9tech: ComponentPack = {
  key: 'f9tech',
  label: 'F9 Tech',
  components: comps as unknown as ComponentPack['components'],
  categories: {
    f9tech: {
      title: 'F9 Tech',
      components: Object.keys(comps).filter((k) => !['F9Header', 'F9Footer'].includes(k)),
    },
    header: { title: 'Header', components: ['F9Header'] },
    bottombar: { title: 'Footer', components: ['F9Footer'] },
  },
}
