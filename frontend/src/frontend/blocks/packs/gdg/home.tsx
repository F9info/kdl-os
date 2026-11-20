'use client'

// Home page blocks of the GDG chapter site, ported from the GDG Vizag site (index.html + home.js +
// feed.js renderCard / renderTeam): the coast hero with its live card, "Our journey" and Organizers.
import { useEffect, useState } from 'react'
import type { ComponentConfig } from '@puckeditor/core'
import {
  CHAPTER_URL_FALLBACK,
  Gdg,
  MorphShape,
  SHAPES,
  TONES,
  area,
  countdown,
  dateLabel,
  dayOf,
  fmt,
  focus,
  initials,
  lines,
  shapePath,
  spanDays,
  text,
  timeLabel,
  useGdgFeed,
  useGdgTime,
  useNow,
  type GdgEvent,
  type GdgPerson,
  type AnyBlock,
} from './lib'
import { ext } from './chrome'

type Puck = { puck?: { metadata?: Record<string, unknown> } }
const projectOf = (puck: Puck['puck']) => puck?.metadata?.projectId as string | undefined

// ─── Live / Up next card ─────────────────────────────────────────────────────

/** The "Live now / Up next" card (feed.js renderCard). Re-checks every 30 seconds so it flips by itself. */
export function LiveCard({
  events,
  loading,
  chapterUrl,
  quietTitle,
  quietText,
  quietLabel,
  moreHref,
  moreLabel,
  loadingText = 'Checking what is on…',
  id,
}: {
  events: GdgEvent[]
  loading: boolean
  chapterUrl: string
  quietTitle: string
  quietText: string
  quietLabel: string
  moreHref?: string
  moreLabel?: string
  loadingText?: string
  id?: string
}) {
  const now = useNow(30_000)
  if (loading)
    return (
      <div className="live-card" id={id} aria-live="polite">
        <div className="lc-body">
          <b>{loadingText}</b>
        </div>
      </div>
    )
  const { state, e } = focus(events, now)
  if (state === 'none' || !e)
    return (
      <div className="live-card is-none" id={id} aria-live="polite">
        <span className="lc-pill">Nothing scheduled</span>
        <div className="lc-body">
          <b>{quietTitle}</b>
          <span>{quietText}</span>
        </div>
        <div className="lc-actions">
          <a className="btn btn-sm" href={chapterUrl} target="_blank" rel="noopener">
            {quietLabel}
          </a>
        </div>
      </div>
    )
  const multi = spanDays(e) > 1
  const when =
    state === 'live'
      ? `Until ${fmt(e.end, { weekday: 'short', day: 'numeric', month: 'short' })}, ${timeLabel(e.end)}`
      : `${dateLabel(e)}, ${timeLabel(e.start)}`
  return (
    <div className={`live-card is-${state}`} id={id} aria-live="polite">
      {state === 'live' ? (
        <span className="lc-pill">
          <i className="dot"></i>Live now{multi ? `, day ${dayOf(e, now)} of ${spanDays(e)}` : ''}
        </span>
      ) : (
        <span className="lc-pill">Up next, in {countdown(+e.start - +now)}</span>
      )}
      <div className="lc-body">
        <b>{e.title}</b>
        <span>{[when, e.venue, e.type].filter(Boolean).join(', ')}</span>
      </div>
      <div className="lc-actions">
        <a className="btn btn-sm" href={e.url} target="_blank" rel="noopener">
          {state === 'live' ? 'Join now' : 'Register'}
        </a>
        {moreHref ? (
          <a className="btn btn-sm btn-tonal" href={moreHref}>
            {moreLabel || 'Details'}
          </a>
        ) : null}
      </div>
    </div>
  )
}

// ─── Hero ────────────────────────────────────────────────────────────────────

/** Sine wave paths whose period divides 1440, so the drift loops without a seam. */
const wavePath = (periods: number, amp: number) => {
  const pts: string[] = []
  for (let x = 0; x <= 2880; x += 20)
    pts.push(`${x},${(14 + amp * Math.sin((x / 1440) * periods * Math.PI * 2)).toFixed(1)}`)
  return `M0,100L${pts.join('L')}L2880,100Z`
}
const WAVES: [string, number, number][] = [
  ['wave w1', 4, 3.2],
  ['wave w2', 5, 4],
  ['wave w3', 3, 5],
]

type Star = { left: string; top: string; size: string; delay: string }

type HeroProps = {
  eyebrow: string
  title: string
  lead: string
  primaryLabel: string
  primaryHref: string
  secondaryLabel: string
  secondaryHref: string
  buoyText: string
  quietTitle: string
  quietText: string
  quietLabel: string
}

const GdgHero: ComponentConfig<HeroProps> = {
  label: 'GDG Hero (Vizag coast)',
  fields: {
    eyebrow: text('Small line above the title'),
    title: text('Title'),
    lead: area('Intro'),
    primaryLabel: text('Main button'),
    primaryHref: text('Main button link'),
    secondaryLabel: text('Second button'),
    secondaryHref: text('Second button link'),
    buoyText: text('Text on the buoy'),
    quietTitle: text('Live card: title when nothing is scheduled'),
    quietText: text('Live card: text when nothing is scheduled'),
    quietLabel: text('Live card: button when nothing is scheduled'),
  },
  defaultProps: {
    eyebrow: 'Google Developer Groups',
    title: 'GDG Vizag',
    lead: 'Build, create and explore technology by the Vizag seashore. Meet developers, designers and founders, and learn something new every month.',
    primaryLabel: 'Join GDG Vizag',
    primaryHref: 'https://gdg.community.dev/gdg-vizag/',
    secondaryLabel: 'See all events',
    secondaryHref: '/events',
    buoyText: '2026',
    quietTitle: 'No event is on right now',
    quietText: 'New GDG Vizag events are announced on the chapter page first.',
    quietLabel: 'Join to get notified',
  },
  render: function Render({ puck, ...p }: HeroProps & Puck) {
    const time = useGdgTime()
    const { events, chapter, isLoading } = useGdgFeed(projectOf(puck))
    // Random stars are made after mount so server and client markup agree.
    const [stars, setStars] = useState<Star[]>([])
    useEffect(() => {
      setStars(
        Array.from({ length: 60 }, () => {
          const px = 1 + Math.random() * 2
          return {
            left: `${(Math.random() * 100).toFixed(1)}%`,
            top: `${(Math.random() * 100).toFixed(1)}%`,
            size: `${px}px`,
            delay: `${(-Math.random() * 3).toFixed(1)}s`,
          }
        })
      )
    }, [])
    return (
      <Gdg>
        <section className="hero" data-time={time}>
          <div className="stars" aria-hidden="true">
            {stars.map((s, i) => (
              <i
                key={i}
                style={{
                  left: s.left,
                  top: s.top,
                  width: s.size,
                  height: s.size,
                  animationDelay: s.delay,
                }}
              />
            ))}
          </div>
          <div className="hero-copy">
            <p className="presents">{p.eyebrow}</p>
            <h1>{p.title}</h1>
            <p className="lead">{p.lead}</p>
            <LiveCard
              id="live-card"
              events={events}
              loading={isLoading}
              chapterUrl={chapter.url || CHAPTER_URL_FALLBACK}
              quietTitle={p.quietTitle}
              quietText={p.quietText}
              quietLabel={p.quietLabel}
            />
            <div className="cta">
              {p.primaryLabel ? (
                <a className="btn" href={p.primaryHref} {...ext(p.primaryHref)}>
                  {p.primaryLabel}
                </a>
              ) : null}
              {p.secondaryLabel ? (
                <a className="btn btn-tonal" href={p.secondaryHref} {...ext(p.secondaryHref)}>
                  {p.secondaryLabel}
                </a>
              ) : null}
            </div>
          </div>
          <div className="scene" aria-hidden="true">
            <div className="scene-in">
              <div className="sun-wrap">
                <MorphShape className="sun" n={12} amp={0.05} speed={0.5}>
                  <g className="code" transform="translate(0 -48) scale(.85)">
                    <path d="M-20 -30-50 0-20 30" />
                    <path d="M20 -30 50 0 20 30" />
                  </g>
                </MorphShape>
              </div>
              <svg className="land" viewBox="0 0 1440 440">
                <path
                  className="hill1"
                  d="M730 264C830 262 950 118 1080 114C1160 111 1230 142 1300 152C1360 160 1400 152 1440 162V330H730Z"
                />
                <path
                  className="hill2"
                  d="M900 264C990 262 1060 128 1150 128C1240 128 1310 262 1400 264V330H900Z"
                />
                <g className="dark">
                  <rect x="1144" y="86" width="12" height="42" />
                  <path d="M1141 86 1150 72 1159 86Z" />
                  <rect x="1139" y="83" width="22" height="3" />
                </g>
                <path
                  className="hill1"
                  d="M30 264C120 262 200 150 300 150C400 150 480 262 570 264V330H30Z"
                />
                <g className="dark">
                  <path d="M200 179h10l3 26h-16Z" />
                  <path d="M380 174h10l3 28h-16Z" />
                </g>
                <path className="cable" d="M150 211 205 177 385 172 450 211" />
                <g className="cabin">
                  <rect x="290" y="179" width="14" height="10" rx="2" />
                </g>
                <g className="ship" transform="translate(-135 26)">
                  <path className="dark" d="M600 207h118l-14 11H614Z" />
                  <rect x="620" y="195" width="16" height="12" fill="#ea4335" />
                  <rect x="638" y="195" width="16" height="12" fill="#fbbc04" />
                  <rect x="656" y="195" width="16" height="12" fill="#4285f4" />
                  <rect x="638" y="183" width="16" height="12" fill="#34a853" />
                  <rect className="dark" x="690" y="190" width="12" height="17" />
                </g>
              </svg>
              <svg className="beam" viewBox="0 0 1440 440" aria-hidden="true">
                <defs>
                  <linearGradient
                    id="bgrad"
                    gradientUnits="userSpaceOnUse"
                    x1="1150"
                    y1="0"
                    x2="280"
                    y2="0"
                  >
                    <stop offset="0" stopColor="#fff6cf" stopOpacity=".95" />
                    <stop offset="1" stopColor="#fff6cf" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <g className="beam-g">
                  <polygon points="1150,78 280,34 280,122" fill="url(#bgrad)" />
                </g>
                <circle className="lamp" cx="1150" cy="78" r="5" />
              </svg>
              {WAVES.map(([cls, periods, amp]) => (
                <svg key={cls} className={cls} viewBox="0 0 2880 100" preserveAspectRatio="none">
                  <path d={wavePath(periods, amp)} />
                </svg>
              ))}
              <MorphShape className="buoy bo1" n={8} amp={0.07} speed={0.9} />
              <MorphShape className="buoy bo2" n={5} amp={0.16} speed={1.2} dir={-1} phase={1.7}>
                <text y="14">{p.buoyText}</text>
              </MorphShape>
              <MorphShape className="buoy bo3" n={4} amp={0.2} speed={1.0} phase={3.4} />
              <MorphShape className="buoy bo4" n={6} amp={0.12} speed={0.7} dir={-1} phase={5.1} />
            </div>
          </div>
        </section>
      </Gdg>
    )
  },
}

// ─── Our journey ─────────────────────────────────────────────────────────────

const SCORE: [RegExp, number][] = [
  [/launch of the gdg/i, 100],
  [/dev ?fest|developers fest/i, 90],
  [/women|wtm|iwd/i, 70],
  [/i\/?o extended/i, 60],
  [/build ?with ?ai|prompt to product|buildathon|agentic/i, 50],
]
const score = (t: string) => {
  for (const [re, s] of SCORE) if (re.test(t)) return s
  return 10
}

type JourneyProps = { title: string; sub: string; eventsHref: string; membersFallback: string }

const GdgJourney: ComponentConfig<JourneyProps> = {
  label: 'GDG Our Journey',
  fields: {
    title: text('Title'),
    sub: text('Subtitle (replaced by the real history once events load)'),
    eventsHref: text('Events page link (a year card opens it filtered to that year)'),
    membersFallback: text('Member count to show if the chapter has none'),
  },
  defaultProps: {
    title: 'Our journey',
    sub: 'One event at a time, since 2018.',
    eventsHref: '/events',
    membersFallback: '3270',
  },
  render: function Render({ puck, ...p }: JourneyProps & Puck) {
    const { events, chapter, isLoading, isError } = useGdgFeed(projectOf(puck))
    const nowYear = Number(fmt(new Date(), { year: 'numeric' }))
    let sub = p.sub
    let stats: [string, string][] = []
    let years: number[] = []
    const byYear: Record<number, GdgEvent[]> = {}
    if (events.length) {
      const launch = events.find((e) => /launch of the gdg vizag/i.test(e.title))
      const first = launch ?? events[events.length - 1]!
      const members = chapter.members || Number(p.membersFallback) || 0
      const devfests = events.filter(
        (e) => e.cat === 'DevFest' && !/core committee/i.test(e.title)
      ).length
      const sinceYear = fmt(first.start, { year: 'numeric' })
      sub = `From ${launch ? 'the chapter launch on ' + fmt(launch.start, { day: 'numeric', month: 'long', year: 'numeric' }) : 'our first event in ' + sinceYear} to ${events.length} events, one at a time.`
      stats = [
        [members.toLocaleString('en-IN'), 'members'],
        [String(events.length), 'events since ' + sinceYear],
        [String(devfests), 'DevFests'],
      ]
      events.forEach((e) => (byYear[e.year] = byYear[e.year] || []).push(e))
      years = Object.keys(byYear)
        .map(Number)
        .sort((a, b) => b - a)
    }
    return (
      <Gdg>
        <section id="journey" className="block" aria-labelledby="jy-h">
          <h2 id="jy-h">{p.title}</h2>
          <p className="sub" id="jy-sub">
            {sub}
          </p>
          <div className="jy-stats" id="jy-stats">
            {stats.map(([n, l]) => (
              <div key={l} className="jy-stat">
                <strong>{n}</strong>
                <span>{l}</span>
              </div>
            ))}
          </div>
          <div className="jy-scroll">
            <div className="jy-rail" id="jy-rail" role="list" aria-label="Events by year">
              {!isLoading && (isError || !events.length) ? (
                <p className="note">The events feed could not be reached. Try again in a moment.</p>
              ) : null}
              {years.map((y, i) => {
                const list = byYear[y] ?? []
                const top = [...list]
                  .sort((a, b) => score(b.title) - score(a.title) || +a.start - +b.start)
                  .slice(0, 3)
                const [n, amp] = SHAPES[i % 4] ?? [8, 0.07]
                return (
                  <a
                    key={y}
                    className={`jy tone-${TONES[i % 4]}`}
                    href={`${p.eventsHref}?year=${y}`}
                    role="listitem"
                  >
                    <svg className="jy-art" viewBox="-100 -100 200 200" aria-hidden="true">
                      <path d={shapePath(n, amp)} />
                    </svg>
                    <span className="jy-year">{y}</span>
                    <span className="jy-count">
                      {list.length} {list.length === 1 ? 'event' : 'events'}
                      {y === nowYear ? ', so far' : ''}
                    </span>
                    <ul>
                      {top.map((e) => (
                        <li key={e.id}>{e.title.replace(/\s*\(.*?\)\s*$/, '')}</li>
                      ))}
                    </ul>
                  </a>
                )
              })}
            </div>
          </div>
        </section>
      </Gdg>
    )
  },
}

// ─── Organizers ──────────────────────────────────────────────────────────────

type OrganizersProps = {
  title: string
  sub: string
  order: string
  fallback: string
  extra: string
  role: string
}

/** Chapter organizers (feed team), in the editor's order, then any others, then extra people. */
function orderTeam(rows: GdgPerson[], p: OrganizersProps): GdgPerson[] {
  const person = ([name = '', title = '', avatar = '']: string[]): GdgPerson => ({
    name,
    title,
    avatar,
  })
  const fallback = lines(p.fallback, 3).map(person)
  const extra = lines(p.extra, 3).map(person)
  const order = lines(p.order).map(([n = '']) => n)
  const listed = order
    .map((n) => rows.find((m) => m.name === n) || fallback.find((m) => m.name === n))
    .filter((m): m is GdgPerson => !!m)
  const others = rows.filter((m) => !order.includes(m.name))
  const base = rows.length ? [...listed, ...others] : listed.length ? listed : fallback
  return [...base, ...extra]
}

const GdgOrganizers: ComponentConfig<OrganizersProps> = {
  label: 'GDG Organizers',
  fields: {
    title: text('Title'),
    sub: text('Subtitle'),
    order: area('Shown first, in this order (one full name per line)'),
    fallback: area('Used when the chapter page cannot be read ("Name | Title" per line)'),
    extra: area('Extra people not on the chapter page ("Name | Title | photo URL" per line)'),
    role: text('Line on every card'),
  },
  defaultProps: {
    title: 'Organizers',
    sub: 'The people who run GDG Vizag.',
    order: 'Usha Ramani Vemuru\nSatish K\nSampath Balivada',
    fallback:
      'Usha Ramani Vemuru | Co-Founder\nSatish K | Managing Director\nSampath Balivada | Software Engineer',
    extra: '',
    role: 'Organizer, GDG Vizag',
  },
  render: function Render({ puck, ...p }: OrganizersProps & Puck) {
    const { team, isLoading } = useGdgFeed(projectOf(puck))
    const people = isLoading ? [] : orderTeam(team, p)
    return (
      <Gdg>
        <section id="team" className="block" aria-labelledby="team-h">
          <h2 id="team-h">{p.title}</h2>
          <p className="sub">{p.sub}</p>
          <div className="people" id="people">
            {people.map((m, i) => {
              const [n, amp] = SHAPES[i % 3] ?? [8, 0.07]
              const d = shapePath(n, amp)
              return (
                <article
                  key={m.name + i}
                  className={`person tone-${['blue', 'green', 'yellow'][i % 3]}`}
                >
                  {m.avatar ? (
                    <svg
                      className="person-art"
                      viewBox="-110 -110 220 220"
                      role="img"
                      aria-label={m.name}
                    >
                      <clipPath id={`pc${i}`}>
                        <path d={d} />
                      </clipPath>
                      <path d={d} transform="scale(1.07)" fill="var(--c-shape)" />
                      <image
                        href={m.avatar}
                        x="-100"
                        y="-100"
                        width="200"
                        height="200"
                        preserveAspectRatio="xMidYMid slice"
                        clipPath={`url(#pc${i})`}
                      />
                    </svg>
                  ) : (
                    <svg
                      className="person-art"
                      viewBox="-110 -110 220 220"
                      role="img"
                      aria-label={m.name}
                    >
                      <path d={d} fill="var(--c-shape)" />
                      <text y="22" textAnchor="middle" fontSize="64" fontWeight="800" fill="#fff">
                        {initials(m.name)}
                      </text>
                    </svg>
                  )}
                  <div>
                    <h3>{m.name}</h3>
                    <p>{m.title}</p>
                    <span className="role">{p.role}</span>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      </Gdg>
    )
  },
}

export const homeComponents: Record<string, AnyBlock> = {
  GdgHero,
  GdgJourney,
  GdgOrganizers,
}
