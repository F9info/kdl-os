// ─────────────────────────────────────────────────────────────────────────────
// ThemeDevicePreviews — the default native app-shell + the Theme Color palette
// and Typography specimen previews (KDL-202, sub-task 1/3).
//
// Ported from the prototype (template-engine.html):
//   • native mini-app shells .......... `.mini-app`/`.mini-native`/`.mini-appbar`
//                                        CSS lines 331–358, render ~1863–1910
//   • palette swatch cards ............ `.palette .sw` CSS lines 213–224,
//                                        `swatchCard()` render lines 1552–1567
//   • typography type specimen ........ `.typo-preview` CSS lines 359–360,
//                                        `updateTypoPreview()` render 1913–1929
//
// Colours in the default shell use the app's Tailwind theme tokens (card,
// primary, secondary, accent, muted, border, foreground, muted-foreground),
// which KDL-199 wired to the live `--branding_*` CSS variables — so the shell
// reflects the current theme without needing the raw colour values passed in.
// ─────────────────────────────────────────────────────────────────────────────

// Local, intentionally decoupled from page.tsx's TEPane (duplicate is fine —
// avoids a hard import coupling; integration KDL-205 passes a compatible shape).
export interface TEPaneLite {
  id: string
  label: string
  groups: {
    id: string
    name: string
    slug: string
    fields: { id: string; field_name: string; value: string }[]
  }[]
}

type Values = Record<string, string>

// ── helpers ──────────────────────────────────────────────────────────────────

/** Resolve a field's live value: local unsaved edit wins over the saved value. */
const resolve = (field: { id: string; value: string }, values: Values): string =>
  values[field.id] ?? field.value

/** Convert a hex colour to a `rgb(r, g, b)` string (prototype `hexToRgb`, but in
 *  the css `rgb(...)` form the issue spec asks for). Returns '' for bad input. */
function hexToRgb(hex: string): string {
  const raw = String(hex).replace('#', '')
  const full = (
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw
  ).slice(0, 6)
  const n = parseInt(full, 16)
  if (full.length < 6 || Number.isNaN(n)) return ''
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

/** Find a group by (case-insensitive) name; the first match wins. */
const groupByName = (pane: TEPaneLite, name: string) =>
  pane.groups.find((g) => g.name.toLowerCase() === name.toLowerCase())

/** Resolved value of a named field inside a named group ('' when absent). */
function fieldValue(
  pane: TEPaneLite,
  groupName: string,
  fieldName: string,
  values: Values
): string {
  const field = groupByName(pane, groupName)?.fields.find(
    (f) => f.field_name.toLowerCase() === fieldName.toLowerCase()
  )
  return field ? resolve(field, values) : ''
}

// ── DefaultShellPreview ────────────────────────────────────────────────────────
// The native mini-app content shown by default inside the DeviceShell for
// panes without a dedicated component preview. Sub-task 2 overrides specific
// panes; this owns only the *default*.

function ShellCard() {
  return (
    <div className="max-w-[260px] rounded-lg border border-border bg-card p-3">
      <b className="mb-1 block text-[13px] text-foreground">Card title</b>
      <p className="my-0.5 text-[11.5px] text-foreground">
        Body text sample with a <span className="text-primary">link</span>.
      </p>
      <p className="my-0.5 text-[10px] text-muted-foreground">Secondary text</p>
    </div>
  )
}

export function DefaultShellPreview({ platform }: { platform: string }): JSX.Element {
  // Android / iOS — App Bar + content + Bottom/Tab bar (Material / HIG)
  if (platform === 'android' || platform === 'ios') {
    const ios = platform === 'ios'
    const tabs: [string, string][] = [
      ['🏠', 'Home'],
      ['🔍', 'Search'],
      [ios ? '♡' : '🔔', ios ? 'Saved' : 'Alerts'],
      ['👤', 'Profile'],
    ]
    return (
      <div className="flex flex-1 flex-col bg-background">
        {/* App / Nav bar */}
        <div className="flex items-center gap-2.5 border-b border-border bg-muted px-3 py-2.5 text-xs text-foreground">
          {ios ? (
            <>
              <span className="text-[15px] leading-none text-primary">‹</span>
              <b className="flex-1 text-center text-[12.5px] font-semibold">Page Title</b>
              <span className="text-primary">＋</span>
            </>
          ) : (
            <>
              <span>☰</span>
              <b className="text-[12.5px] font-semibold">Page Title</b>
              <span className="ml-auto">⋮</span>
            </>
          )}
        </div>
        {/* Content + FAB (Android only) */}
        <div className="relative flex-1 p-3.5">
          <ShellCard />
          {!ios && (
            <span className="absolute bottom-3.5 right-3.5 flex h-[34px] w-[34px] items-center justify-center rounded-xl bg-primary text-base text-primary-foreground shadow-[0_4px_12px_rgba(0,0,0,.35)]">
              ＋
            </span>
          )}
        </div>
        {/* Bottom / Tab bar */}
        <div className="mt-auto border-t border-border bg-muted">
          <div className="flex px-1 py-1.5">
            {tabs.map(([icon, label], i) => (
              <span
                key={label}
                className={`flex flex-1 flex-col items-center gap-0.5 text-[8.5px] ${
                  i === 0 ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <i className="text-[13px] not-italic">{icon}</i>
                {label}
              </span>
            ))}
          </div>
          {ios && (
            <div className="mx-auto mb-1.5 mt-0.5 h-1 w-[66px] rounded-full bg-foreground opacity-60" />
          )}
        </div>
      </div>
    )
  }

  // TV — side rail + focus ring on the featured shelf
  if (platform === 'tv') {
    return (
      <div className="flex flex-1 bg-background">
        <div className="flex w-[74px] flex-col gap-3 border-r border-border bg-muted px-2.5 py-3.5 text-[9.5px]">
          <b className="text-primary">◉ Home</b>
          <span className="text-muted-foreground">▤ Library</span>
          <span className="text-muted-foreground">⚙ Settings</span>
        </div>
        <div className="flex-1 p-3.5">
          <b className="text-[13px] text-foreground">Featured</b>
          <div className="mt-2.5 flex gap-2">
            <span className="h-[46px] flex-1 rounded-md border border-primary bg-card outline outline-2 outline-offset-1 outline-primary" />
            <span className="h-[46px] flex-1 rounded-md border border-border bg-card" />
            <span className="h-[46px] flex-1 rounded-md border border-border bg-card" />
          </div>
          <p className="mt-2.5 text-[10.5px] text-foreground">
            Body text sample with a <span className="text-primary">link</span>.
          </p>
        </div>
      </div>
    )
  }

  // Web App — mini admin: sidebar (brand chips) + header + content card
  return (
    <div className="flex flex-1 bg-background">
      <div className="flex w-[46px] flex-col gap-1.5 border-r border-border bg-muted px-2 py-2.5">
        <span className="block h-2.5 rounded bg-primary" />
        <span className="block h-2.5 rounded bg-secondary" />
        <span className="block h-2.5 rounded bg-accent" />
      </div>
      <div className="flex flex-1 flex-col">
        <div className="border-b border-border bg-muted px-3.5 py-2 text-[11px] font-bold text-foreground">
          Header
        </div>
        <div className="flex-1 p-3.5">
          <ShellCard />
        </div>
      </div>
    </div>
  )
}

// ── PalettePreview (Theme Color pane, id === 'branding') ─────────────────────────
// One swatch card per brand/surface colour field in the pane's visible groups
// (Brand Colors, Surfaces, Text & Interaction) — swatch + name + hex + rgb().

const PALETTE_GROUPS = ['Brand Colors', 'Surfaces', 'Text & Interaction']

export function PalettePreview({
  pane,
  values,
}: {
  pane: TEPaneLite
  values: Values
}): JSX.Element {
  // Cards for the colour groups, in the prototype's order. Fall back to every
  // group when the expected names aren't present (keeps it robust to schema drift).
  const groups = pane.groups.filter((g) =>
    PALETTE_GROUPS.some((n) => n.toLowerCase() === g.name.toLowerCase())
  )
  const source = groups.length ? groups : pane.groups
  const cards = source.flatMap((g) =>
    g.fields.map((f) => ({ id: f.id, name: f.field_name, hex: resolve(f, values) }))
  )

  return (
    <div className="grid grid-cols-2 gap-2.5 p-3.5">
      {cards.map((c) => (
        <div key={c.id} className="rounded-[10px] border border-border bg-muted p-3">
          <div
            className="h-11 w-full rounded-[7px] border border-border"
            style={{ background: c.hex }}
          />
          <div className="mt-2.5 text-[12.5px] font-semibold uppercase tracking-[0.04em] text-foreground">
            {c.name}
          </div>
          <div className="mt-0.5 font-mono text-[12.5px] text-muted-foreground">{c.hex}</div>
          <div className="font-mono text-[11.5px] text-muted-foreground opacity-80">
            {hexToRgb(c.hex)}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── TypographyPreview (Typography pane, id === 'typography') ──────────────────────
// A type-specimen sheet: H1–H6 + body + small, each sized/weighted/spaced per
// the pane's "Typography Scale" table (first device group found) — one row per
// text style, replacing the old separate Font Size / Font Weight / Text Rules
// groups (KDL typo-table redesign). Ports `updateTypoPreview()`.

const SPECIMEN = 'The quick brown fox jumps over the lazy dog'

interface TypoRow {
  name: string
  size: number
  sizeUnit?: string
  family: string
  weight: string
  lineHeight: number
  letterSpacing: number
}

/** The pane's "Typography Scale" table field, parsed into rows keyed by name. */
function typoRows(pane: TEPaneLite, values: Values): Map<string, TypoRow> {
  const field = groupByName(pane, 'Typography Scale')?.fields.find(
    (f) => f.field_name.toLowerCase() === 'typography scale'
  )
  const map = new Map<string, TypoRow>()
  if (!field) return map
  try {
    const rows = JSON.parse(resolve(field, values))
    if (Array.isArray(rows)) {
      for (const r of rows) if (r?.name) map.set(r.name, r)
    }
  } catch {
    /* malformed — empty map, callers fall back to defaults */
  }
  return map
}

export function TypographyPreview({
  pane,
  values,
}: {
  pane: TEPaneLite
  values: Values
}): JSX.Element {
  const rows = typoRows(pane, values)
  const row = (name: string, fallback: TypoRow) => rows.get(name) ?? fallback

  const headings: { tag: string; field: string; fallbackWeight: string }[] = [
    { tag: 'H1', field: 'H1 (Title)', fallbackWeight: '700' },
    { tag: 'H2', field: 'H2', fallbackWeight: '700' },
    { tag: 'H3', field: 'H3', fallbackWeight: '600' },
    { tag: 'H4', field: 'H4', fallbackWeight: '600' },
    { tag: 'H5', field: 'H5', fallbackWeight: '500' },
    { tag: 'H6', field: 'H6', fallbackWeight: '500' },
  ]

  const paragraph = row('Paragraph', {
    name: 'Paragraph',
    size: 14,
    family: 'Inter',
    weight: '400',
    lineHeight: 1.5,
    letterSpacing: 0,
  })
  const small = row('Small Text', {
    name: 'Small Text',
    size: 12,
    family: 'Inter',
    weight: '400',
    lineHeight: 1.5,
    letterSpacing: 0,
  })

  return (
    <div className="flex flex-col gap-2 p-[18px]">
      {headings.map((h) => {
        const r = row(h.field, {
          name: h.field,
          size: 24,
          family: 'Inter',
          weight: h.fallbackWeight,
          lineHeight: 1.5,
          letterSpacing: 0,
        })
        const unit = r.sizeUnit || 'px'
        return (
          <div
            key={h.tag}
            style={{
              fontFamily: `'${r.family}', sans-serif`,
              fontWeight: Number(r.weight) || r.weight,
              fontSize: `${r.size}${unit}`,
              letterSpacing: `${r.letterSpacing}px`,
              color: 'var(--foreground, hsl(var(--foreground)))',
            }}
          >
            {h.tag} Heading {r.size}
            {unit}
          </div>
        )
      })}
      <p
        className="max-w-[480px] text-muted-foreground"
        style={{
          fontFamily: `'${paragraph.family}', sans-serif`,
          fontWeight: Number(paragraph.weight) || paragraph.weight,
          fontSize: `${paragraph.size}${paragraph.sizeUnit || 'px'}`,
          lineHeight: paragraph.lineHeight,
          letterSpacing: `${paragraph.letterSpacing}px`,
        }}
      >
        Paragraph — {SPECIMEN}, showing line-height {paragraph.lineHeight} and letter-spacing{' '}
        {paragraph.letterSpacing}px.
      </p>
      <small
        className="text-muted-foreground"
        style={{
          fontFamily: `'${small.family}', sans-serif`,
          fontWeight: Number(small.weight) || small.weight,
          fontSize: `${small.size}${small.sizeUnit || 'px'}`,
        }}
      >
        Small text — {SPECIMEN}.
      </small>
    </div>
  )
}
