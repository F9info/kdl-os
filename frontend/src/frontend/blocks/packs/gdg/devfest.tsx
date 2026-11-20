'use client'

// DevFest Overview + Program blocks, ported from the GDG Vizag site (devfest/index.html + devfest.js +
// sync.js, devfest/program.html + program.js). Same markup and classes, so gdg.css styles them as before.
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react'
import type { ComponentConfig } from '@puckeditor/core'
import {
  CHAPTER_URL_FALLBACK,
  COLORS,
  CountUp,
  Gdg,
  MorphShape,
  SHAPES,
  area,
  countdown,
  dateLabel,
  dayKey,
  dayOf,
  fmt,
  focus,
  initials,
  lines,
  prefersReducedMotion,
  sfx,
  shapePath,
  spanDays,
  status,
  text,
  timeLabel,
  useGdgFeed,
  useNow,
  type GdgEvent,
  type AnyBlock,
} from './lib'
import { ext } from './chrome'

type Puck = { puck?: { metadata?: Record<string, unknown> } }
const projectOf = (puck: Puck['puck']) => puck?.metadata?.projectId as string | undefined
const vars = (v: Record<string, string>) => v as CSSProperties

/** "Text with a [link](https://…)" → nodes. Only http(s) and site paths become links. */
function linkify(source: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\[([^\]]+)\]\(([^)\s]+)\)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(source))) {
    if (m.index > last) out.push(source.slice(last, m.index))
    const href = m[2] ?? ''
    out.push(
      /^(https?:\/\/|\/)/i.test(href) ? (
        <a key={i++} href={href} {...ext(href)}>
          {m[1] ?? ''}
        </a>
      ) : (
        (m[1] ?? '')
      )
    )
    last = re.lastIndex
  }
  if (last < source.length) out.push(source.slice(last))
  return out
}

/** The chapter's DevFests (newest first) and the live or next one, as sync.js worked them out. */
function useDevfests(projectId?: string) {
  const feed = useGdgFeed(projectId)
  const devfests = useMemo(
    () => feed.events.filter((e) => e.cat === 'DevFest' && !/core committee/i.test(e.title)),
    [feed.events]
  )
  const next = useMemo(() => focus(devfests).e, [devfests])
  return { ...feed, devfests, next, chapterUrl: feed.chapter.url || CHAPTER_URL_FALLBACK }
}

// ─── Live card (FEED.renderCard) ─────────────────────────────────────────────

function LiveCard({
  list,
  loading,
  loadingText,
  quietTitle,
  quietText,
  quietButton,
  chapterUrl,
  ticketUrl,
}: {
  list: GdgEvent[]
  loading: boolean
  loadingText: string
  quietTitle: string
  quietText: string
  quietButton: string
  chapterUrl: string
  ticketUrl?: string
}) {
  const now = useNow(30_000)
  if (loading)
    return (
      <div className="live-card" aria-live="polite">
        <div className="lc-body">
          <b>{loadingText}</b>
        </div>
      </div>
    )
  const { state, e } = focus(list, now)
  if (state === 'none' || !e)
    return (
      <div className="live-card is-none" aria-live="polite">
        <span className="lc-pill">Nothing scheduled</span>
        <div className="lc-body">
          <b>{quietTitle}</b>
          <span>{quietText}</span>
        </div>
        <div className="lc-actions">
          <a className="btn btn-sm" href={chapterUrl} target="_blank" rel="noopener">
            {quietButton}
          </a>
        </div>
      </div>
    )
  const multi = spanDays(e) > 1
  const when =
    state === 'live'
      ? `Until ${fmt(e.end, { weekday: 'short', day: 'numeric', month: 'short' })}, ${timeLabel(e.end)}`
      : `${dateLabel(e)}, ${timeLabel(e.start)}`
  const href = ticketUrl || e.url
  return (
    <div className={`live-card is-${state}`} aria-live="polite">
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
        <a className="btn btn-sm" href={href} target="_blank" rel="noopener">
          {state === 'live' ? 'Join now' : 'Register'}
        </a>
      </div>
    </div>
  )
}

// ─── GdgDevfestStatus ────────────────────────────────────────────────────────

type StatusProps = {
  loadingText: string
  quietTitle: string
  quietText: string
  quietButton: string
  ticketUrl: string
}

const GdgDevfestStatus: ComponentConfig<StatusProps> = {
  label: 'GDG DevFest Status',
  fields: {
    loadingText: text('While loading'),
    quietTitle: text('Title when nothing is scheduled'),
    quietText: text('Text when nothing is scheduled'),
    quietButton: text('Button when nothing is scheduled'),
    ticketUrl: text('Ticket link (optional, overrides the event link)'),
  },
  defaultProps: {
    loadingText: 'Checking DevFest dates…',
    quietTitle: "The next DevFest Vizag isn't announced yet",
    quietText: 'Dates and tickets are posted on the GDG Vizag chapter page first.',
    quietButton: 'Join to get notified',
    ticketUrl: '',
  },
  render: function Render({ puck, ...p }) {
    const { devfests, isLoading, chapterUrl } = useDevfests(projectOf(puck))
    return (
      <Gdg>
        <section id="df-status" className="block df-status" aria-label="DevFest status">
          <LiveCard
            list={devfests}
            loading={isLoading}
            loadingText={p.loadingText}
            quietTitle={p.quietTitle}
            quietText={p.quietText}
            quietButton={p.quietButton}
            chapterUrl={chapterUrl}
            ticketUrl={p.ticketUrl || undefined}
          />
        </section>
      </Gdg>
    )
  },
}

// ─── GdgDevfestAbout ─────────────────────────────────────────────────────────

/** Words light up as the paragraph scrolls through the viewport. */
function RevealText({ source }: { source: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [on, setOn] = useState(0)
  // Split into words, keeping [link](url) groups so their words stay inside the link.
  const parts = useMemo(() => {
    const segs: { text: string; href?: string }[] = []
    const re = /\[([^\]]+)\]\(([^)\s]+)\)/g
    let last = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(source))) {
      if (m.index > last) segs.push({ text: source.slice(last, m.index) })
      const t = m[1] ?? ''
      const h = m[2] ?? ''
      segs.push({ text: t, href: /^(https?:\/\/|\/)/i.test(h) ? h : undefined })
      last = re.lastIndex
    }
    if (last < source.length) segs.push({ text: source.slice(last) })
    return segs.map((s) => ({ ...s, toks: s.text.split(/(\s+)/) }))
  }, [source])
  const total = parts.reduce((n, s) => n + s.toks.filter((t) => t.trim()).length, 0)
  useEffect(() => {
    const root = ref.current
    if (!root || prefersReducedMotion()) return
    let queued = false
    const update = () => {
      queued = false
      const r = root.getBoundingClientRect()
      const vh = window.innerHeight
      const p = Math.min(1, Math.max(0, (vh * 0.82 - r.top) / (r.height + vh * 0.25)))
      setOn(Math.round(p * total))
    }
    const queue = () => {
      if (!queued) {
        queued = true
        requestAnimationFrame(update)
      }
    }
    window.addEventListener('scroll', queue, { passive: true })
    window.addEventListener('resize', queue)
    update()
    return () => {
      window.removeEventListener('scroll', queue)
      window.removeEventListener('resize', queue)
    }
  }, [total])
  let w = 0
  const words = (toks: string[], key: string) =>
    toks.map((tok, i) => {
      if (!tok.trim()) return <Fragment key={`${key}-${i}`}>{tok}</Fragment>
      const idx = w++
      return (
        <span key={`${key}-${i}`} className={idx < on ? 'w on' : 'w'}>
          {tok}
        </span>
      )
    })
  return (
    <p className="reveal" id="reveal" ref={ref}>
      {parts.map((s, i) =>
        s.href ? (
          <a key={i} href={s.href} {...ext(s.href)}>
            {words(s.toks, `l${i}`)}
          </a>
        ) : (
          <Fragment key={i}>{words(s.toks, `t${i}`)}</Fragment>
        )
      )}
    </p>
  )
}

type Seg = [string, string]
/** The terminal that types itself once when it scrolls into view. Lines: "$ command" or "> output" or "ok text". */
function Terminal({ script }: { script: string }) {
  const LINES = useMemo<Seg[][]>(
    () =>
      (script ?? '')
        .split('\n')
        .map((l) => l.trimEnd())
        .filter((l) => l.trim())
        .map((l) => {
          if (l.startsWith('$ '))
            return [
              ['p', '$ '],
              ['', l.slice(2)],
            ]
          if (l.startsWith('ok ')) return [['ok', l.slice(3)]]
          return [['o', l.replace(/^>\s?/, '')]]
        }),
    [script]
  )
  const ref = useRef<HTMLPreElement>(null)
  const [st, setSt] = useState<{ line: number; ch: number; caret: boolean }>({
    line: 0,
    ch: 0,
    caret: true,
  })
  useEffect(() => {
    const out = ref.current
    if (!out || !LINES.length) return
    if (prefersReducedMotion()) {
      setSt({ line: LINES.length - 1, ch: Infinity, caret: false })
      return
    }
    setSt({ line: 0, ch: 0, caret: true })
    const timers: ReturnType<typeof setTimeout>[] = []
    const total = (i: number) => (LINES[i] ?? []).reduce((n, [, t]) => n + t.length, 0)
    const run = () => {
      let line = 0
      let ch = 0
      const step = () => {
        setSt({ line, ch, caret: true })
        if (ch < total(line)) {
          ch++
          timers.push(setTimeout(step, line % 3 === 0 ? 55 : 22))
          return
        }
        if (line < LINES.length - 1) {
          line++
          ch = 0
          timers.push(setTimeout(step, 450))
          return
        }
        setSt({ line, ch: Infinity, caret: true })
      }
      step()
    }
    let started = false
    const io = new IntersectionObserver(
      (es) => {
        if (started || !es[0]?.isIntersecting) return
        started = true
        io.disconnect()
        run()
      },
      { threshold: 0.4 }
    )
    io.observe(out)
    return () => {
      io.disconnect()
      timers.forEach(clearTimeout)
    }
  }, [LINES])
  return (
    <pre id="term-out" aria-hidden="true" ref={ref}>
      {LINES.slice(0, st.line + 1).map((segs, li) => {
        let left = li === st.line ? st.ch : Infinity
        return (
          <Fragment key={li}>
            {li > 0 ? '\n' : null}
            {segs.map(([cls, t], si) => {
              const shown = t.slice(0, Math.max(0, left))
              left -= t.length
              return (
                <span key={si} className={cls}>
                  {shown}
                </span>
              )
            })}
          </Fragment>
        )
      })}
      {st.caret ? <span className="caret"></span> : null}
    </pre>
  )
}

/** "Ask DevFest": answers come from the block's own FAQ lines ("keyword, keyword | answer"), not a model. */
function Ask({
  faq,
  chips,
  fallback,
  whenAnswer,
  whenFallback,
  next,
}: {
  faq: string
  chips: string
  fallback: string
  whenAnswer: string
  whenFallback: string
  next: GdgEvent | null
}) {
  const KB = useMemo(
    () =>
      lines(faq, 2).map(([k, a]) => ({
        k: k
          .split(',')
          .map((w) => w.trim().toLowerCase())
          .filter(Boolean),
        a,
      })),
    [faq]
  )
  const [log, setLog] = useState<{ q: string; a: string; shown: number }[]>([])
  const [input, setInput] = useState('')
  const busy = useRef(false)
  const logRef = useRef<HTMLDivElement>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])
  const answer = (q: string) => {
    const s = q.toLowerCase()
    let best: (typeof KB)[number] | null = null
    let score = 0
    KB.forEach((e) => {
      const n = e.k.filter((w) => s.includes(w)).length
      if (n > score) {
        score = n
        best = e
      }
    })
    const hit = best as (typeof KB)[number] | null
    if (!hit) return fallback
    if (hit.a.trim() !== '{next}') return hit.a
    if (!next) return whenFallback
    return whenAnswer
      .replace('{title}', next.title)
      .replace('{date}', dateLabel(next))
      .replace('{time}', timeLabel(next.start))
      .replace('{venue}', next.venue ? `, ${next.venue}` : '')
  }
  const ask = (raw: string) => {
    const q = raw.trim()
    if (!q || busy.current) return
    busy.current = true
    const a = answer(q)
    const reduce = prefersReducedMotion()
    setLog((l) => [...l, { q, a, shown: 0 }])
    let i = 0
    const type = () => {
      i += reduce ? a.length : 3
      const shown = i
      setLog((l) => l.map((x, n) => (n === l.length - 1 ? { ...x, shown } : x)))
      if (i < a.length) timers.current.push(setTimeout(type, 16))
      else busy.current = false
    }
    timers.current.push(setTimeout(type, reduce ? 0 : 250))
    sfx('tick')
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    ask(input)
    setInput('')
  }
  return (
    <>
      <div className="ask" id="ask-log" aria-live="polite" ref={logRef}>
        {log.map((x, i) => (
          <div key={i}>
            <span className="q">
              <span className="p" style={{ color: '#34a853' }}>
                ${' '}
              </span>
              ask &quot;{x.q}&quot;
            </span>
            <span className="a">{x.a.slice(0, x.shown)}</span>
          </div>
        ))}
      </div>
      <form className="ask-form" id="ask-form" autoComplete="off" onSubmit={submit}>
        <label className="sr" htmlFor="ask-in">
          Ask DevFest a question
        </label>
        <span className="p">$ ask</span>
        <input
          id="ask-in"
          placeholder={'"What should I bring?"'}
          maxLength={80}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" aria-label="Ask">
          Run
        </button>
      </form>
      <div className="ask-chips" id="ask-chips">
        {lines(chips).map(([q]) => (
          <button key={q} type="button" onClick={() => ask(q)}>
            {q}
          </button>
        ))}
      </div>
    </>
  )
}

/** The editions ribbon along a wavy coastline. */
function YearsRibbon({ years, label }: { years: string; label: string }) {
  const YEARS = lines(years, 2)
  const COL = ['#4285f4', '#ea4335', '#fbbc04', '#34a853']
  const W = 1000
  const H = 190
  const N = Math.max(1, YEARS.length)
  const yAt = (i: number) => H / 2 + 34 * Math.sin(i * 1.05)
  const xAt = (i: number) => ((i + 0.5) / N) * W
  let d = ''
  for (let x = 0; x <= W; x += 10) {
    const i = (x / W) * N - 0.5
    d += `${x ? 'L' : 'M'}${x},${(H / 2 + 34 * Math.sin(i * 1.05)).toFixed(1)}`
  }
  const NS = [8, 5, 6, 4, 7, 9, 3, 10]
  const AMPS = [0.07, 0.16, 0.12, 0.2, 0.1, 0.07, 0.2, 0.06]
  return (
    <div className="years-scroll">
      <div className="years" id="years" role="list" aria-label={label}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <path className="line" d={d} vectorEffect="non-scaling-stroke" />
        </svg>
        {YEARS.map(([y, note], i) => (
          <div
            key={y + i}
            className="yr"
            role="listitem"
            tabIndex={0}
            style={{ left: `${(xAt(i) / W) * 100}%`, top: `${(yAt(i) / H) * 100}%` }}
          >
            <svg viewBox="-100 -100 200 200" aria-hidden="true">
              <path d={shapePath(NS[i % 8] ?? 8, AMPS[i % 8] ?? 0.1)} fill={COL[i % 4]} />
            </svg>
            <b>{y}</b>
            <small>{note}</small>
          </div>
        ))}
      </div>
    </div>
  )
}

type AboutProps = {
  title: string
  reveal: string
  termTitle: string
  terminal: string
  faq: string
  chips: string
  fallback: string
  whenAnswer: string
  whenFallback: string
  about2: string
  topics: string
  stats: string
  years: string
  yearsLabel: string
}

const STAT_SHAPES: [number, number, number][] = [
  [6, 0.1, 0.6],
  [8, 0.07, 0.8],
  [5, 0.15, 0.7],
]

const GdgDevfestAbout: ComponentConfig<AboutProps> = {
  label: 'GDG DevFest About',
  fields: {
    title: text('Title'),
    reveal: area('Scroll-lit paragraph (links: [text](url))'),
    termTitle: text('Terminal title'),
    terminal: area('Terminal lines ("$ command", "> output", "ok done")'),
    faq: area(
      'Ask DevFest answers ("keyword, keyword | answer"; answer {next} = next DevFest date)'
    ),
    chips: area('Suggested questions (one per line)'),
    fallback: text('Answer when nothing matches'),
    whenAnswer: text('Date answer ({title} {date} {time} {venue})'),
    whenFallback: text('Date answer when no DevFest is announced'),
    about2: area('Second paragraph'),
    topics: area('Topics ("Name | blue/red/yellow/green")'),
    stats: area('Stats ("number | suffix | label | yellow/green/red")'),
    years: area('Editions ribbon ("Year | note")'),
    yearsLabel: text('Editions ribbon name (screen readers)'),
  },
  defaultProps: {
    title: 'Build, learn and meet in Vizag',
    reveal:
      "DevFest is Google Developer Groups' flagship community event, run by local volunteers worldwide. [GDG Vizag](https://gdg.community.dev/gdg-vizag/) has hosted it every year since 2018, usually at GITAM in Rushikonda.",
    termTitle: 'code-lab.sh',
    terminal: [
      '$ gemini create devfest-vizag-app',
      '> Scaffolding your first AI agent...',
      'ok Agent ready.',
      '$ flutter run',
      '> Launching on your laptop...',
      'ok App is running. Nice work!',
    ].join('\n'),
    faq: [
      'bring, carry, laptop, charger, pack, code lab, codelab | Bring a laptop and charger for the code labs, plus your ticket or QR code for check-in.',
      'register, ticket, sign up, signup, rsvp, seat | Tickets open on the GDG Vizag chapter page (gdg.community.dev/gdg-vizag). Press Get notified to jump there.',
      "certificate, swag, t-shirt, tshirt, sticker, goodies, merch, giveaway | Certificates and swag aren't confirmed for 2026. Details are posted on the event page when tickets open.",
      'when, date, where, venue, location, gitam, address | {next}',
      'free, price, cost, fee, paid, how much | Each chapter sets its own pricing. Vizag has run free and paid editions. 2026 pricing arrives with ticket launch.',
      'speak, cfp, talk, proposal, submit | Call for speakers opens before the event. See the Community page, or the chapter page.',
      'sponsor, partner, deck | Sponsors: open Become a sponsor on the Community page. It lists how to reach the organizers.',
      'student, beginner, who can, attend, level | Students, developers, founders and freelancers are all welcome. All skill levels.',
      "food, lunch, eat | Past editions included a networking lunch. 2026 catering isn't announced yet.",
    ].join('\n'),
    chips:
      'What should I bring to the code lab?\nWhere can I register?\nAre there certificates or swag?\nIs it free?',
    fallback:
      'I only know DevFest Vizag basics. Try asking about tickets, what to bring, the date, swag or speaking.',
    whenAnswer: '{title} is on {date} at {time}{venue}.',
    whenFallback:
      "The next DevFest isn't announced yet. Past editions were at GITAM University, Rushikonda, in November or December.",
    about2:
      'Expect practical sessions on AI, Gemini, Google Cloud, Flutter, Android and the web, from engineers who ship for a living. Afternoons are for code labs, so you leave with something running on your laptop.',
    topics:
      'AI | blue\nGemini | red\nGoogle Cloud | yellow\nFlutter | green\nAndroid | blue\nWeb | red',
    stats: '3200 | + | members | yellow\n8 |  | editions | green\n1159 |  | RSVPs in 2022 | red',
    years: [
      '2018 | Where it started',
      '2019 | Second year',
      '2020 | Online edition',
      '2021 | Community edition',
      '2022 | 1,159 RSVPs',
      '2023 | 700+ RSVPs',
      '2024 | Two days, 1,000+ expected',
      '2025 | Code labs on Agentic AI',
    ].join('\n'),
    yearsLabel: 'DevFest Vizag editions, 2018 to 2025',
  },
  render: function Render({ puck, ...p }) {
    const { next } = useDevfests(projectOf(puck))
    return (
      <Gdg>
        <section id="about" className="block about" aria-labelledby="about-h">
          <div className="about-panel">
            <h2 id="about-h">{p.title}</h2>
            <div className="about-top">
              <RevealText source={p.reveal} />
              <figure
                className="term"
                role="img"
                aria-label="Example code lab: create an app with Gemini, then run it with Flutter"
              >
                <figcaption>
                  <i></i>
                  <i></i>
                  <i></i>
                  <span>{p.termTitle}</span>
                </figcaption>
                <Terminal script={p.terminal} />
                <Ask
                  faq={p.faq}
                  chips={p.chips}
                  fallback={p.fallback}
                  whenAnswer={p.whenAnswer}
                  whenFallback={p.whenFallback}
                  next={next}
                />
              </figure>
            </div>
            <p className="about-2">{p.about2}</p>
            <ul className="topics">
              {lines(p.topics, 2).map(([name, c], i) => (
                <li key={name + i} data-c={c || 'blue'}>
                  {name}
                </li>
              ))}
            </ul>
            <div className="stat-shapes">
              {lines(p.stats, 4).map(([num, suffix, label, tone], i) => {
                const [n, amp, speed] = STAT_SHAPES[i % 3] ?? [6, 0.1, 0.6]
                const end = Number(num.replace(/[^\d.]/g, '')) || 0
                return (
                  <div key={label + i} className={`ss ss-${tone || 'yellow'}`}>
                    <MorphShape
                      n={n}
                      amp={amp}
                      speed={speed}
                      dir={i % 2 ? -1 : 1}
                      phase={i * 1.7}
                      viewBox="-110 -110 220 220"
                    />
                    <div>
                      <CountUp end={end} suffix={suffix} />
                      <span>{label}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <YearsRibbon years={p.years} label={p.yearsLabel} />
          </div>
        </section>
      </Gdg>
    )
  },
}

// ─── GdgDevfestAudience ──────────────────────────────────────────────────────

type AudienceProps = { title: string; panels: string; expect: string }

const GdgDevfestAudience: ComponentConfig<AudienceProps> = {
  label: 'GDG DevFest Audience',
  fields: {
    title: text('Title'),
    panels: area('Panels ("Title | text", up to 3)'),
    expect: area('What to expect ("Bold lead | text")'),
  },
  defaultProps: {
    title: 'Built for people who build',
    panels: [
      'Professional developers | Go deep on Google technologies and the patterns teams use in production.',
      'AI builders | Gemini, agents and LLM apps. See what works, then build it in a code lab.',
      'Students and tech enthusiasts | Curious about tech, or hunting for a first job in it? Meet people a few steps ahead of you.',
    ].join('\n'),
    expect: [
      'Technical content. | Sessions on Google technologies and industry trends from engineers and Google Developer Experts.',
      'Hands-on learning. | Afternoon code labs where you build alongside mentors instead of watching slides.',
      'Community connections. | Panels, networking and a lunch that runs long because everyone is talking.',
    ].join('\n'),
  },
  render: (p) => (
    <Gdg>
      <section className="block" aria-labelledby="who-h">
        <h2 id="who-h">{p.title}</h2>
        <div className="panels">
          {lines(p.panels, 2).map(([t, d], i) => (
            <article key={t + i} className={`panel p${(i % 3) + 1}`}>
              <h3>{t}</h3>
              <p>{d}</p>
            </article>
          ))}
        </div>
        <div className="expect">
          {lines(p.expect, 2).map(([b, d], i) => (
            <p key={b + i}>
              <b>{b}</b> {d}
            </p>
          ))}
        </div>
      </section>
    </Gdg>
  ),
}

// ─── GdgDevfestEditions ──────────────────────────────────────────────────────

type EditionsProps = {
  title: string
  sub: string
  loadingText: string
  emptyText: string
  linkLabel: string
}

const GdgDevfestEditions: ComponentConfig<EditionsProps> = {
  label: 'GDG DevFest Editions',
  fields: {
    title: text('Title'),
    sub: text('Subtitle'),
    loadingText: text('While loading'),
    emptyText: text('When there are none'),
    linkLabel: text('Link label'),
  },
  defaultProps: {
    title: 'Every DevFest Vizag',
    sub: 'Pulled live from the GDG Vizag chapter page.',
    loadingText: 'Loading editions…',
    emptyText: 'No DevFest events found in the feed.',
    linkLabel: 'Event page',
  },
  render: function Render({ puck, ...p }) {
    const { devfests, isLoading } = useDevfests(projectOf(puck))
    const TONES = ['green', 'yellow', 'red', 'blue']
    return (
      <Gdg>
        <section id="editions" className="block" aria-labelledby="ed-h">
          <h2 id="ed-h">{p.title}</h2>
          <p className="sub">{p.sub}</p>
          <div className="edition-list" id="edition-list">
            {isLoading ? (
              <p className="note">{p.loadingText}</p>
            ) : !devfests.length ? (
              <p className="note">{p.emptyText}</p>
            ) : (
              devfests.map((e, i) => {
                const t = TONES[i % 4]
                const st = status(e)
                return (
                  <a
                    key={e.id}
                    className="ed"
                    href={e.url}
                    target="_blank"
                    rel="noopener"
                    style={vars({ '--c-bg': `var(--${t}-c)`, '--c-on': `var(--on-${t}-c)` })}
                  >
                    <span className="y">{e.year}</span>
                    <div>
                      <h3>{e.title}</h3>
                      <p>
                        {[
                          st === 'upcoming' ? 'Upcoming' : st === 'live' ? 'Live now' : '',
                          dateLabel(e),
                          e.venue,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    </div>
                    <span className="go">{p.linkLabel}</span>
                  </a>
                )
              })
            )}
          </div>
        </section>
      </Gdg>
    )
  },
}

// ─── GdgDevfestIndia ─────────────────────────────────────────────────────────

type IndiaProps = { title: string; sub: string; cities: string }

const GdgDevfestIndia: ComponentConfig<IndiaProps> = {
  label: 'GDG DevFests in India',
  fields: {
    title: text('Title'),
    sub: text('Subtitle'),
    cities: area('Cities ("City | date and venue | link")'),
  },
  defaultProps: {
    title: 'DevFest all over India',
    sub: 'DevFest Vizag is one of 700+ community-run events this season. See what other chapters put on.',
    cities: [
      'Chennai | Oct 17, 2026 · IITM Research Park | https://devfest.gdgchennai.in',
      'Hyderabad | Oct 12, 2025 · Novotel Convention Centre | https://gdg.community.dev/events/details/google-gdg-hyderabad-presents-devfest-2025/',
      'New Delhi | Oct 12, 2025 | https://gdg.community.dev/events/details/google-gdg-new-delhi-presents-devfest-new-delhi-2025',
      'Ranchi | Oct 11, 2025 · BIT Mesra | https://gdg.community.dev/events/details/google-gdg-ranchi-presents-devfest-2025-1',
      'Guwahati | Nov 22–23, 2025 · Gauhati University | https://gdg.community.dev/events/details/google-gdg-guwahati-presents-calling-all-tech-enthusiasts-devfest-2025-is-coming-to-guwahati/',
      'Pune | Nov 30, 2025 · JW Marriott | https://gdg.community.dev/events/details/google-gdg-pune-presents-devfest-pune-2025/',
      'Indore | Dec 20, 2025 · Indore Marriott | https://gdg.community.dev/events/details/google-gdg-on-campus-ujjain-engineering-college-ujjain-india-presents-devfest-indore-2025/',
      'Kolkata | Dec 21, 2025 · Vedic Village | https://gdg.community.dev/events/details/google-gdg-kolkata-presents-devfest-kolkata-2025/',
      'Jaipur | Dec 27, 2025 | https://gdg.community.dev/events/details/google-gdg-on-campus-the-lnm-institute-of-information-technology-jaipur-india-presents-devfest-jaipur-2025/',
    ].join('\n'),
  },
  render: (p) => {
    const TONES = ['blue', 'red', 'yellow', 'green']
    return (
      <Gdg>
        <section id="india" className="block" aria-labelledby="in-h">
          <h2 id="in-h">{p.title}</h2>
          <p className="sub">{p.sub}</p>
          <ul className="cities" id="city-list">
            {lines(p.cities, 3).map(([city, info, url], i) => {
              const tone = TONES[i % 4]
              return (
                <li key={city + i}>
                  <a
                    href={url || '#'}
                    {...ext(url)}
                    style={vars({ '--c-bg': `var(--${tone}-c)`, '--c-on': `var(--on-${tone}-c)` })}
                  >
                    <b>{city}</b>
                    <span>{info}</span>
                  </a>
                </li>
              )
            })}
          </ul>
        </section>
      </Gdg>
    )
  },
}

// ─── GdgDevfestTracks ────────────────────────────────────────────────────────

type TracksProps = { title: string; sub: string; tiles: string }

const GdgDevfestTracks: ComponentConfig<TracksProps> = {
  label: 'GDG DevFest Tracks',
  fields: {
    title: text('Title'),
    sub: text('Subtitle'),
    tiles: area('Tiles ("Title | text | style classes | deco")'),
  },
  defaultProps: {
    title: 'What are you building for?',
    sub: 'Tracks from DevFest Vizag 2024. The 2026 lineup will be confirmed with the schedule.',
    tiles: [
      'AI and agents | Gemini, LLM apps and agentic workflows, from demo to production. | t-solid-blue big | deco',
      'Web | Modern web platform, performance, Chrome and Firebase. | t-red',
      'Cloud | Google Cloud, DevOps and things that scale. | t-yellow',
      'Mobile | Flutter, Android and cross-platform craft. | t-green',
      'Startups | Founders on shipping, funding and growth. | t-blue',
      'Careers | Panels, portfolio advice and how to get hired in tech. | t-outline wide',
    ].join('\n'),
  },
  render: (p) => (
    <Gdg>
      <section id="tracks" className="block" aria-labelledby="tracks-h">
        <h2 id="tracks-h">{p.title}</h2>
        <p className="sub">{p.sub}</p>
        <div className="bento tracks-grid">
          {lines(p.tiles, 4).map(([t, d, cls, deco], i) => (
            <article key={t + i} className={`tile ${cls || 't-blue'}`}>
              <h3>{t}</h3>
              <p>{d}</p>
              {deco ? <MorphShape className="deco" n={8} amp={0.1} still /> : null}
            </article>
          ))}
        </div>
      </section>
    </Gdg>
  ),
}

// ─── GdgDevfestSpeakers ──────────────────────────────────────────────────────

type SpeakersProps = {
  title: string
  sub: string
  railLabel: string
  badge: string
  speakers: string
  noTalk: string
  noLinks: string
}

const GdgDevfestSpeakers: ComponentConfig<SpeakersProps> = {
  label: 'GDG DevFest Speakers',
  fields: {
    title: text('Title'),
    sub: area('Subtitle (links: [text](url))'),
    railLabel: text('List name (screen readers)'),
    badge: text('Badge on every speaker'),
    speakers: area(
      'Speakers ("Name | Role | Talk | panel yes/no | Level | Label=link, Label=link")'
    ),
    noTalk: text('When a speaker has no talk'),
    noLinks: text('When a speaker has no links'),
  },
  defaultProps: {
    title: '2026 speakers are coming soon',
    sub: 'Want to speak? Reach out through the [GDG Vizag page](https://gdg.community.dev/gdg-vizag/). Meanwhile, here is who took the stage in 2023.',
    railLabel: '2023 speakers, scroll sideways',
    badge: 'DevFest Vizag 2023 speaker',
    speakers: [
      'Pawan Kumar | Lead Engineer, Frontier | App Evolution with LLM | yes',
      'Bhavik Makwana | FlutterFlow, GDE Flutter & Dart | Flutter makes Animations Easy | yes',
      'Krishnamohan Chivukula | Co-Founder & CTO, Gurujada | Surviving as Developer in AI World',
      'Manas Malla | Google Product Expert, Android',
      'Santhosh Nimmani | DevOps Lead, TEDx Speaker',
      'Jaldeep Asodariya | Senior Mobile Engineer, HighLevel | | yes',
      'Sasi Teja Kamsu | Engineer, Confluent',
      'Sampath Balivada | Software Engineer, PayPal',
      'Usha Ramani | Co-Founder, Gurujada',
      'Abhishek Mankuskar | Founder, Social Winter of Code',
      'Madhu Vadlamani | Data Analytics, Miracle Systems',
      'Mohammad Yasin | SDE, Board Infinity',
    ].join('\n'),
    noTalk: 'Not published for this speaker.',
    noLinks: 'Talk level and social links appear here once speakers are announced.',
  },
  render: function Render(p) {
    const dlg = useRef<HTMLDialogElement>(null)
    const [open, setOpen] = useState<number | null>(null)
    const speakers = lines(p.speakers, 6).map(([name, role, talk, panel, level, links]) => ({
      name,
      role,
      talk,
      panel: /^(yes|y|true|1)$/i.test(panel),
      level,
      links: links
        .split(',')
        .map((l) => l.split('=').map((x) => x.trim()))
        .map(([k = '', v = '']) => [k, v] as [string, string])
        .filter(([k, v]) => k && /^https?:\/\//i.test(v)),
    }))
    const s = open === null ? null : speakers[open]
    useEffect(() => {
      if (s && dlg.current && !dlg.current.open) dlg.current.showModal()
    }, [s])
    return (
      <Gdg>
        <section id="speakers" className="block bleed" aria-labelledby="spk-h">
          <div className="inner">
            <h2 id="spk-h">{p.title}</h2>
            <p className="sub">{linkify(p.sub)}</p>
          </div>
          <div className="rail" id="speaker-grid" tabIndex={0} aria-label={p.railLabel}>
            {speakers.map((sp, i) => {
              const [n, amp] = SHAPES[i % 4] ?? [8, 0.07]
              return (
                <button
                  key={sp.name + i}
                  className="spk"
                  type="button"
                  aria-label={`${sp.name}, ${sp.role}. Open details`}
                  onClick={() => setOpen(i)}
                >
                  <svg
                    className="avatar"
                    viewBox="-100 -100 200 200"
                    style={vars({ '--c': COLORS[i % 4] ?? '#4285f4' })}
                    aria-hidden="true"
                  >
                    <path d={shapePath(n, amp)} />
                    <text y="19">{initials(sp.name)}</text>
                  </svg>
                  <h3>{sp.name}</h3>
                  <p>{sp.role}</p>
                </button>
              )
            })}
          </div>
        </section>
        <dialog
          id="spk-dlg"
          className="dlg"
          aria-labelledby="spk-title"
          ref={dlg}
          onClose={() => setOpen(null)}
          onClick={(e) => {
            if (e.target === e.currentTarget) e.currentTarget.close()
          }}
        >
          <form method="dialog">
            <button className="dlg-x" aria-label="Close">
              Close
            </button>
          </form>
          <div id="spk-body">
            {s ? (
              <>
                <h3 id="spk-title">{s.name}</h3>
                <p>{s.role}</p>
                <div className="badges">
                  <span>{p.badge}</span>
                  {s.panel ? <span>Panelist</span> : null}
                  {s.level ? <span>{s.level}</span> : null}
                </div>
                <div className="talk">
                  <b>{s.talk ? 'Talk' : 'Talk details'}</b>
                  <span>{s.talk || p.noTalk}</span>
                </div>
                {s.links.length ? (
                  <div className="cta">
                    {s.links.map(([k, v]) => (
                      <a
                        key={k}
                        className="btn btn-sm btn-tonal"
                        href={v}
                        target="_blank"
                        rel="noopener"
                      >
                        {k}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="note">{p.noLinks}</p>
                )}
              </>
            ) : null}
          </div>
        </dialog>
      </Gdg>
    )
  },
}

// ─── GdgDevfestAgenda ────────────────────────────────────────────────────────

type AgendaProps = {
  title: string
  sub: string
  tracks: string
  sessions: string
  eventDate: string
  venue: string
  calendarTitle: string
  calendarDetails: string
  googleLabel: string
  icsLabel: string
  needDate: string
  needStar: string
}

const STAR_KEY = 'devfest-vizag-stars'
const hhmm = (t: string) => {
  const [h = 0, m = 0] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

const GdgDevfestAgenda: ComponentConfig<AgendaProps> = {
  label: 'GDG DevFest Agenda',
  fields: {
    title: text('Title'),
    sub: area('Subtitle'),
    tracks: area('Track filters (one per line; "All tracks" and "Starred" are added)'),
    sessions: area(
      'Sessions ("id | 09:00 | 10:00 | Title | Track | Note"; track "All" shows under every filter)'
    ),
    eventDate: text('Event date (YYYY-MM-DD) when no DevFest is in the feed'),
    venue: text('Venue (when no DevFest is in the feed)'),
    calendarTitle: text('Calendar event title'),
    calendarDetails: text('Calendar event details'),
    googleLabel: text('Google Calendar button'),
    icsLabel: text('.ics button'),
    needDate: text('Message when the date is not known'),
    needStar: text('Message when nothing is starred'),
  },
  defaultProps: {
    title: 'My DevFest agenda',
    sub: 'Sample slots based on the 2025 format. Star what you want, then export it. Real sessions replace these when announced.',
    tracks: 'AI and agents\nWeb\nCloud\nMobile\nStartups\nCareers',
    sessions: [
      'reg | 09:00 | 10:00 | Registration and welcome | All | Check in and pick up your badge.',
      'key | 10:00 | 10:45 | Opening keynote | All | Welcome from the organizers and the year ahead.',
      'ai1 | 11:00 | 11:45 | AI and agents session | AI and agents | Gemini and agentic apps, from demo to production.',
      'web1 | 11:00 | 11:45 | Web session | Web | Modern web platform, performance and Firebase.',
      'mob1 | 11:45 | 12:30 | Mobile session | Mobile | Flutter and Android craft.',
      'cld1 | 11:45 | 12:30 | Cloud session | Cloud | Google Cloud and DevOps that scale.',
      'pan | 12:30 | 14:00 | Careers panel and networking lunch | Careers | Speakers and builders on getting hired.',
      'lab1 | 14:00 | 15:30 | Code lab: Agentic AI | AI and agents | Hands-on, bring your laptop.',
      'lab2 | 14:00 | 15:30 | Code lab: Cloud skills boost | Cloud | Hands-on, bring your laptop.',
      'stp | 15:45 | 16:30 | Startup stories | Startups | Founders on shipping and growth.',
      'end | 16:30 | 17:30 | Wrap-up and group photo | All | Closing, swag and photos.',
    ].join('\n'),
    eventDate: '',
    venue: '',
    calendarTitle: 'DevFest Vizag 2026',
    calendarDetails: 'Google Developer Groups Vizag. Talks, code labs and community.',
    googleLabel: 'Add to Google Calendar',
    icsLabel: 'Export my agenda (.ics)',
    needDate: 'Calendar export unlocks once the date is announced.',
    needStar: 'Star at least one session first.',
  },
  render: function Render({ puck, ...p }) {
    const { next } = useDevfests(projectOf(puck))
    const SESSIONS = lines(p.sessions, 6).map(([id, s, e, title, track, note]) => ({
      id,
      s,
      e,
      title,
      track,
      note,
    }))
    const filters = ['All tracks', 'Starred', ...lines(p.tracks).map(([t]) => t)]
    const [stars, setStars] = useState<Set<string>>(() => new Set())
    const [filter, setFilter] = useState('All tracks')
    const [msg, setMsg] = useState<string | null>(null)
    useEffect(() => {
      try {
        setStars(new Set(JSON.parse(localStorage.getItem(STAR_KEY) || '[]') as string[]))
      } catch {
        /* storage blocked */
      }
    }, [])
    const save = (s: Set<string>) => {
      try {
        localStorage.setItem(STAR_KEY, JSON.stringify([...s]))
      } catch {
        /* storage blocked */
      }
    }
    // The date comes from the next DevFest in the feed (as sync.js did), else from the block.
    const day = next
      ? dayKey(next.start)
      : /^\d{4}-\d{2}-\d{2}/.test(p.eventDate)
        ? p.eventDate.slice(0, 10)
        : null
    const venue = (next?.venue || p.venue || '').trim()
    const utc = (d: string, t: string) =>
      new Date(`${d}T${t}:00+05:30`)
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '')
    const toggle = (id: string) => {
      const s = new Set(stars)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      setStars(s)
      save(s)
      sfx('flip')
    }
    const google = () => {
      if (!day) return setMsg(p.needDate)
      const q = new URLSearchParams({
        action: 'TEMPLATE',
        text: p.calendarTitle,
        dates: `${utc(day, '09:00')}/${utc(day, '17:30')}`,
        details: p.calendarDetails,
        location: venue || 'Visakhapatnam, Andhra Pradesh',
      })
      window.open(`https://calendar.google.com/calendar/render?${q}`, '_blank', 'noopener')
    }
    const ics = () => {
      if (!day) return setMsg(p.needDate)
      const picks = SESSIONS.filter((x) => stars.has(x.id))
      if (!picks.length) return setMsg(p.needStar)
      setMsg(null)
      const stamp = new Date()
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '')
      const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//GDG Vizag//${p.calendarTitle}//EN`]
      picks.forEach((x) =>
        out.push(
          'BEGIN:VEVENT',
          `UID:${x.id}-${day}@devfest-vizag`,
          `DTSTAMP:${stamp}`,
          `DTSTART:${utc(day, x.s)}`,
          `DTEND:${utc(day, x.e)}`,
          `SUMMARY:${x.title}`,
          `DESCRIPTION:${x.note}`,
          `LOCATION:${venue || 'Visakhapatnam'}`,
          'END:VEVENT'
        )
      )
      out.push('END:VCALENDAR')
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([out.join('\r\n')], { type: 'text/calendar' }))
      a.download = 'my-devfest-vizag-agenda.ics'
      a.click()
    }
    return (
      <Gdg>
        <section id="schedule" className="block" aria-labelledby="sch-h">
          <div className="sched">
            <div className="sched-side">
              <h2 id="sch-h">{p.title}</h2>
              <p className="sub">{p.sub}</p>
              <div className="filters" id="track-filters" role="group" aria-label="Filter by track">
                {filters.map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={f === filter}
                    onClick={() => {
                      setFilter(f)
                      sfx('tick')
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="agenda-actions">
                <button className="btn btn-sm" id="cal-google" type="button" onClick={google}>
                  {p.googleLabel}
                </button>
                <button className="btn btn-sm btn-tonal" id="cal-ics" type="button" onClick={ics}>
                  {p.icsLabel}
                </button>
              </div>
              <p className="note" id="agenda-note" role="status">
                <span id="star-count">{stars.size} starred</span>
                {msg ? ` ${msg}` : null}
              </p>
            </div>
            <ol className="agenda" id="agenda">
              {SESSIONS.map((x) => {
                const starred = stars.has(x.id)
                const show =
                  filter === 'All tracks' ||
                  (filter === 'Starred' ? starred : x.track === filter || x.track === 'All')
                return (
                  <li key={x.id} data-id={x.id} data-track={x.track} hidden={!show}>
                    <span className="when">{hhmm(x.s)}</span>
                    <div>
                      <h3>{x.title}</h3>
                      <p>{x.note}</p>
                      <span className="tag">{x.track}</span>
                    </div>
                    <button
                      className="star"
                      type="button"
                      aria-pressed={starred}
                      aria-label={`Star ${x.title}`}
                      onClick={() => toggle(x.id)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="m12 3 2.7 5.7 6.3.8-4.6 4.3 1.2 6.2L12 17l-5.6 3 1.2-6.2L3 9.5l6.3-.8Z" />
                      </svg>
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>
        </section>
      </Gdg>
    )
  },
}

export const devfestComponents: Record<string, AnyBlock> = {
  GdgDevfestStatus,
  GdgDevfestAbout,
  GdgDevfestAudience,
  GdgDevfestEditions,
  GdgDevfestIndia,
  GdgDevfestTracks,
  GdgDevfestSpeakers,
  GdgDevfestAgenda,
}
