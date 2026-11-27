'use client'

// Shared helpers for the GDG block pack. Ported from the GDG Vizag site (common.js + feed.js): the
// events feed now comes from the KDL-OS Events module (GET /api/gdg/public), which syncs the
// chapter from gdg.community.dev on the server, so the browser never calls gdg.community.dev itself.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ComponentConfig } from '@puckeditor/core'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'

export const TZ = 'Asia/Kolkata'
export const COLORS = ['#4285f4', '#ea4335', '#f5a800', '#34a853']
export const TONES = ['blue', 'red', 'yellow', 'green'] as const
export const SHAPES: [number, number][] = [
  [8, 0.07],
  [5, 0.15],
  [6, 0.12],
  [4, 0.2],
]

export const initials = (n: string) =>
  n
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')

/** r = R(1 + amp cos(n θ)): amp 0 is a circle, higher is a scalloped cookie or flower. */
export const shapePath = (n: number, amp: number) => {
  const pts: string[] = []
  for (let i = 0; i < 180; i++) {
    const t = (i / 180) * Math.PI * 2
    const r = 88 * (1 + amp * Math.cos(n * t))
    pts.push(`${(r * Math.cos(t)).toFixed(1)},${(r * Math.sin(t)).toFixed(1)}`)
  }
  return `M${pts.join('L')}Z`
}

/** Any GDG block (blocks have different prop shapes). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a registry of differently-typed blocks
export type AnyBlock = ComponentConfig<any>

/** A parsed list line: always 8 cells, missing ones are ''. */
export type Cells = [string, string, string, string, string, string, string, string]

/** Multi-line "a | b | c" text fields (the way the other packs store lists) -> rows of cells. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the cell count documents the call site
export const lines = (text: string | undefined, _cells = 1): Cells[] =>
  (text ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const parts = l.split('|').map((p) => p.trim())
      return Array.from({ length: 8 }, (_, i) => parts[i] ?? '') as Cells
    })

/** Every block wraps its markup in this, so the scoped stylesheet (gdg.css) applies. */
export function Gdg({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className ? `gdg ${className}` : 'gdg'}>{children}</div>
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ─── Events feed ─────────────────────────────────────────────────────────────

export interface GdgEvent {
  id: string
  title: string
  start: Date
  end: Date
  venue: string
  type: string
  img: string
  banner: string
  url: string
  page: string
  desc: string
  tags: string[]
  cat: string
  featured: boolean
  year: number
}
export interface GdgPerson {
  name: string
  title: string
  avatar: string
}
export interface GdgFeed {
  events: GdgEvent[]
  chapter: { members: number | null; logo: string; slug: string; url: string }
  team: GdgPerson[]
}

interface RawEvent extends Omit<GdgEvent, 'start' | 'end' | 'year'> {
  start: string
  end: string | null
}

const yearOf = (d: Date) =>
  Number(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric' }).format(d))

export function normalizeFeed(raw: {
  events: RawEvent[]
  chapter: GdgFeed['chapter']
  team: GdgPerson[]
}): GdgFeed {
  const all = (raw.events ?? [])
    .map((r) => {
      const start = new Date(r.start)
      const end = r.end ? new Date(r.end) : new Date(start.getTime() + 3 * 36e5)
      return { ...r, start, end, year: yearOf(start) }
    })
    .filter((e) => !Number.isNaN(e.start.getTime()))
  // Events without their own poster share a default picture (an image used by 2+ events): treat as none.
  const freq: Record<string, number> = {}
  all.forEach((e) => [e.img, e.banner].forEach((u) => u && (freq[u] = (freq[u] || 0) + 1)))
  all.forEach((e) => {
    if ((freq[e.img] ?? 0) >= 2) e.img = ''
    if ((freq[e.banner] ?? 0) >= 2) e.banner = ''
  })
  all.sort((a, b) => b.start.getTime() - a.start.getTime())
  return { events: all, chapter: raw.chapter, team: raw.team ?? [] }
}

const EMPTY: GdgFeed = {
  events: [],
  chapter: { members: null, logo: '', slug: '', url: '' },
  team: [],
}

/** The project's events, organizers and chapter facts (one cached request shared by every block). */
export function useGdgFeed(projectId?: string) {
  const q = useQuery({
    queryKey: ['gdg-feed', projectId ?? null],
    queryFn: async () => {
      const res = await api.get('/gdg/public', {
        params: { project_id: projectId || undefined },
      })
      return normalizeFeed(res.data.data)
    },
    staleTime: 5 * 60_000,
    retry: 1,
  })
  return { ...(q.data ?? EMPTY), isLoading: q.isLoading, isError: q.isError }
}

export const CHAPTER_URL_FALLBACK = 'https://gdg.community.dev/gdg-vizag/'

export type EventStatus = 'upcoming' | 'live' | 'past'
export const status = (e: GdgEvent, now = new Date()): EventStatus =>
  now < e.start ? 'upcoming' : now <= e.end ? 'live' : 'past'

export const fmt = (d: Date, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-IN', { timeZone: TZ, ...o }).format(d)
export const dayKey = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
const dayNum = (key: string) => Date.parse(key + 'T00:00:00Z') / 864e5
export const spanDays = (e: GdgEvent) => dayNum(dayKey(e.end)) - dayNum(dayKey(e.start)) + 1
export const dayOf = (e: GdgEvent, now = new Date()) =>
  Math.min(spanDays(e), Math.max(1, dayNum(dayKey(now)) - dayNum(dayKey(e.start)) + 1))

export const dateLabel = (e: GdgEvent) => {
  const same = dayKey(e.start) === dayKey(e.end)
  const y = fmt(e.end, { year: 'numeric' })
  if (same)
    return `${fmt(e.start, { weekday: 'short' })}, ${fmt(e.start, { day: 'numeric' })} ${fmt(e.start, { month: 'short' })} ${y}`
  const sm = fmt(e.start, { month: 'short' })
  const em = fmt(e.end, { month: 'short' })
  return sm === em
    ? `${fmt(e.start, { day: 'numeric' })}–${fmt(e.end, { day: 'numeric' })} ${em} ${y}`
    : `${fmt(e.start, { day: 'numeric' })} ${sm} – ${fmt(e.end, { day: 'numeric' })} ${em} ${y}`
}
export const timeLabel = (d: Date) =>
  `${fmt(d, { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase()} IST`

export const countdown = (ms: number) => {
  const m = Math.max(0, Math.floor(ms / 6e4))
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  const mi = m % 60
  if (d >= 1) return `${d} ${d === 1 ? 'day' : 'days'}${h ? ` ${h} hr` : ''}`
  if (h >= 1) return `${h} hr ${mi} min`
  return `${Math.max(1, mi)} min`
}

export const focus = (list: GdgEvent[], now = new Date()) => {
  const live = list.filter((e) => status(e, now) === 'live').sort((a, b) => +a.start - +b.start)[0]
  if (live) return { state: 'live' as const, e: live }
  const next = list
    .filter((e) => status(e, now) === 'upcoming')
    .sort((a, b) => +a.start - +b.start)[0]
  return next ? { state: 'upcoming' as const, e: next } : { state: 'none' as const, e: null }
}

/** Re-render every `ms` (live cards flip from "Up next" to "Live now" by themselves). */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

// ─── Time of day / theme ─────────────────────────────────────────────────────
// Dawn and Day are the light theme, Dusk and Night the dark one. Stored on <html> as
// data-gdg-time / data-gdg-theme (the GDG header sets them), so only GDG blocks react.

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night'
export const TIME_EVENT = 'gdg-timechange'
export const isDarkTime = (t: string) => t === 'dusk' || t === 'night'

export function useGdgTime(): TimeOfDay {
  const read = () =>
    (typeof document !== 'undefined' && (document.documentElement.dataset.gdgTime as TimeOfDay)) ||
    'dawn'
  const [t, setT] = useState<TimeOfDay>('dawn')
  useEffect(() => {
    setT(read())
    const on = (e: Event) => setT((e as CustomEvent<TimeOfDay>).detail)
    document.addEventListener(TIME_EVENT, on)
    return () => document.removeEventListener(TIME_EVENT, on)
  }, [])
  return t
}

// ─── Sound effects ───────────────────────────────────────────────────────────
// Tiny synth blips, off until the visitor turns them on (the Sound button on DevFest pages).

const NOTES: Record<string, [number, number][]> = {
  tick: [[880, 0.04]],
  flip: [[660, 0.05]],
  match: [
    [784, 0.08],
    [1047, 0.12],
  ],
  win: [
    [523, 0.1],
    [659, 0.1],
    [784, 0.1],
    [1047, 0.22],
  ],
}
let sfxOn = false
let audio: AudioContext | null = null
export const setSfx = (on: boolean) => {
  sfxOn = on
}
export const isSfxOn = () => sfxOn
export function sfx(kind: keyof typeof NOTES | string) {
  if (!sfxOn) return
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    audio = audio || new Ctx()
    let t = audio.currentTime
    ;(NOTES[kind] || []).forEach(([freq, len]) => {
      const o = audio!.createOscillator()
      const g = audio!.createGain()
      o.type = 'square'
      o.frequency.value = freq
      g.gain.setValueAtTime(0.05, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + len)
      o.connect(g).connect(audio!.destination)
      o.start(t)
      o.stop(t + len)
      t += len
    })
  } catch {
    /* audio unavailable */
  }
}

// ─── Motion ──────────────────────────────────────────────────────────────────

/** A shape that slowly morphs and turns while on screen (the original's svg[data-n] shapes). */
export function MorphShape({
  n,
  amp,
  speed = 1,
  dir = 1,
  phase = 0,
  className,
  viewBox = '-100 -100 200 200',
  children,
  still = false,
  style,
}: {
  n: number
  amp: number
  speed?: number
  dir?: number
  phase?: number
  className?: string
  viewBox?: string
  children?: ReactNode
  still?: boolean
  style?: React.CSSProperties
}) {
  const ref = useRef<SVGPathElement>(null)
  useEffect(() => {
    const path = ref.current
    if (!path || still || prefersReducedMotion()) return
    let visible = true
    const io = new IntersectionObserver((es) => es.forEach((e) => (visible = e.isIntersecting)))
    if (path.ownerSVGElement) io.observe(path.ownerSVGElement)
    let raf = 0
    const frame = (ms: number) => {
      if (visible) {
        const t = ms / 1000
        const a = amp * (0.5 + 0.5 * Math.sin(t * speed + phase))
        path.setAttribute('d', shapePath(n, a))
        path.setAttribute('transform', `rotate(${(t * 12 * dir * speed).toFixed(1)})`)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
    }
  }, [n, amp, speed, dir, phase, still])
  return (
    <svg className={className} viewBox={viewBox} aria-hidden="true" style={style}>
      <path ref={ref} d={shapePath(n, amp)} />
      {children}
    </svg>
  )
}

/**
 * Count up to `end` the first time it scrolls into view (the original's <strong data-count>). Renders the
 * <strong> itself: the GDG styles size `.ss strong` and hide `.ss span`, so no wrapper element.
 */
export function CountUp({ end, suffix = '' }: { end: number; suffix?: string }) {
  const ref = useRef<HTMLElement>(null)
  const [v, setV] = useState<string>(() => end.toLocaleString('en-IN') + suffix)
  useEffect(() => {
    const node = ref.current
    if (!node || prefersReducedMotion() || !('IntersectionObserver' in window)) return
    setV('0')
    let raf = 0
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((en) => en.isIntersecting)) return
        io.disconnect()
        const start = performance.now()
        const run = (now: number) => {
          const p = Math.min((now - start) / 1100, 1)
          setV(
            Math.round(end * (1 - Math.pow(1 - p, 3))).toLocaleString('en-IN') +
              (p === 1 ? suffix : '')
          )
          if (p < 1) raf = requestAnimationFrame(run)
        }
        raf = requestAnimationFrame(run)
      },
      { threshold: 0.6 }
    )
    io.observe(node)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [end, suffix])
  return <strong ref={ref}>{v}</strong>
}

/** Field helpers so every block declares its editable text the same way. */
export const text = (label: string) => ({ type: 'text' as const, label })
export const area = (label: string) => ({ type: 'textarea' as const, label })

// ─── DevFest data (entered in Admin → GDG Chapter → DevFest) ─────────────────

export interface DfSpeaker {
  id: string
  slug: string
  name: string
  photo: string
  role: string
  company: string
  bio: string
  links: Record<string, string>
  badges: string[]
  featured: boolean
}
export interface DfSession {
  id: string
  slug: string
  title: string
  abstract: string
  kind: string
  track: string
  level: string
  room: string
  start: string | null
  end: string | null
  speakers: string[]
  slides: string
  video: string
}
export interface DfEdition {
  year: number
  name: string
  theme: string
  start: string | null
  end: string | null
  venue: string
  address: string
  map: string
  tickets: string
  cfp: string
  cfpCloses: string | null
  /** The call for speakers form takes proposals now. */
  cfpOpen?: boolean
  tracks: { name: string; color?: string }[]
  stats: { label: string; value: string }[]
  current: boolean
}
export interface DevfestData {
  edition: DfEdition | null
  editions: { year: number; name: string; current: boolean }[]
  speakers: DfSpeaker[]
  sessions: DfSession[]
  sponsors: { id: string; name: string; logo: string; tier: string; url: string }[]
  team: { id: string; name: string; role: string; photo: string; url: string }[]
}

const NO_DEVFEST: DevfestData = {
  edition: null,
  editions: [],
  speakers: [],
  sessions: [],
  sponsors: [],
  team: [],
}

/** One DevFest edition with its shown content: `year`, else the current edition. */
export function useDevfestData(projectId?: string, year?: number) {
  const q = useQuery({
    queryKey: ['gdg-devfest-public', projectId ?? null, year ?? null],
    queryFn: async () => {
      const res = await api.get('/gdg/devfest/public', {
        params: { project_id: projectId || undefined, year: year || undefined },
      })
      return res.data.data as DevfestData
    },
    staleTime: 60_000,
    retry: 1,
  })
  return { ...(q.data ?? NO_DEVFEST), isLoading: q.isLoading }
}

/** "HH:MM" of an instant in Visakhapatnam time. */
export const istTime = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso))
/** "YYYY-MM-DD" of an instant in Visakhapatnam time. */
export const istDay = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
/** "{year}" in block text becomes the shown edition's year. */
export const withYear = (s: string, year: number | string | undefined) =>
  year ? s.replace(/\{year\}/g, String(year)) : s
