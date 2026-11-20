'use client'

// Events page blocks of the GDG chapter site, ported from the GDG Vizag site (events.html + events.js):
// the featured DevFest card and the full events list with search, status / category / year filters
// (kept in the URL, so "?year=2024" from the Our journey cards works) and "Show more".
import { useEffect, useMemo, useState } from 'react'
import type { ComponentConfig } from '@puckeditor/core'
import {
  Gdg,
  TONES,
  dateLabel,
  focus,
  shapePath,
  status,
  text,
  useGdgFeed,
  useNow,
  type EventStatus,
  type AnyBlock,
} from './lib'
import { ext } from './chrome'

type Puck = { puck?: { metadata?: Record<string, unknown> } }
const projectOf = (puck: Puck['puck']) => puck?.metadata?.projectId as string | undefined

const LABEL: Record<EventStatus, string> = { live: 'Live now', upcoming: 'Upcoming', past: 'Past' }
const CATEGORIES = [
  'DevFest',
  'Women Techmakers',
  'I/O Extended',
  'Study Jams',
  'Build with AI',
  'Workshops and talks',
  'Meetups',
]
const STATUSES = ['All', 'Live now', 'Upcoming', 'Past']
const STATUS_KEY: Record<string, EventStatus> = {
  'Live now': 'live',
  Upcoming: 'upcoming',
  Past: 'past',
}
const PAGE = 12

/** A stable colour per event (the original used the numeric chapter event id). */
const toneOf = (id: string, i: number) => {
  let h = 0
  for (const c of id || String(i)) h = (h + c.charCodeAt(0)) % 997
  return TONES[h % 4]
}

// ─── Featured DevFest ────────────────────────────────────────────────────────

type FeaturedProps = {
  category: string
  pageLabel: string
  pageHref: string
  sourceLabel: string
  latestLabel: string
}

const GdgEventsFeatured: ComponentConfig<FeaturedProps> = {
  label: 'GDG Featured Event',
  fields: {
    category: text('Category to feature (the live or next one, else the latest)'),
    pageLabel: text('Main button'),
    pageHref: text('Main button link'),
    sourceLabel: text('Second button (opens the event on the chapter page)'),
    latestLabel: text('Badge when the featured event is in the past'),
  },
  defaultProps: {
    category: 'DevFest',
    pageLabel: 'Open the DevFest page',
    pageHref: '/devfest',
    sourceLabel: 'View on GDG',
    latestLabel: 'Latest DevFest',
  },
  render: function Render({ puck, ...p }: FeaturedProps & Puck) {
    const { events } = useGdgFeed(projectOf(puck))
    const now = useNow(30_000)
    const list = events.filter((e) => e.cat === p.category && !/core committee/i.test(e.title))
    const e = focus(list, now).e || list[0]
    if (!e)
      return (
        <Gdg>
          <section className="block ev-featured" aria-label="Featured event">
            <div id="ev-featured"></div>
          </section>
        </Gdg>
      )
    const st = status(e, now)
    const pic = e.banner || e.img
    return (
      <Gdg>
        <section className="block ev-featured" aria-label="Featured event">
          <div id="ev-featured" className="feat">
            {pic ? <img src={pic} alt="" loading="eager" /> : null}
            <div className="feat-body">
              <span className="lc-pill">
                {st === 'live' ? <i className="dot"></i> : null}
                {st === 'past' ? p.latestLabel : LABEL[st]}
              </span>
              <h2>{e.title}</h2>
              <p>{[dateLabel(e), e.venue].filter(Boolean).join(', ')}</p>
              <div className="cta">
                {p.pageLabel ? (
                  <a className="btn" href={p.pageHref} {...ext(p.pageHref)}>
                    {p.pageLabel}
                  </a>
                ) : null}
                {p.sourceLabel && e.url ? (
                  <a className="btn btn-tonal" href={e.url} target="_blank" rel="noopener">
                    {p.sourceLabel}
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </Gdg>
    )
  },
}

// ─── All events ──────────────────────────────────────────────────────────────

type ListProps = {
  heading: string
  searchLabel: string
  searchPlaceholder: string
  moreLabel: string
  emptyText: string
  errorText: string
}

type Filters = { status: string; cat: string; year: string }

const GdgEventsList: ComponentConfig<ListProps> = {
  label: 'GDG Events List',
  fields: {
    heading: text('Heading (for screen readers)'),
    searchLabel: text('Search label'),
    searchPlaceholder: text('Search placeholder'),
    moreLabel: text('"Show more" button'),
    emptyText: text('No matches'),
    errorText: text('When the events cannot be loaded'),
  },
  defaultProps: {
    heading: 'All events',
    searchLabel: 'Search',
    searchPlaceholder: 'Search events',
    moreLabel: 'Show more',
    emptyText: 'No events match. Try a different filter.',
    errorText: 'The events feed could not be reached. Try again in a moment.',
  },
  render: function Render({ puck, ...p }: ListProps & Puck) {
    const { events, isLoading } = useGdgFeed(projectOf(puck))
    const now = useNow(30_000)
    const [f, setF] = useState<Filters>({ status: 'All', cat: 'All', year: 'All' })
    const [q, setQ] = useState('')
    const [shown, setShown] = useState(PAGE)
    const editing = (puck as { isEditing?: boolean } | undefined)?.isEditing ?? false

    // Filters start from the URL (?status= ?cat= ?year=) and are written back to it.
    useEffect(() => {
      const u = new URLSearchParams(window.location.search)
      setF({
        status: u.get('status') || 'All',
        cat: u.get('cat') || 'All',
        year: u.get('year') || 'All',
      })
    }, [])
    const choose = (key: keyof Filters, v: string) => {
      const next = { ...f, [key]: v }
      setF(next)
      setShown(PAGE)
      if (editing) return
      const u = new URLSearchParams()
      ;(['status', 'cat', 'year'] as const).forEach((k) => next[k] !== 'All' && u.set(k, next[k]))
      window.history.replaceState(null, '', u.toString() ? `?${u}` : window.location.pathname)
    }

    const years = useMemo(
      () => [...new Set(events.map((e) => e.year))].sort((a, b) => b - a).map(String),
      [events]
    )
    const query = q.trim().toLowerCase()
    const rank: Record<EventStatus, number> = { live: 0, upcoming: 1, past: 2 }
    const list = events
      .filter((e) => {
        const st = status(e, now)
        return (
          (f.status === 'All' || STATUS_KEY[f.status] === st) &&
          (f.cat === 'All' || e.cat === f.cat) &&
          (f.year === 'All' || String(e.year) === f.year) &&
          (!query || e.title.toLowerCase().includes(query) || e.venue.toLowerCase().includes(query))
        )
      })
      .sort((a, b) => {
        const sa = status(a, now)
        const sb = status(b, now)
        return (
          rank[sa] - rank[sb] || (sa === 'upcoming' ? +a.start - +b.start : +b.start - +a.start)
        )
      })

    const chips = (items: string[], key: keyof Filters, label: string) => (
      <div className="filters" role="group" aria-label={label}>
        {items.map((v) => (
          <button key={v} type="button" aria-pressed={f[key] === v} onClick={() => choose(key, v)}>
            {v}
          </button>
        ))}
      </div>
    )

    const countText = isLoading
      ? 'Loading events…'
      : !events.length
        ? p.errorText
        : `${list.length} ${list.length === 1 ? 'event' : 'events'}`

    return (
      <Gdg>
        <section className="block ev-list" aria-labelledby="ev-h">
          <h2 id="ev-h" className="sr">
            {p.heading}
          </h2>
          <div className="ev-tools">
            <label className="field ev-search">
              {p.searchLabel}
              <input
                id="ev-q"
                type="search"
                placeholder={p.searchPlaceholder}
                autoComplete="off"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  setShown(PAGE)
                }}
              />
            </label>
            {chips(STATUSES, 'status', 'Status')}
            {chips(['All', ...CATEGORIES], 'cat', 'Category')}
            {chips(['All', ...years], 'year', 'Year')}
          </div>
          <p className="note" id="ev-count" role="status">
            {countText}
          </p>
          <div className="ev-grid" id="ev-grid">
            {!isLoading && events.length && !list.length ? (
              <p className="note">{p.emptyText}</p>
            ) : null}
            {list.slice(0, shown).map((e, i) => {
              const st = status(e, now)
              const pic = e.img || e.banner
              return (
                <a
                  key={e.id}
                  className={`evc tone-${toneOf(e.id, i)} is-${st}`}
                  href={e.url || '#'}
                  target="_blank"
                  rel="noopener"
                >
                  <div className="evc-pic">
                    {pic ? (
                      <img src={pic} alt="" loading="lazy" />
                    ) : (
                      <svg viewBox="-100 -100 200 200" aria-hidden="true">
                        <path d={shapePath(5 + (i % 5), 0.12)} />
                      </svg>
                    )}
                    <span className="lc-pill">
                      {st === 'live' ? <i className="dot"></i> : null}
                      {LABEL[st]}
                    </span>
                  </div>
                  <div className="evc-body">
                    <h3>{e.title}</h3>
                    <p>{dateLabel(e)}</p>
                    <p className="evc-meta">{[e.cat, e.venue].filter(Boolean).join(', ')}</p>
                  </div>
                </a>
              )
            })}
          </div>
          <div className="cta ev-more">
            <button
              className="btn btn-tonal"
              id="ev-more"
              type="button"
              hidden={list.length <= shown}
              onClick={() => setShown((s) => s + PAGE)}
            >
              {p.moreLabel}
            </button>
          </div>
        </section>
      </Gdg>
    )
  },
}

export const eventsComponents: Record<string, AnyBlock> = {
  GdgEventsFeatured,
  GdgEventsList,
}
