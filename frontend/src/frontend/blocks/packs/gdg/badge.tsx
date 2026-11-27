'use client'

// DevFest badge studio: four badge styles (event pass, poster, code card, profile picture ring),
// an optional photo (or generated shape art, or initials), square or story size. The event name,
// date and venue come from Admin → GDG Chapter → DevFest. Everything is drawn as SVG in the browser
// and exported to PNG there; the photo never leaves the device.
import {
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import type { ComponentConfig } from '@puckeditor/core'
import { Gdg, TZ, area, initials, lines, shapePath, sfx, text, useDevfestData } from './lib'

// ─── Look and feel ───────────────────────────────────────────────────────────

type Theme = { bg: string; fg: string; shape: string }
const THEMES: Record<string, Theme> = {
  'AI and agents': { bg: '#d3e3fd', fg: '#041e49', shape: '#4285f4' },
  Web: { bg: '#fad2cf', fg: '#410e0b', shape: '#ea4335' },
  Cloud: { bg: '#ffe08a', fg: '#3b2f00', shape: '#fbbc04' },
  Mobile: { bg: '#c4eed0', fg: '#072711', shape: '#34a853' },
  Startups: { bg: '#4285f4', fg: '#ffffff', shape: '#fbbc04' },
  Careers: { bg: '#191c20', fg: '#ffffff', shape: '#34a853' },
}
const CYCLE = Object.values(THEMES)
const themeOf = (track: string, i = 0): Theme =>
  THEMES[track] ?? CYCLE[i % CYCLE.length] ?? CYCLE[0]!
const G = ['#4285f4', '#ea4335', '#fbbc04', '#34a853']
const onShape = (c: string) => (c === '#fbbc04' ? '#3b2f00' : '#ffffff')
const FONT = "'Google Sans Flex','Outfit',system-ui,sans-serif"
const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,'Roboto Mono',monospace"

const LOOKS = {
  pass: { label: 'Event pass', hint: 'A lanyard pass with your tracks' },
  poster: { label: 'Poster', hint: "Big and bold: I'm going" },
  code: { label: 'Code card', hint: 'Your badge as code' },
  ring: { label: 'Profile picture', hint: 'A DevFest ring for your photo' },
} as const
type Look = keyof typeof LOOKS
const LOOK_KEYS = Object.keys(LOOKS) as Look[]

const PICS = { photo: 'Your photo', shapes: 'Shape art', initials: 'Initials' } as const
type Pic = keyof typeof PICS

const FRAMES: Record<string, [number, number]> = {
  Cookie: [8, 0.07],
  Flower: [5, 0.16],
  Clover: [4, 0.2],
  Circle: [4, 0],
}
const FMTS = { square: 'Square · LinkedIn, X', story: 'Story · Instagram, WhatsApp' } as const
type Fmt = keyof typeof FMTS

/** Size of the photo in each look, in badge pixels (the photo is drawn in a 200-unit box). */
const AVATAR: Record<Look, number> = { pass: 260, poster: 400, code: 240, ring: 860 }
const CIRCLE = 'M-100 0a100 100 0 1 0 200 0a100 100 0 1 0 -200 0z'

// ─── Small helpers ───────────────────────────────────────────────────────────

const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
/** Deterministic random numbers, so the same name always gets the same art. */
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
/** Font size that keeps `s` inside `width` (k = average glyph width in em). */
const fit = (s: string, max: number, width: number, k = 0.56) =>
  Math.min(max, width / Math.max(1, s.length * k))

const day = (iso: string, parts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-IN', { timeZone: TZ, ...parts }).format(new Date(iso))
/** "6 December 2026", or "6–7 December 2026" for a two-day event. */
function dateRange(start?: string | null, end?: string | null) {
  if (!start) return ''
  const full = day(start, { day: 'numeric', month: 'long', year: 'numeric' })
  if (!end || day(end, { dateStyle: 'short' }) === day(start, { dateStyle: 'short' })) return full
  const sameMonth =
    day(end, { month: 'long', year: 'numeric' }) === day(start, { month: 'long', year: 'numeric' })
  return sameMonth
    ? `${day(start, { day: 'numeric' })}–${day(end, { day: 'numeric', month: 'long', year: 'numeric' })}`
    : `${day(start, { day: 'numeric', month: 'short' })} – ${day(end, { day: 'numeric', month: 'short', year: 'numeric' })}`
}

// The site font, embedded into the exported image so the PNG looks like the preview.
let fontCss: Promise<string> | null = null
const fontStyle = () =>
  (fontCss ??= fetch('/gdg/fonts/google-sans-flex-latin.woff2')
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('font'))))
    .then(
      (b) =>
        new Promise<string>((resolve) => {
          const fr = new FileReader()
          fr.onload = () =>
            resolve(
              `@font-face{font-family:'Google Sans Flex';font-weight:400 800;src:url(${String(fr.result)}) format('woff2')}`
            )
          fr.onerror = () => resolve('')
          fr.readAsDataURL(b)
        })
    )
    .catch(() => ''))

// ─── Drawing ─────────────────────────────────────────────────────────────────

interface Art {
  t: Theme
  name: string
  role: string
  into: string[]
  here: string
  eventName: string
  when: string
  /** false while `when` is only the "date to be announced" text */
  dated: boolean
  where: string
  footer: string
  passNote: string
  ringText: string
  seed: number
  uid: string
  avatar: (
    cx: number,
    cy: number,
    size: number,
    opts?: { outline?: string; round?: boolean; rotate?: number }
  ) => ReactNode
}

/** Shape art: overlapping Google shapes, the same for the same name. */
function ShapeArt({ seed, t }: { seed: number; t: Theme }) {
  const r = rng(seed)
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)] as T
  const cols = [...G.filter((c) => c !== t.shape), '#ffffff']
  const kinds: [number, number][] = [
    [8, 0.07],
    [5, 0.16],
    [4, 0.2],
    [6, 0.12],
    [4, 0],
  ]
  const spots = [
    { x: -36, y: -28, s: 0.82, c: cols[0] },
    { x: 44, y: 40, s: 0.6, c: cols[1] },
    { x: 48, y: -52, s: 0.32, c: cols[2] },
    { x: -52, y: 60, s: 0.26, c: cols[3] },
  ]
  return (
    <>
      <rect x={-110} y={-110} width={220} height={220} fill={t.shape} />
      {spots.map((p, i) => {
        const [n, amp] = pick(kinds)
        const dx = (r() - 0.5) * 24
        const dy = (r() - 0.5) * 24
        return (
          <path
            key={i}
            d={shapePath(n, amp)}
            fill={p.c}
            transform={`translate(${p.x + dx} ${p.y + dy}) rotate(${Math.round(r() * 360)}) scale(${p.s})`}
          />
        )
      })}
    </>
  )
}

function Chips({ a, y, cx, light }: { a: Art; y: number; cx: number; light?: boolean }) {
  const fs = 24
  const ws = a.into.map((x) => x.length * fs * 0.56 + 44)
  const total = ws.reduce((s, w) => s + w, 0) + (ws.length - 1) * 12
  let x = cx - total / 2
  return (
    <g>
      {a.into.map((track, i) => {
        const th = themeOf(track, i)
        const w = ws[i] ?? 0
        const node = (
          <g key={track}>
            <rect x={x} y={y} width={w} height={46} rx={23} fill={light ? th.bg : th.shape} />
            <text
              x={x + w / 2}
              y={y + 31}
              textAnchor="middle"
              fontFamily={FONT}
              fontSize={fs}
              fontWeight={700}
              fill={light ? th.fg : onShape(th.shape)}
            >
              {track}
            </text>
          </g>
        )
        x += w + 12
        return node
      })}
    </g>
  )
}

function Barcode({
  seed,
  x,
  y,
  w,
  h,
}: {
  seed: number
  x: number
  y: number
  w: number
  h: number
}) {
  const r = rng(seed)
  const bars: ReactNode[] = []
  let at = 0
  for (let i = 0; at < w; i++) {
    const bw = 3 + Math.floor(r() * 9)
    if (at + bw > w) break
    if (i % 2 === 0) {
      const c = i % 14 === 6 ? (G[Math.floor(r() * 4)] ?? '#1f1f1f') : '#1f1f1f'
      bars.push(<rect key={i} x={x + at} y={y} width={bw} height={h} rx={1.5} fill={c} />)
    }
    at += bw
  }
  return <g>{bars}</g>
}

function PassCore(a: Art) {
  const band = `${a.when}${a.when && a.where ? ' · ' : ''}${a.where}`
  const onBand = onShape(a.t.shape)
  return (
    <>
      <rect width={1080} height={1080} fill={a.t.bg} />
      <path
        d={shapePath(5, 0.16)}
        transform="translate(120 930) scale(3.4)"
        fill={a.t.shape}
        opacity={0.35}
      />
      <path
        d={shapePath(8, 0.07)}
        transform="translate(990 150) scale(2.6)"
        fill={a.t.shape}
        opacity={0.35}
      />
      {/* lanyard and clip */}
      <rect x={495} y={-10} width={90} height={200} fill={a.t.shape} />
      <text
        transform="translate(531 28) rotate(90)"
        fontFamily={FONT}
        fontSize={26}
        fontWeight={800}
        letterSpacing={4}
        fill={onBand}
      >
        DEVFEST
      </text>
      <rect x={478} y={168} width={124} height={54} rx={16} fill="#80868b" />
      <rect x={506} y={184} width={68} height={22} rx={10} fill="#5f6368" />
      {/* card */}
      <rect x={255} y={219} width={570} height={850} rx={48} fill="#000" opacity={0.14} />
      <rect x={255} y={205} width={570} height={850} rx={48} fill="#fff" />
      <path d="M255 253a48 48 0 0 1 48-48h474a48 48 0 0 1 48 48v122h-570z" fill={a.t.shape} />
      <rect x={495} y={226} width={90} height={22} rx={11} fill={a.t.bg} />
      <text
        x={540}
        y={300}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize={fit(a.eventName, 46, 500)}
        fontWeight={800}
        fill={onBand}
      >
        {a.eventName}
      </text>
      <text
        x={540}
        y={340}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize={fit(band, 24, 500, 0.52)}
        fontWeight={600}
        fill={onBand}
        opacity={0.92}
      >
        {band}
      </text>
      {a.avatar(540, 490, 250, { outline: '#ffffff' })}
      <text
        x={540}
        y={690}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize={fit(a.name, 60, 500)}
        fontWeight={800}
        letterSpacing={-1}
        fill="#1f1f1f"
      >
        {a.name}
      </text>
      <text
        x={540}
        y={736}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize={28}
        fontWeight={600}
        fill="#444746"
      >
        {a.role}
      </text>
      <Chips a={a} y={764} cx={540} light />
      {a.here ? (
        <text
          x={540}
          y={866}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize={fit(`Here to ${a.here}`, 26, 500, 0.5)}
          fontWeight={500}
          fill="#444746"
        >
          {`Here to ${a.here}`}
        </text>
      ) : null}
      <Barcode seed={a.seed} x={340} y={892} w={400} h={58} />
      <text
        x={540}
        y={992}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize={fit(a.footer, 20, 520, 0.52)}
        fontWeight={600}
        fill="#5f6368"
      >
        {a.footer}
      </text>
      <text
        x={540}
        y={1024}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize={17}
        fontWeight={500}
        fill="#80868b"
      >
        {a.passNote}
      </text>
    </>
  )
}

function PosterCore(a: Art) {
  const r = rng(a.seed ^ 0x9e3779b9)
  const cols = [...G].sort(() => r() - 0.5)
  const deco: [number, number, number, [number, number]][] = [
    [1010, 80, 1.7, [8, 0.07]],
    [70, 1010, 2.1, [5, 0.16]],
    [1000, 880, 0.95, [4, 0.2]],
    [90, 520, 0.55, [4, 0]],
  ]
  const line = `${a.role} · into ${a.into.join(', ')}`
  const when = [a.when, a.where].filter(Boolean).join(' · ')
  return (
    <>
      <rect width={1080} height={1080} fill={a.t.bg} />
      {deco.map(([x, y, s, [n, amp]], i) => (
        <path
          key={i}
          d={shapePath(n, amp)}
          transform={`translate(${x} ${y}) rotate(${Math.round(r() * 90)}) scale(${s})`}
          fill={cols[i]}
        />
      ))}
      <text x={90} y={150} fontFamily={FONT} fontSize={44} fontWeight={600} fill={a.t.fg}>
        I&apos;m going to
      </text>
      <text
        x={90}
        y={242}
        fontFamily={FONT}
        fontSize={fit(a.eventName, 90, 760)}
        fontWeight={800}
        letterSpacing={-2}
        fill={a.t.fg}
      >
        {a.eventName}
      </text>
      {a.avatar(540, 545, 390, { outline: '#ffffff' })}
      <text
        x={540}
        y={838}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize={fit(a.name, 76, 900)}
        fontWeight={800}
        letterSpacing={-2}
        fill={a.t.fg}
      >
        {a.name}
      </text>
      <text
        x={540}
        y={890}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize={fit(line, 32, 900, 0.52)}
        fontWeight={600}
        fill={a.t.fg}
        opacity={0.88}
      >
        {line}
      </text>
      {a.here ? (
        <text
          x={540}
          y={936}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize={fit(`Here to ${a.here}`, 28, 800, 0.5)}
          fontWeight={500}
          fill={a.t.fg}
          opacity={0.8}
        >
          {`Here to ${a.here}`}
        </text>
      ) : null}
      {when ? (
        <text
          x={540}
          y={994}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize={fit(when, 26, 800, 0.52)}
          fontWeight={700}
          fill={a.t.fg}
        >
          {when}
        </text>
      ) : null}
      <text
        x={540}
        y={1036}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize={fit(a.footer, 21, 800, 0.52)}
        fontWeight={600}
        fill={a.t.fg}
        opacity={0.7}
      >
        {a.footer}
      </text>
    </>
  )
}

type Tok = [string, string]
const INK = {
  kw: '#c58af9',
  pr: '#8ab4f8',
  st: '#81c995',
  pu: '#e3e3e3',
  fn: '#fdd663',
  cm: '#9aa0a6',
  num: '#5f6368',
}

function CodeCore(a: Art) {
  const q = (s: string) => `"${s.replace(/"/g, "'")}"`
  const rows: Tok[][] = [
    [
      ['const', INK.kw],
      [' me ', INK.pu],
      ['= {', INK.pu],
    ],
    [
      ['  name', INK.pr],
      [': ', INK.pu],
      [q(a.name), INK.st],
      [',', INK.pu],
    ],
    [
      ['  role', INK.pr],
      [': ', INK.pu],
      [q(a.role), INK.st],
      [',', INK.pu],
    ],
    [
      ['  into', INK.pr],
      [': [', INK.pu],
      [a.into.map(q).join(', '), INK.st],
      ['],', INK.pu],
    ],
    ...(a.here
      ? [
          [
            ['  hereTo', INK.pr],
            [': ', INK.pu],
            [q(a.here), INK.st],
            [',', INK.pu],
          ] as Tok[],
        ]
      : []),
    [['}', INK.pu]],
    [],
    [
      ['await ', INK.kw],
      ['devfest', INK.pu],
      ['.', INK.pu],
      ['join', INK.fn],
      ['(me)', INK.pu],
    ],
    [[`// ✓ ${a.dated ? `See you on ${a.when}` : `See you at ${a.eventName}`}`, INK.cm]],
  ]
  const top = 250
  const step = 58
  const joinRow = rows.length - 2
  return (
    <>
      <rect width={1080} height={1080} fill={a.t.bg} />
      <path
        d={shapePath(8, 0.07)}
        transform="translate(1010 1010) scale(3)"
        fill={a.t.shape}
        opacity={0.4}
      />
      <path
        d={shapePath(5, 0.16)}
        transform="translate(60 60) scale(1.4)"
        fill={a.t.shape}
        opacity={0.4}
      />
      <rect x={70} y={104} width={940} height={860} rx={36} fill="#000" opacity={0.2} />
      <rect x={70} y={90} width={940} height={860} rx={36} fill="#1e1f22" />
      <path d="M70 126a36 36 0 0 1 36-36h868a36 36 0 0 1 36 36v44h-940z" fill="#2b2d31" />
      {['#ea4335', '#fbbc04', '#34a853'].map((c, i) => (
        <circle key={c} cx={118 + i * 34} cy={130} r={11} fill={c} />
      ))}
      <text x={232} y={139} fontFamily={MONO} fontSize={24} fill="#c4c7c5">
        devfest-vizag.ts
      </text>
      <text
        x={980}
        y={139}
        textAnchor="end"
        fontFamily={FONT}
        fontSize={fit(a.eventName, 24, 380, 0.52)}
        fontWeight={700}
        fill="#8e918f"
      >
        {a.eventName}
      </text>
      {rows.map((row, i) => {
        const chars = row.reduce((n, [s]) => n + s.length, 0)
        const fs = fit('x'.repeat(chars), 34, 800, 0.6)
        const y = top + i * step
        return (
          <g key={i}>
            <text x={140} y={y} textAnchor="end" fontFamily={MONO} fontSize={26} fill={INK.num}>
              {i + 1}
            </text>
            <text x={170} y={y} fontFamily={MONO} fontSize={fs} xmlSpace="preserve">
              {row.map(([s, c], j) => (
                <tspan key={j} fill={c}>
                  {s}
                </tspan>
              ))}
            </text>
            {i === joinRow ? (
              <rect
                x={170 + chars * fs * 0.6 + 6}
                y={y - fs * 0.8}
                width={fs * 0.55}
                height={fs}
                fill="#8ab4f8"
              />
            ) : null}
          </g>
        )
      })}
      <text
        x={110}
        y={914}
        fontFamily={FONT}
        fontSize={fit(a.footer, 22, 600, 0.52)}
        fontWeight={600}
        fill="#8e918f"
      >
        {a.footer}
      </text>
      {a.avatar(880, 850, 240, { outline: '#ffffff', rotate: -6 })}
    </>
  )
}

function RingCore(a: Art) {
  const R = 485
  const arc = (a0: number, a1: number) => {
    const p = (deg: number) => {
      const r = (deg * Math.PI) / 180
      return `${(540 + R * Math.cos(r)).toFixed(1)} ${(540 + R * Math.sin(r)).toFixed(1)}`
    }
    return `M${p(a0)}A${R} ${R} 0 0 1 ${p(a1)}`
  }
  // Top text runs over the top, bottom text along the bottom, both upright ("top | bottom").
  const [top = '', bottom = ''] = a.ringText.split('|').map((x) => x.trim())
  const up = 466
  const down = 504
  const topId = `${a.uid}-ring-top`
  const bottomId = `${a.uid}-ring-bottom`
  const ringText = (id: string, str: string, r: number) => (
    <text
      fontFamily={FONT}
      fontSize={fit(str, 50, Math.PI * r - 120, 0.68)}
      fontWeight={800}
      fill="#ffffff"
      stroke="rgba(0,0,0,.3)"
      strokeWidth={6}
      paintOrder="stroke"
      letterSpacing={3}
      textAnchor="middle"
    >
      <textPath href={`#${id}`} startOffset="50%">
        {str}
      </textPath>
    </text>
  )
  return (
    <>
      <rect width={1080} height={1080} fill={a.t.bg} />
      {a.avatar(540, 540, 860, { round: true })}
      {G.map((c, i) => (
        <path
          key={c}
          d={arc(-180 + i * 90, -90 + i * 90)}
          stroke={c}
          strokeWidth={112}
          fill="none"
        />
      ))}
      <path id={topId} d={`M${540 - up} 540A${up} ${up} 0 0 1 ${540 + up} 540`} fill="none" />
      <path
        id={bottomId}
        d={`M${540 - down} 540A${down} ${down} 0 0 0 ${540 + down} 540`}
        fill="none"
      />
      {top ? ringText(topId, top, up) : null}
      {bottom ? ringText(bottomId, bottom, down) : null}
    </>
  )
}

function StoryFrame({ a, look, children }: { a: Art; look: Look; children: ReactNode }) {
  const when = a.when || ''
  return (
    <>
      <rect width={1080} height={1920} fill={a.t.bg} />
      {look === 'poster' ? (
        <text
          x={540}
          y={200}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize={56}
          fontWeight={800}
          fill={a.t.fg}
        >
          #DevFestVizag
        </text>
      ) : (
        <>
          <text
            x={540}
            y={150}
            textAnchor="middle"
            fontFamily={FONT}
            fontSize={40}
            fontWeight={600}
            fill={a.t.fg}
            opacity={0.8}
          >
            See you at
          </text>
          <text
            x={540}
            y={236}
            textAnchor="middle"
            fontFamily={FONT}
            fontSize={fit(a.eventName, 78, 960)}
            fontWeight={800}
            letterSpacing={-2}
            fill={a.t.fg}
          >
            {a.eventName}
          </text>
        </>
      )}
      <g transform="translate(0 330)">{children}</g>
      {when ? (
        <text
          x={540}
          y={1540}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize={fit(when, a.dated ? 58 : 40, 960)}
          fontWeight={800}
          fill={a.t.fg}
        >
          {when}
        </text>
      ) : null}
      {a.where ? (
        <text
          x={540}
          y={1610}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize={fit(a.where, 36, 960, 0.52)}
          fontWeight={600}
          fill={a.t.fg}
          opacity={0.85}
        >
          {a.where}
        </text>
      ) : null}
      <text
        x={540}
        y={1820}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize={fit(a.footer, 26, 960, 0.52)}
        fontWeight={600}
        fill={a.t.fg}
        opacity={0.7}
      >
        {a.footer}
      </text>
    </>
  )
}

// ─── The block ───────────────────────────────────────────────────────────────

type BadgeProps = {
  title: string
  sub: string
  nameLabel: string
  eventLine: string
  footerLine: string
  caption: string
  roles: string
  hereLabel: string
  herePlaceholder: string
  passNote: string
  ringText: string
  dateTbd: string
  privacyNote: string
}

const DEFAULTS: BadgeProps = {
  title: 'Make your badge',
  sub: 'Pick a style, add your name and, if you like, your photo. Download it for LinkedIn, your story or your profile picture.',
  nameLabel: 'Your name',
  eventLine: 'DevFest Vizag 2026',
  footerLine: 'Google Developer Groups Vizag  #DevFestVizag',
  caption:
    "I'm joining DevFest Vizag 2026 with Google Developer Groups Vizag! #DevFest #DevFestVizag",
  roles: 'Student\nDeveloper\nDesigner\nFounder\nCurious',
  hereLabel: 'I am here to (optional)',
  herePlaceholder: 'ship my first agent',
  passNote: 'Fan badge · not an entry ticket',
  ringText: "I'M GOING TO {event} | #DEVFESTVIZAG",
  dateTbd: 'Date to be announced',
  privacyNote: 'Your photo stays on this device. Nothing is uploaded.',
}

export const GdgBadgeMaker: ComponentConfig<BadgeProps> = {
  label: 'GDG Badge Maker',
  fields: {
    title: text('Title'),
    sub: area('Intro'),
    nameLabel: text('Name field label'),
    eventLine: text('Event name when Admin → DevFest has no current edition'),
    footerLine: text('Bottom line on the badge'),
    caption: area('Share caption'),
    roles: area('"I am a" choices (one per line)'),
    hereLabel: text('"Here to" field label'),
    herePlaceholder: text('"Here to" example text'),
    passNote: text('Small print on the event pass'),
    ringText: text('Text around the profile picture: top | bottom ({event} = event name)'),
    dateTbd: text('Shown while the date is not set in Admin → DevFest'),
    privacyNote: text('Photo privacy note'),
  },
  defaultProps: DEFAULTS,
  render: function Render({ puck, ...raw }) {
    // Pages saved before a field existed have no value for it: fall back to the default.
    const p = Object.fromEntries(
      Object.entries(DEFAULTS).map(([k, v]) => [
        k,
        (raw as Partial<BadgeProps>)[k as keyof BadgeProps] ?? v,
      ])
    ) as BadgeProps
    const df = useDevfestData(puck?.metadata?.projectId as string | undefined)
    const ed = df.edition
    const trackList = ed?.tracks?.length ? ed.tracks.map((t) => t.name) : Object.keys(THEMES)
    const roleList = lines(p.roles)
      .map(([r = '']) => r)
      .filter(Boolean)
    const uid = 'b' + useId().replace(/[^a-zA-Z0-9]/g, '')

    const [s, setS] = useState({
      look: 'pass' as Look,
      fmt: 'square' as Fmt,
      frame: 'Cookie',
      pic: 'shapes' as Pic,
      name: '',
      role: roleList.includes('Developer') ? 'Developer' : (roleList[0] ?? ''),
      into: [] as string[],
      here: '',
      photo: '',
      zoom: 1,
      ox: 0,
      oy: 0,
      spin: 0,
    })
    const [note, setNote] = useState('')
    const svgRef = useRef<SVGSVGElement>(null)
    const fileRef = useRef<HTMLInputElement>(null)
    const camRef = useRef<HTMLInputElement>(null)
    const drag = useRef<{ x: number; y: number } | null>(null)
    const set = (patch: Partial<typeof s>) => setS((st) => ({ ...st, ...patch }))

    const into = s.into.length ? s.into : trackList.slice(0, 1)
    const t = themeOf(into[0] ?? '', trackList.indexOf(into[0] ?? ''))
    const name = s.name.trim() || p.nameLabel
    const fmt: Fmt = s.look === 'ring' ? 'square' : s.fmt
    const H = fmt === 'story' ? 1920 : 1080
    const eventName = ed?.name || p.eventLine
    const dated = dateRange(ed?.start, ed?.end)
    const when = dated || p.dateTbd
    const seed = hash(`${s.name.trim().toLowerCase()}|${s.spin}`)
    const usePhoto = s.pic === 'photo' && !!s.photo
    const maxShift = (z: number) => 100 * (z - 1)
    const clamp = (v: number, z: number) => Math.max(-maxShift(z), Math.min(maxShift(z), v))

    let avatarN = 0
    const avatar: Art['avatar'] = (cx, cy, size, opts = {}) => {
      const [n, amp] = FRAMES[s.frame] ?? [8, 0.07]
      const d = opts.round ? CIRCLE : shapePath(n, amp)
      const clip = `${uid}-av${avatarN++}`
      const z = s.zoom
      return (
        <g transform={`translate(${cx} ${cy}) rotate(${opts.rotate ?? 0}) scale(${size / 200})`}>
          <clipPath id={clip}>
            <path d={d} />
          </clipPath>
          {opts.outline ? <path d={d} transform="scale(1.07)" fill={opts.outline} /> : null}
          <g clipPath={`url(#${clip})`}>
            {usePhoto ? (
              <>
                <rect x={-110} y={-110} width={220} height={220} fill={t.shape} />
                <image
                  href={s.photo}
                  x={-100 * z + s.ox}
                  y={-100 * z + s.oy}
                  width={200 * z}
                  height={200 * z}
                  preserveAspectRatio="xMidYMid slice"
                />
              </>
            ) : s.pic === 'initials' ? (
              <>
                <rect x={-110} y={-110} width={220} height={220} fill={t.shape} />
                <text
                  y={opts.round ? 26 : 28}
                  textAnchor="middle"
                  fontFamily={FONT}
                  fontSize={opts.round ? 80 : 84}
                  fontWeight={800}
                  fill={onShape(t.shape)}
                >
                  {initials(name).toUpperCase() || '?'}
                </text>
              </>
            ) : (
              <ShapeArt seed={seed} t={t} />
            )}
          </g>
        </g>
      )
    }

    const art: Art = {
      t,
      name,
      role: s.role,
      into,
      here: s.here.trim(),
      eventName,
      when,
      dated: !!dated,
      where: ed?.venue ?? '',
      footer: p.footerLine,
      passNote: p.passNote,
      ringText: p.ringText.replace(/\{event\}/g, eventName.toUpperCase()),
      seed,
      uid,
      avatar,
    }
    const core =
      s.look === 'poster'
        ? PosterCore(art)
        : s.look === 'code'
          ? CodeCore(art)
          : s.look === 'ring'
            ? RingCore(art)
            : PassCore(art)

    // ── photo ──
    const loadPhoto = (file: File | undefined) => {
      if (!file) return
      if (!file.type.startsWith('image/')) {
        setNote('Choose an image file (JPG, PNG or HEIC).')
        return
      }
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        const side = Math.min(img.width, img.height)
        const c = document.createElement('canvas')
        c.width = c.height = 1000
        c.getContext('2d')?.drawImage(
          img,
          (img.width - side) / 2,
          (img.height - side) / 2,
          side,
          side,
          0,
          0,
          1000,
          1000
        )
        URL.revokeObjectURL(url)
        set({ photo: c.toDataURL('image/jpeg', 0.9), pic: 'photo', zoom: 1, ox: 0, oy: 0 })
        setNote('Photo added. Zoom in, then drag the preview or use the sliders to place it.')
        sfx('tick')
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        setNote('Could not read that photo. Try a JPG or PNG.')
      }
      img.src = url
    }

    const k = AVATAR[s.look] / 200
    const onDown = (e: ReactPointerEvent<SVGSVGElement>) => {
      if (!usePhoto) return
      drag.current = { x: e.clientX, y: e.clientY }
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
      if (!drag.current) return
      const box = e.currentTarget.getBoundingClientRect()
      const unit = 1080 / box.width / k
      const dx = (e.clientX - drag.current.x) * unit
      const dy = (e.clientY - drag.current.y) * unit
      drag.current = { x: e.clientX, y: e.clientY }
      setS((st) => ({ ...st, ox: clamp(st.ox + dx, st.zoom), oy: clamp(st.oy + dy, st.zoom) }))
    }
    const onUp = () => {
      drag.current = null
    }
    // ── export ──
    const badgeBlob = async () => {
      const svg = svgRef.current
      if (!svg) throw new Error('no preview')
      const css = await fontStyle()
      let xml = new XMLSerializer().serializeToString(svg)
      if (!xml.includes('xmlns="http://www.w3.org/2000/svg"'))
        xml = xml.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
      xml = xml.replace(/<svg([^>]*)>/, `<svg$1 width="1080" height="${H}"><style>${css}</style>`)
      const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }))
      try {
        const img = new Image()
        img.src = url
        await img.decode()
        const c = document.createElement('canvas')
        c.width = 1080
        c.height = H
        c.getContext('2d')?.drawImage(img, 0, 0, 1080, H)
        return await new Promise<Blob>((resolve, reject) =>
          c.toBlob((b) => (b ? resolve(b) : reject(new Error('export failed'))), 'image/png')
        )
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    const fileName = () => `devfest-vizag-${s.look}${s.look === 'ring' ? '' : `-${fmt}`}.png`
    const download = async () => {
      try {
        const blob = await badgeBlob()
        const a = document.createElement('a')
        const href = URL.createObjectURL(blob)
        a.href = href
        a.download = fileName()
        a.click()
        setTimeout(() => URL.revokeObjectURL(href), 10_000)
        setNote(`Badge downloaded (1080 x ${H} px).`)
        sfx('win')
      } catch {
        setNote('Could not create the image. Take a screenshot of the preview instead.')
      }
    }
    const share = async () => {
      try {
        const blob = await badgeBlob()
        const file = new File([blob], fileName(), { type: 'image/png' })
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: p.caption })
          return
        }
        await navigator.clipboard.writeText(p.caption)
        setNote('Caption copied. Download the badge and post them together.')
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        setNote('Sharing is not available here. Download the badge and post it yourself.')
      }
    }
    const surprise = () => {
      const r = rng(Date.now())
      const shuffled = [...trackList].sort(() => r() - 0.5)
      const frames = Object.keys(FRAMES)
      set({
        look: LOOK_KEYS[Math.floor(r() * LOOK_KEYS.length)] ?? 'pass',
        frame: frames[Math.floor(r() * frames.length)] ?? 'Cookie',
        into: shuffled.slice(0, 1 + Math.floor(r() * 3)),
        spin: s.spin + 1,
      })
      sfx('tick')
    }

    const chips = <T extends string>(
      legend: string,
      key: 'fmt' | 'frame' | 'role' | 'pic',
      items: [T, string][]
    ) => (
      <fieldset className="choice">
        <legend>{legend}</legend>
        {items.map(([value, label]) => (
          <label key={value}>
            <input
              type="radio"
              name={`${uid}-${key}`}
              value={value}
              checked={s[key] === value}
              onChange={() => {
                if (key === 'pic' && value === 'photo' && !s.photo) fileRef.current?.click()
                set({ [key]: value } as Partial<typeof s>)
                sfx('tick')
              }}
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
    )

    return (
      <Gdg>
        <section id="badge" className="block" aria-labelledby="badge-h">
          <div className="badge-wrap studio">
            <div className="badge-form">
              <h2 id="badge-h">{p.title}</h2>
              <p className="sub">{p.sub}</p>

              <fieldset className="look-pick">
                <legend>1. Pick a style</legend>
                {LOOK_KEYS.map((key) => (
                  <label key={key}>
                    <input
                      type="radio"
                      name={`${uid}-look`}
                      value={key}
                      checked={s.look === key}
                      onChange={() => {
                        set({ look: key })
                        sfx('tick')
                      }}
                    />
                    <span>
                      <LookIcon look={key} />
                      <b>{LOOKS[key].label}</b>
                      <small>{LOOKS[key].hint}</small>
                    </span>
                  </label>
                ))}
              </fieldset>

              <fieldset className="studio-step">
                <legend>2. About you</legend>
                <label className="field">
                  {p.nameLabel}
                  <input
                    maxLength={22}
                    placeholder={p.nameLabel}
                    autoComplete="name"
                    value={s.name}
                    onChange={(e) => set({ name: e.target.value })}
                  />
                </label>
                {chips(
                  'I am a',
                  'role',
                  roleList.map((r) => [r, r] as [string, string])
                )}
                <fieldset className="choice">
                  <legend>I am into (up to 3; the first sets the colours)</legend>
                  {trackList.map((track) => {
                    const on = into.includes(track)
                    return (
                      <label key={track}>
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={!on && into.length >= 3}
                          onChange={() => {
                            const next = on ? into.filter((x) => x !== track) : [...into, track]
                            set({ into: next.length ? next : into })
                            sfx('tick')
                          }}
                        />
                        <span>{track}</span>
                      </label>
                    )
                  })}
                </fieldset>
                {s.look !== 'ring' ? (
                  <label className="field">
                    {p.hereLabel}
                    <input
                      maxLength={24}
                      placeholder={p.herePlaceholder}
                      value={s.here}
                      onChange={(e) => set({ here: e.target.value })}
                    />
                  </label>
                ) : null}
              </fieldset>

              <fieldset className="studio-step">
                <legend>3. Your picture</legend>
                {chips('Show', 'pic', Object.entries(PICS) as [Pic, string][])}
                <div className="photo-row">
                  <button
                    className="btn btn-sm btn-tonal"
                    type="button"
                    onClick={() => fileRef.current?.click()}
                  >
                    {s.photo ? 'Change photo' : 'Upload photo'}
                  </button>
                  <button
                    className="btn btn-sm btn-tonal"
                    type="button"
                    onClick={() => camRef.current?.click()}
                  >
                    Take a selfie
                  </button>
                  {s.photo ? (
                    <button
                      className="btn btn-sm btn-ghost"
                      type="button"
                      onClick={() => {
                        set({ photo: '', pic: 'shapes' })
                        setNote('Photo removed.')
                      }}
                    >
                      Remove photo
                    </button>
                  ) : null}
                  {s.pic === 'shapes' ? (
                    <button
                      className="btn btn-sm btn-ghost"
                      type="button"
                      onClick={() => set({ spin: s.spin + 1 })}
                    >
                      New shapes
                    </button>
                  ) : null}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      loadPhoto(e.target.files?.[0])
                      e.target.value = ''
                    }}
                  />
                  <input
                    ref={camRef}
                    type="file"
                    accept="image/*"
                    capture="user"
                    hidden
                    onChange={(e) => {
                      loadPhoto(e.target.files?.[0])
                      e.target.value = ''
                    }}
                  />
                </div>
                {usePhoto ? (
                  <label className="zoom">
                    Zoom
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.01}
                      value={s.zoom}
                      onChange={(e) => {
                        const zoom = Number(e.target.value)
                        set({ zoom, ox: clamp(s.ox, zoom), oy: clamp(s.oy, zoom) })
                      }}
                    />
                    <button
                      className="btn btn-sm btn-ghost"
                      type="button"
                      onClick={() => set({ zoom: 1, ox: 0, oy: 0 })}
                    >
                      Reset
                    </button>
                  </label>
                ) : null}
                {usePhoto && s.zoom > 1.01 ? (
                  <div className="zoom-move">
                    {(['ox', 'oy'] as const).map((axis) => (
                      <label key={axis} className="zoom">
                        {axis === 'ox' ? 'Left / right' : 'Up / down'}
                        <input
                          type="range"
                          min={-maxShift(s.zoom)}
                          max={maxShift(s.zoom)}
                          step={1}
                          value={s[axis]}
                          onChange={(e) => set({ [axis]: Number(e.target.value) })}
                        />
                      </label>
                    ))}
                  </div>
                ) : null}
                <p className="note privacy">{p.privacyNote}</p>
                {s.look !== 'ring'
                  ? chips(
                      'Frame',
                      'frame',
                      Object.keys(FRAMES).map((f) => [f, f] as [string, string])
                    )
                  : null}
              </fieldset>

              {s.look !== 'ring'
                ? chips('4. Size', 'fmt', Object.entries(FMTS) as [Fmt, string][])
                : null}

              <div className="cta">
                <button className="btn" type="button" onClick={download}>
                  Download PNG
                </button>
                <button className="btn btn-tonal" type="button" onClick={share}>
                  Share
                </button>
                <button className="btn btn-ghost" type="button" onClick={surprise}>
                  Surprise me
                </button>
              </div>
              <p className="note" role="status">
                {note}
              </p>
            </div>
            <div
              className={`badge-preview${usePhoto ? ' can-move' : ''}${fmt === 'story' ? ' tall' : ''}`}
            >
              <svg
                ref={svgRef}
                className="badge-svg"
                viewBox={`0 0 1080 ${H}`}
                role="img"
                aria-label={`${LOOKS[s.look].label} badge for ${name}, ${eventName}`}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
              >
                {fmt === 'story' ? (
                  <StoryFrame a={art} look={s.look}>
                    {core}
                  </StoryFrame>
                ) : (
                  core
                )}
              </svg>
              {s.look === 'ring' ? <p className="note">Shown round on most apps.</p> : null}
            </div>
          </div>
        </section>
      </Gdg>
    )
  },
}

function LookIcon({ look }: { look: Look }) {
  const common = { width: 44, height: 44, viewBox: '0 0 44 44', 'aria-hidden': true as const }
  if (look === 'pass')
    return (
      <svg {...common}>
        <rect x={19} y={0} width={6} height={10} fill="#4285f4" />
        <rect
          x={9}
          y={8}
          width={26}
          height={34}
          rx={6}
          fill="#fff"
          stroke="currentColor"
          strokeWidth={2}
        />
        <rect x={9} y={8} width={26} height={10} rx={5} fill="#4285f4" />
        <circle cx={22} cy={24} r={5} fill="#34a853" />
        <rect x={14} y={33} width={16} height={4} rx={2} fill="currentColor" />
      </svg>
    )
  if (look === 'poster')
    return (
      <svg {...common}>
        <rect x={2} y={2} width={40} height={40} rx={8} fill="#ffe08a" />
        <circle cx={36} cy={8} r={8} fill="#ea4335" />
        <circle cx={8} cy={38} r={9} fill="#4285f4" />
        <circle cx={22} cy={23} r={8} fill="#34a853" />
        <rect x={7} y={8} width={18} height={4} rx={2} fill="#3b2f00" />
      </svg>
    )
  if (look === 'code')
    return (
      <svg {...common}>
        <rect x={2} y={4} width={40} height={36} rx={7} fill="#1e1f22" />
        <path
          d="M15 16l-5 6 5 6M29 16l5 6-5 6"
          stroke="#8ab4f8"
          strokeWidth={2.6}
          fill="none"
          strokeLinecap="round"
        />
        <path d="M24 14l-4 16" stroke="#81c995" strokeWidth={2.6} strokeLinecap="round" />
      </svg>
    )
  return (
    <svg {...common}>
      {G.map((c, i) => (
        <path
          key={c}
          d={
            [
              'M4 22A18 18 0 0 1 22 4',
              'M22 4A18 18 0 0 1 40 22',
              'M40 22A18 18 0 0 1 22 40',
              'M22 40A18 18 0 0 1 4 22',
            ][i]
          }
          stroke={c}
          strokeWidth={6}
          fill="none"
        />
      ))}
      <circle cx={22} cy={22} r={12} fill="#d3e3fd" />
      <circle cx={22} cy={19} r={4} fill="#041e49" />
      <path d="M14 30a8 7 0 0 1 16 0" fill="#041e49" />
    </svg>
  )
}
