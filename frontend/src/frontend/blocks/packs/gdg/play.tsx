'use client'

// DevFest "Play" and "Visit" blocks: badge maker (badge.tsx), shape-match game, travel tiles and the FAQ.
// Ported from the GDG Vizag site (devfest/play.html + play.js, devfest/visit.html).
import { useEffect, useRef, useState } from 'react'
import type { ComponentConfig } from '@puckeditor/core'
import { Gdg, area, lines, shapePath, sfx, text, type AnyBlock } from './lib'
import { ext } from './chrome'
import { GdgBadgeMaker } from './badge'

// ─── Shape-match game ────────────────────────────────────────────────────────

type Pair = [string, number, number]
const PAIRS: Pair[] = [
  ['#4285f4', 8, 0.07],
  ['#ea4335', 5, 0.16],
  ['#fbbc04', 6, 0.12],
  ['#34a853', 4, 0.2],
  ['#4285f4', 3, 0.18],
  ['#ea4335', 10, 0.06],
  ['#fbbc04', 7, 0.1],
  ['#34a853', 9, 0.08],
]
const BEST_KEY = 'devfest-vizag-best'
const readBest = () => {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0
  } catch {
    return 0
  }
}
const writeBest = (v: number) => {
  try {
    localStorage.setItem(BEST_KEY, String(v))
  } catch {
    /* storage blocked */
  }
}
const shuffle = () =>
  [...PAIRS, ...PAIRS]
    .map((p) => ({ p, r: Math.random() }))
    .sort((a, b) => a.r - b.r)
    .map(({ p }) => p)

type GameProps = { title: string; sub: string }

export const GdgShapeGame: ComponentConfig<GameProps> = {
  label: 'GDG Shape Match Game',
  fields: { title: text('Title'), sub: area('Intro') },
  defaultProps: {
    title: 'Match the shapes',
    sub: 'Find all eight pairs in as few moves as you can. Your best score stays on this device.',
  },
  render: function Render({ title, sub }) {
    const [deck, setDeck] = useState<Pair[]>(() => [...PAIRS, ...PAIRS])
    const [open, setOpen] = useState<number[]>([])
    const [done, setDone] = useState<Set<number>>(new Set())
    const [moves, setMoves] = useState(0)
    const [secs, setSecs] = useState(0)
    const [running, setRunning] = useState(false)
    const [lock, setLock] = useState(false)
    const [best, setBest] = useState(0)
    const [msg, setMsg] = useState('')
    const flipBack = useRef<ReturnType<typeof setTimeout> | null>(null)

    const newGame = () => {
      if (flipBack.current) clearTimeout(flipBack.current)
      setDeck(shuffle())
      setOpen([])
      setDone(new Set())
      setMoves(0)
      setSecs(0)
      setRunning(false)
      setLock(false)
      setMsg('')
      setBest(readBest())
    }
    // Shuffle on the client only, so server and client markup match.
    useEffect(newGame, [])
    useEffect(() => {
      if (!running) return
      const t = setInterval(() => setSecs((s) => s + 1), 1000)
      return () => clearInterval(t)
    }, [running])
    useEffect(
      () => () => {
        if (flipBack.current) clearTimeout(flipBack.current)
      },
      []
    )

    const flip = (i: number) => {
      if (lock || open.includes(i) || done.has(i)) return
      if (!running && done.size < deck.length) setRunning(true)
      sfx('flip')
      const now = [...open, i]
      if (now.length < 2) {
        setOpen(now)
        return
      }
      const m = moves + 1
      setMoves(m)
      const [a, b] = now as [number, number]
      if (deck[a] === deck[b]) {
        const next = new Set(done)
        next.add(a)
        next.add(b)
        setDone(next)
        setOpen([])
        sfx('match')
        if (next.size === deck.length) {
          setRunning(false)
          const prev = readBest()
          const record = !prev || m < prev
          if (record) writeBest(m)
          setBest(readBest())
          sfx('win')
          setMsg(
            `All matched in ${m} moves and ${secs}s.${record ? ' New best!' : ''} Press New game to play again.`
          )
        }
        return
      }
      setOpen(now)
      setLock(true)
      flipBack.current = setTimeout(() => {
        setOpen([])
        setLock(false)
      }, 800)
    }

    return (
      <Gdg>
        <section id="game" className="block" aria-labelledby="game-h">
          <div className="game-panel">
            <div className="game-head">
              <div>
                <h2 id="game-h">{title}</h2>
                <p className="sub">{sub}</p>
              </div>
              <div className="game-stats">
                <span>{`${moves} ${moves === 1 ? 'move' : 'moves'}`}</span>
                <span>{`${secs}s`}</span>
                <span>
                  {best ? `Best: ${best} ${best === 1 ? 'move' : 'moves'}` : 'Best: none yet'}
                </span>
                <button className="btn btn-sm btn-tonal" type="button" onClick={newGame}>
                  New game
                </button>
              </div>
            </div>
            <div className="board" role="group" aria-label="Memory board">
              {deck.map((p, i) => {
                const isDone = done.has(i)
                const isOpen = open.includes(i)
                return (
                  <button
                    key={i}
                    type="button"
                    className={`tile3${isOpen ? ' open' : ''}${isDone ? ' done' : ''}`}
                    aria-label={
                      isDone
                        ? 'Matched'
                        : isOpen
                          ? `Card ${i + 1}, shape ${p[1]}-lobed, ${p[0]}`
                          : `Card ${i + 1}, face down`
                    }
                    onClick={() => flip(i)}
                  >
                    <span className="back">
                      <svg viewBox="0 0 64 64" aria-hidden="true">
                        <path d="M26 14 8 32l18 18" />
                        <path d="m38 14 18 18-18 18" />
                      </svg>
                    </span>
                    <span className="face">
                      <svg viewBox="-100 -100 200 200" aria-hidden="true">
                        <path d={shapePath(p[1], p[2])} fill={p[0]} />
                      </svg>
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="note" role="status">
              {msg}
            </p>
          </div>
        </section>
      </Gdg>
    )
  },
}

// ─── Visit: getting to DevFest ───────────────────────────────────────────────

type TravelProps = {
  title: string
  sub: string
  venueTitle: string
  venueText: string
  venueButton: string
  venueLink: string
  routes: string
  places: string
  tipTitle: string
  tipText: string
}

const ROUTE_TONES = ['t-yellow', 't-green', 't-blue', 't-red']
const PLACE_TONES = ['t-red', 't-blue', 't-green', 't-yellow']

export const GdgVisitTravel: ComponentConfig<TravelProps> = {
  label: 'GDG Visit / Travel',
  fields: {
    title: text('Title'),
    sub: area('Intro'),
    venueTitle: text('Venue name'),
    venueText: area('Venue text'),
    venueButton: text('Venue button'),
    venueLink: text('Venue Maps link'),
    routes: area('Routes ("Title | text | Maps link" per line)'),
    places: area('Nearby places ("Title | text | Maps link" per line)'),
    tipTitle: text('Tip title'),
    tipText: area('Tip text'),
  },
  defaultProps: {
    title: 'Getting to DevFest',
    sub: "The 2026 venue isn't announced yet. Past editions were at GITAM University, Rushikonda. Live travel times are on Google Maps.",
    venueTitle: 'GITAM University, Rushikonda',
    venueText:
      'Visakhapatnam 530045, Andhra Pradesh. Home of DevFest Vizag in 2023, 2024 and 2025.',
    venueButton: 'Open in Google Maps',
    venueLink:
      'https://www.google.com/maps/search/?api=1&query=GITAM+University+Rushikonda+Visakhapatnam',
    routes: [
      'From the railway station | Visakhapatnam Junction (VSKP) to the campus. | https://www.google.com/maps/dir/?api=1&origin=Visakhapatnam+Railway+Station&destination=GITAM+University+Rushikonda+Visakhapatnam',
      'From the airport | Visakhapatnam Airport (VTZ) to the campus. | https://www.google.com/maps/dir/?api=1&origin=Visakhapatnam+Airport&destination=GITAM+University+Rushikonda+Visakhapatnam',
    ].join('\n'),
    places: [
      "RK Beach | Ramakrishna Beach, the city's classic walk by the sea. | https://www.google.com/maps/search/?api=1&query=RK+Beach+Visakhapatnam",
      'Kailasagiri | Hilltop park above the city with a ropeway and views over the bay. | https://www.google.com/maps/search/?api=1&query=Kailasagiri+Visakhapatnam',
      'Rushikonda Beach | A wide beach right next to the GITAM campus. | https://www.google.com/maps/search/?api=1&query=Rushikonda+Beach+Visakhapatnam',
    ].join('\n'),
    tipTitle: 'Coming from out of town?',
    tipText:
      'Book trains and flights early, and arrive the evening before so registration is stress-free. Check Google Maps for live road conditions on the day.',
  },
  render: (p) => (
    <Gdg>
      <section id="travel" className="block" aria-labelledby="trv-h">
        <h2 id="trv-h">{p.title}</h2>
        {p.sub ? <p className="sub">{p.sub}</p> : null}
        <div className="bento travel-grid">
          <article className="tile t-solid-blue venue">
            <h3>{p.venueTitle}</h3>
            <p>{p.venueText}</p>
            {p.venueButton && p.venueLink ? (
              <a className="btn btn-light" href={p.venueLink} {...ext(p.venueLink)}>
                {p.venueButton}
              </a>
            ) : null}
          </article>
          {lines(p.routes, 3).map(([title = '', body = '', href = ''], i) => (
            <article key={title + i} className={`tile ${ROUTE_TONES[i % ROUTE_TONES.length]}`}>
              <h3>{title}</h3>
              <p>{body}</p>
              {href ? (
                <a className="btn btn-sm" href={href} {...ext(href)}>
                  Show route
                </a>
              ) : null}
            </article>
          ))}
          {lines(p.places, 3).map(([title = '', body = '', href = ''], i) => (
            <a
              key={title + i}
              className={`tile ${PLACE_TONES[i % PLACE_TONES.length]} link`}
              href={href || '#'}
              {...ext(href)}
            >
              <h3>{title}</h3>
              <p>{body}</p>
              <span className="go">Open in Maps</span>
            </a>
          ))}
          {p.tipTitle ? (
            <article className="tile t-outline tipwide">
              <h3>{p.tipTitle}</h3>
              <p>{p.tipText}</p>
            </article>
          ) : null}
        </div>
      </section>
    </Gdg>
  ),
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

type FaqProps = { title: string; items: string }

export const GdgFaq: ComponentConfig<FaqProps> = {
  label: 'GDG FAQ',
  fields: { title: text('Title'), items: area('Questions ("Question | Answer" per line)') },
  defaultProps: {
    title: 'Good to know',
    items: [
      'When and where is DevFest Vizag 2026? | Not announced yet. Past editions took place at GITAM University, Rushikonda, Visakhapatnam, in November or December. Follow GDG Vizag for the announcement.',
      'Who can attend? | Students, developers, professionals, freelancers and entrepreneurs. All skill levels are welcome.',
      'Is DevFest free? | Each chapter sets its own pricing. Vizag has run free and paid editions. Pricing for 2026 will be on the ticket page when registration opens.',
      'When should I register? | As soon as tickets open. Past editions drew hundreds of RSVPs, and seats fill up.',
      'How do I get tickets? | Tickets are released on the GDG Vizag event page on gdg.community.dev. Check the listing when it opens.',
      'Can I speak or volunteer? | Yes. Calls for speakers and volunteers are shared on GDG Vizag channels before each edition.',
      'What should I bring? | A laptop and charger for the code labs, and your ticket or QR code for check-in.',
      'Is there a code of conduct? | Yes. DevFest follows the Google Developer Groups community guidelines. Be kind, be inclusive, keep it professional.',
    ].join('\n'),
  },
  render: ({ title, items }) => (
    <Gdg>
      <section id="faq" className="block" aria-labelledby="faq-h">
        <div className="faq-wrap">
          <h2 id="faq-h">{title}</h2>
          <div className="faq">
            {lines(items, 2).map(([q = '', a = ''], i) => (
              <details key={q + i}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </Gdg>
  ),
}

export const playComponents: Record<string, AnyBlock> = {
  GdgBadgeMaker,
  GdgShapeGame,
  GdgVisitTravel,
  GdgFaq,
}
