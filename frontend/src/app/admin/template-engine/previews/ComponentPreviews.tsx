// ─────────────────────────────────────────────────────────────────────────────
// ComponentPreviews — live per-pane component previews (KDL-203, sub-task 2/3).
//
// One preview component per pane (buttons/forms/tables/cards/popup/alerts/
// navigation/layout/images). Each renders the pane's CURRENT field values, so
// editing a colour/size in the pane is reflected live. Ported 1:1 from the
// prototype `template-engine.html` render functions (web-app variant):
//   • buttons ...... updateButtonPreview ~1725   (.btn-preview  CSS ~311)
//   • images ....... updateImagePreview  ~1780   (.img-preview  CSS ~317)
//   • cards ........ updateCardPreview    ~1801  (.card-preview CSS ~328)
//   • layout ....... updateLayoutPreview  ~1950  (.lay-preview  CSS ~362)
//   • navigation ... updateNavPreview     ~2355  (.nav-preview  CSS ~373)
//   • forms ........ updateFormPreview    ~2373  (.form-preview CSS ~376)
//   • tables ....... updateTablePreview   ~2548  (.table-preview CSS ~376)
//   • popup ........ updatePopupPreview   ~2614  (.popup-preview CSS ~404)
//   • alerts ....... updateAlertPreview   ~2669  (.alert-preview CSS ~402)
//
// These render as the CONTENT inside the device shell built by KDL-202 — this
// file owns the content, not the outer phone/tv/browser chrome. Field lookups
// match on `field_name` (verbatim from the prototype labels, confirmed against
// backend `schema/index.js` BASE_TABS) within a named group, exactly the way
// KDL-202's ThemeDevicePreviews does. The registry wiring lives in
// `componentRegistry.ts`; integration (KDL-205) mounts both.
//
// The `({ pane, values })` signature carries no active mode/device, so the
// non-field "framing" colours (pane backdrop, label text) default to the
// prototype's DARK-theme constants — which is the prototype's own default mode.
// Field colours resolve via the first matching group; the schema lists the dark
// group before the light one, so an unfiltered pane also yields the dark values,
// keeping framing and field colours consistent.
// ─────────────────────────────────────────────────────────────────────────────

import type { CSSProperties, ReactNode } from 'react'

// Local shape, intentionally decoupled from page.tsx's TEPane (duplicated, not
// cross-imported — matches KDL-202's TEPaneLite so KDL-205 can pass one object).
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

// ── value helpers ──────────────────────────────────────────────────────────

/** Resolve a field's live value: a local unsaved edit wins over the saved one. */
const resolve = (field: { id: string; value: string }, values: Values): string =>
  values[field.id] ?? field.value

/** First group whose name matches (case-insensitive). */
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

/** Append `px` to a bare number; pass through strings that already carry units
 *  (e.g. `8px 12px`) or are empty. Mirrors the prototype `len()` helper. */
function px(v: string): string {
  if (v === '' || v == null) return ''
  return /^-?\d+(\.\d+)?$/.test(v.trim()) ? `${v.trim()}px` : v
}

/** Number with fallback. */
const num = (v: string, fallback: number): number => {
  const n = Number(v)
  return Number.isFinite(n) && v !== '' ? n : fallback
}

/** Toggle value → boolean (API stores toggles as string flags). */
const bool = (v: string): boolean => v === 'true' || v === '1' || v === 'on'

/** hex (`#rgb`/`#rrggbb`/`#rrggbbaa`) + opacity% → `rgba(r,g,b,a)`; the
 *  prototype's per-variant shadow colour builder. Bad input → transparent. */
function rgba(hex: string, opacityPct: string): string {
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
  if (full.length < 6 || Number.isNaN(n)) return 'rgba(0,0,0,0)'
  const a = (Number(opacityPct) || 0) / 100
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

// Dark-theme framing constants (prototype defaults for the pane backdrop / text).
const PANE_BG = '#1e1e20'
const TXT = '#f2f2f5'
const MUT = '#a5a5ad'

// ── ButtonPreview ────────────────────────────────────────────────────────────

const BUTTON_VARIANTS: [string, string][] = [
  ['Primary', 'Primary Button'],
  ['Secondary', 'Secondary Button'],
  ['Tertiary', 'Tertiary Button'],
  ['Outline', 'Outline Button'],
  ['White', 'White Button'],
]

export function ButtonPreview({ pane, values }: { pane: TEPaneLite; values: Values }): JSX.Element {
  const font = fieldValue(pane, 'Button Defaults', 'Button Font', values) || 'Inter'
  const weight = fieldValue(pane, 'Button Defaults', 'Font Weight', values) || '600'
  const trans = fieldValue(pane, 'Button Defaults', 'Transition', values) || 'all .2s ease'
  const fs = px(fieldValue(pane, 'Button Sizes', 'Font Size', values)) || '13px'
  const pad = fieldValue(pane, 'Button Sizes', 'Padding', values) || '10px 20px'
  const h = px(fieldValue(pane, 'Button Sizes', 'Height', values)) || '38px'
  const br = px(fieldValue(pane, 'Button Sizes', 'Border Radius', values)) || '8px'

  return (
    <div
      style={{
        display: 'flex',
        gap: 14,
        flexWrap: 'wrap',
        alignItems: 'center',
        padding: '22px 18px',
        borderRadius: 9,
        background: PANE_BG,
      }}
    >
      {BUTTON_VARIANTS.map(([label, group]) => {
        const bg = fieldValue(pane, group, 'Background Color', values)
        const tc = fieldValue(pane, group, 'Text Color', values)
        const border = fieldValue(pane, group, 'Border', values) || 'none'
        const shadow = `${px(fieldValue(pane, group, 'Shadow X', values)) || '0px'} ${
          px(fieldValue(pane, group, 'Shadow Y', values)) || '0px'
        } ${px(fieldValue(pane, group, 'Shadow Blur', values)) || '0px'} ${
          px(fieldValue(pane, group, 'Shadow Spread', values)) || '0px'
        } ${rgba(
          fieldValue(pane, group, 'Shadow Color', values),
          fieldValue(pane, group, 'Shadow Opacity', values)
        )}`
        const style: CSSProperties = {
          background: bg,
          color: tc,
          border,
          boxShadow: shadow,
          fontFamily: `'${font}', sans-serif`,
          fontWeight: weight as CSSProperties['fontWeight'],
          fontSize: fs,
          padding: pad,
          height: h,
          borderRadius: br,
          transition: trans,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }
        return (
          <button key={group} type="button" style={style}>
            {label} Button
          </button>
        )
      })}
    </div>
  )
}

// ── FormPreview ────────────────────────────────────────────────────────────
// One rendered input per style + checkbox / radio / switch, styled from values.

const INPUT_STYLES = ['Full Border', 'Underline', 'Filled', 'Filled + Border']

interface StyleParams {
  h: string
  fs: string
  pad: string
  rad: string
  bw: string
  ff: string
  lfs: string
  bg: string
  tc: string
  bd: string
  fc: string
  ph: string
}

function styleParams(pane: TEPaneLite, st: string, values: Values): StyleParams {
  const s = `${st} Settings`
  const c = `${st} Colors`
  return {
    h: px(fieldValue(pane, s, 'Height', values)) || '38px',
    fs: px(fieldValue(pane, s, 'Font Size', values)) || '13px',
    pad: fieldValue(pane, s, 'Padding', values) || '8px 12px',
    rad: px(fieldValue(pane, s, 'Radius', values)) || '8px',
    bw: px(fieldValue(pane, s, 'Border Width', values)),
    ff: fieldValue(pane, s, 'Font Family', values) || 'Inter',
    lfs: px(fieldValue(pane, s, 'Label Font Size', values)) || '12px',
    bg: fieldValue(pane, c, 'Background Color', values) || '#2a2a2e',
    tc: fieldValue(pane, c, 'Text Color', values) || TXT,
    bd: fieldValue(pane, c, 'Border Color', values) || '#3d3d42',
    fc: fieldValue(pane, c, 'Focus Color', values) || '#4f8ef7',
    ph: fieldValue(pane, c, 'Placeholder Color', values) || MUT,
  }
}

function inputBoxCss(st: string, p: StyleParams, focused: boolean): CSSProperties {
  const edge = focused ? p.fc : p.bd
  const bw = p.bw === '0px' || !p.bw ? '1.5px' : p.bw
  if (st === 'Underline') {
    return {
      background: 'transparent',
      border: 0,
      borderBottom: `${bw} solid ${edge}`,
      borderRadius: 0,
    }
  }
  if (st === 'Filled') {
    return { background: p.bg, border: focused ? `${bw} solid ${p.fc}` : '0', borderRadius: p.rad }
  }
  // Full Border / Filled + Border
  return { background: p.bg, border: `${bw} solid ${edge}`, borderRadius: p.rad }
}

export function FormPreview({ pane, values }: { pane: TEPaneLite; values: Values }): JSX.Element {
  const lbl = TXT
  const fc = '#4f8ef7'
  const ph = '#8a8a92'

  // Which style is the focused example (first selected in the multiselect).
  let selected: string[] = []
  try {
    selected = JSON.parse(fieldValue(pane, 'Input Styles', 'Input Styles', values) || '[]')
  } catch {
    selected = []
  }

  const cbStyle = fieldValue(pane, 'Choice Controls', 'Checkbox Style', values) || 'Rounded'
  const rdStyle = fieldValue(pane, 'Choice Controls', 'Radio Button Style', values) || 'Dot'
  const swStyle = fieldValue(pane, 'Choice Controls', 'Switch Style', values) || 'Pill'
  const swLabels = bool(fieldValue(pane, 'Choice Controls', 'Show ON/OFF Labels', values))

  const chk = fieldValue(pane, 'Checkbox & Radio Colors', 'Checked Color', values) || '#4f8ef7'
  const cbd = fieldValue(pane, 'Checkbox & Radio Colors', 'Border Color', values) || '#5a5a61'
  const ico = fieldValue(pane, 'Checkbox & Radio Colors', 'Check Icon Color', values) || '#ffffff'
  const son = fieldValue(pane, 'Switch Colors', 'Switch On Color', values) || '#32d74b'
  const knob = fieldValue(pane, 'Switch Colors', 'Knob Color', values) || '#ffffff'

  return (
    <div style={{ padding: 20, borderRadius: 9, background: PANE_BG }}>
      {INPUT_STYLES.map((st) => {
        const p = styleParams(pane, st, values)
        const focused = selected[0] === st
        return (
          <div key={st} style={{ marginBottom: 14 }}>
            <div
              style={{
                color: focused ? fc : lbl,
                fontSize: p.lfs,
                fontFamily: `'${p.ff}', sans-serif`,
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              {st}
              {focused ? ' ✓ selected' : ''}
            </div>
            <div
              style={{
                height: p.h,
                ...inputBoxCss(st, p, focused),
                display: 'flex',
                alignItems: 'center',
                padding: p.pad,
                fontSize: p.fs,
                fontFamily: `'${p.ff}', sans-serif`,
                color: p.ph,
              }}
            >
              Placeholder text…
            </div>
          </div>
        )
      })}

      {/* choice controls */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 8, flexWrap: 'wrap' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: lbl, fontSize: 12 }}>
          <Checkbox on style={cbStyle} chk={chk} cbd={cbd} ico={ico} />
          Checkbox
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: lbl, fontSize: 12 }}>
          <Radio on style={rdStyle} chk={chk} cbd={cbd} ico={ico} paneBg={PANE_BG} />
          Radio
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: lbl, fontSize: 12 }}>
          <Switch on style={swStyle} son={son} soff={cbd} knob={knob} labels={swLabels} />
          Switch
        </span>
      </div>
    </div>
  )
}

function Checkbox({
  on,
  style,
  chk,
  cbd,
  ico,
}: {
  on: boolean
  style: string
  chk: string
  cbd: string
  ico: string
}): JSX.Element {
  const rad = style === 'Square' ? '3px' : style === 'Circle' ? '50%' : '6px'
  const base: CSSProperties = {
    display: 'inline-flex',
    width: 21,
    height: 21,
    borderRadius: rad,
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
  }
  if (!on)
    return (
      <span style={{ ...base, border: style === 'Tick Only' ? undefined : `2px solid ${cbd}` }} />
    )
  if (style === 'Outline Tick')
    return <span style={{ ...base, border: `2px solid ${chk}`, color: chk }}>✓</span>
  if (style === 'Tick Only') return <span style={{ ...base, color: chk, fontSize: 19 }}>✓</span>
  if (style === 'Cross') return <span style={{ ...base, background: chk, color: ico }}>✕</span>
  return <span style={{ ...base, background: chk, color: ico }}>✓</span>
}

function Radio({
  on,
  style,
  chk,
  cbd,
  paneBg,
}: {
  on: boolean
  style: string
  chk: string
  cbd: string
  ico: string
  paneBg: string
}): JSX.Element {
  const base: CSSProperties = {
    display: 'inline-flex',
    width: 21,
    height: 21,
    alignItems: 'center',
    justifyContent: 'center',
  }
  const shape: CSSProperties =
    style === 'Square Dot'
      ? { borderRadius: 5 }
      : style === 'Diamond'
        ? { borderRadius: 4, transform: 'rotate(45deg)' }
        : { borderRadius: '50%' }
  if (!on) return <span style={{ ...base, ...shape, border: `2px solid ${cbd}` }} />
  if (style === 'Dot')
    return (
      <span style={{ ...base, ...shape, border: `2px solid ${chk}` }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: chk }} />
      </span>
    )
  if (style === 'Ring') return <span style={{ ...base, ...shape, border: `6px solid ${chk}` }} />
  if (style === 'Square Dot' || style === 'Diamond')
    return (
      <span style={{ ...base, ...shape, border: `2px solid ${chk}` }}>
        <span style={{ width: 9, height: 9, borderRadius: 2, background: chk }} />
      </span>
    )
  if (style === 'Check')
    return (
      <span style={{ ...base, ...shape, background: chk, fontSize: 12, fontWeight: 700 }}>✓</span>
    )
  // Filled
  return (
    <span style={{ ...base, ...shape, background: chk, boxShadow: `inset 0 0 0 3px ${paneBg}` }} />
  )
}

function Switch({
  on,
  style,
  son,
  soff,
  knob,
  labels,
}: {
  on: boolean
  style: string
  son: string
  soff: string
  knob: string
  labels: boolean
}): JSX.Element {
  const rad = style === 'Square' ? '5px' : '999px'
  const W = style === 'iOS' ? 52 : 46
  const H = style === 'iOS' ? 28 : 24
  const K = H - 6
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        width: W,
        height: H,
        borderRadius: rad,
        background: on ? son : soff,
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,.15)',
      }}
    >
      {labels && (
        <span
          style={{
            color: knob,
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: '.04em',
            position: 'absolute',
            ...(on ? { left: 7 } : { right: 6 }),
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        >
          {on ? 'ON' : 'OFF'}
        </span>
      )}
      <span
        style={{
          position: 'absolute',
          top: 3,
          ...(on ? { right: 3 } : { left: 3 }),
          width: K,
          height: K,
          borderRadius: style === 'Square' ? '4px' : '50%',
          background: knob,
          boxShadow: '0 1px 3px rgba(0,0,0,.35)',
        }}
      />
    </span>
  )
}

// ── TablePreview ─────────────────────────────────────────────────────────────

export function TablePreview({ pane, values }: { pane: TEPaneLite; values: Values }): JSX.Element {
  const hb = fieldValue(pane, 'Table Colors', 'Header Background', values) || '#323236'
  const ht = fieldValue(pane, 'Table Colors', 'Header Text Color', values) || MUT
  const rt = fieldValue(pane, 'Table Colors', 'Row Text Color', values) || TXT
  const alt = fieldValue(pane, 'Table Colors', 'Alternate Row Color', values) || '#2a2a2e'
  const rb = fieldValue(pane, 'Table Colors', 'Row Border Color', values) || '#3d3d42'
  const rh = num(fieldValue(pane, 'Rows & Borders', 'Row Height', values), 44)
  const bs = fieldValue(pane, 'Rows & Borders', 'Border Style', values) || 'Horizontal'
  const rowBg = '#2a2a2e'

  const cell: CSSProperties = {
    padding: '0 12px',
    height: Math.round(rh * 0.8),
    ...(bs === 'Full grid' ? { border: `1px solid ${rb}` } : {}),
  }
  const row = (n: number, alt2: boolean) => (
    <tr
      key={n}
      style={{
        background: alt2 ? alt : rowBg,
        color: rt,
        fontSize: 12,
        ...(bs === 'Horizontal' ? { borderBottom: `1px solid ${rb}` } : {}),
      }}
    >
      <td style={cell}>Row {n}</td>
      <td style={cell}>user{n}@kdl.dev</td>
      <td style={cell}>Active</td>
    </tr>
  )

  return (
    <div style={{ padding: 20, borderRadius: 9, background: PANE_BG }}>
      <table
        style={{
          borderCollapse: 'collapse',
          width: '100%',
          maxWidth: 420,
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <tbody>
          <tr
            style={{
              background: hb,
              color: ht,
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '.05em',
            }}
          >
            <th style={{ ...cell, textAlign: 'left' }}>Name</th>
            <th style={{ ...cell, textAlign: 'left' }}>Email</th>
            <th style={{ ...cell, textAlign: 'left' }}>Status</th>
          </tr>
          {row(1, false)}
          {row(2, true)}
          {row(3, false)}
        </tbody>
      </table>
    </div>
  )
}

// ── CardPreview ──────────────────────────────────────────────────────────────

const CARD_SHADOWS: Record<string, string> = {
  None: 'none',
  Soft: '0 2px 10px rgba(0,0,0,.15)',
  Medium: '0 6px 22px rgba(0,0,0,.25)',
  Hard: '0 12px 34px rgba(0,0,0,.4)',
}

export function CardPreview({ pane, values }: { pane: TEPaneLite; values: Values }): JSX.Element {
  const bg = fieldValue(pane, 'Card Colors', 'Background Color', values) || '#323236'
  const bd = fieldValue(pane, 'Card Colors', 'Border Color', values) || '#3d3d42'
  const style = fieldValue(pane, 'Surface', 'Card Style', values) || 'Elevated'
  const br = px(fieldValue(pane, 'Surface', 'Border Radius', values)) || '12px'
  const shadowName = fieldValue(pane, 'Surface', 'Shadow', values) || 'Soft'
  const pad = px(fieldValue(pane, 'Surface', 'Padding', values)) || '20px'
  const header = fieldValue(pane, 'Structure & Motion', 'Header Style', values) || 'Divided'
  const footer = fieldValue(pane, 'Structure & Motion', 'Footer Style', values) || 'Plain'
  const hover = fieldValue(pane, 'Structure & Motion', 'Hover Animation', values) || 'Lift'

  const shadow = style === 'Flat' ? 'none' : CARD_SHADOWS[shadowName] || 'none'
  const border = style === 'Bordered' ? `1px solid ${bd}` : '1px solid transparent'

  return (
    <div style={{ padding: 24, borderRadius: 9, background: PANE_BG }}>
      <div
        style={{
          maxWidth: 320,
          overflow: 'hidden',
          background: bg,
          border,
          borderRadius: br,
          boxShadow: shadow,
        }}
      >
        {header !== 'None' && (
          <div
            style={{
              padding: `10px ${pad}`,
              fontWeight: 700,
              color: TXT,
              ...(header === 'Divided' ? { borderBottom: `1px solid ${bd}` } : {}),
              ...(header === 'Filled' ? { background: '#ffffff10' } : {}),
            }}
          >
            Card Header
          </div>
        )}
        <div style={{ padding: pad, color: MUT, fontSize: 12.5, lineHeight: 1.5 }}>
          <b style={{ color: TXT, fontSize: 13.5, display: 'block', marginBottom: 6 }}>
            Sample Card ({style})
          </b>
          This is example card content, styled from the current “{hover}” settings.
        </div>
        {footer !== 'None' && (
          <div
            style={{
              padding: `10px ${pad}`,
              color: MUT,
              fontSize: 12,
              borderTop: `1px solid ${bd}`,
              ...(footer === 'Actions bar'
                ? { display: 'flex', gap: 8, justifyContent: 'flex-end' }
                : {}),
            }}
          >
            {footer === 'Actions bar' ? (
              <>
                <span style={{ color: '#4f8ef7', fontWeight: 600 }}>Action</span>
                <span>Cancel</span>
              </>
            ) : (
              'Card footer text'
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── PopupPreview ─────────────────────────────────────────────────────────────

export function PopupPreview({ pane, values }: { pane: TEPaneLite; values: Values }): JSX.Element {
  const bg = fieldValue(pane, 'Popup Colors', 'Background Color', values) || '#2a2a2e'
  const tc = fieldValue(pane, 'Popup Colors', 'Text Color', values) || TXT
  const bd = fieldValue(pane, 'Popup Colors', 'Border Color', values) || '#3d3d42'
  const ov = fieldValue(pane, 'Popup Colors', 'Overlay Color', values) || '#000000'
  const cl = fieldValue(pane, 'Popup Colors', 'Close Icon Color', values) || MUT
  const br = px(fieldValue(pane, 'Size & Shape', 'Border Radius', values)) || '12px'
  const pad = px(fieldValue(pane, 'Size & Shape', 'Padding', values)) || '24px'
  const sh = fieldValue(pane, 'Size & Shape', 'Box Shadow', values) || '0 20px 60px rgba(0,0,0,.4)'
  const op = num(fieldValue(pane, 'Overlay', 'Overlay Opacity', values), 60) / 100

  return (
    <div
      style={{
        position: 'relative',
        height: 190,
        borderRadius: 9,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: PANE_BG,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: ov, opacity: op }} />
      <div
        style={{
          position: 'relative',
          maxWidth: 280,
          background: bg,
          border: `1px solid ${bd}`,
          borderRadius: br,
          padding: pad,
          boxShadow: sh,
        }}
      >
        <span style={{ position: 'absolute', top: 8, right: 12, color: cl, cursor: 'pointer' }}>
          ✕
        </span>
        <b style={{ color: tc, fontSize: 14 }}>Popup title</b>
        <p style={{ color: tc, opacity: 0.7, fontSize: 12, marginTop: 6 }}>
          This is an example modal dialog rendered from your settings.
        </p>
      </div>
    </div>
  )
}

// ── AlertPreview ─────────────────────────────────────────────────────────────

const ALERT_KINDS: [string, string, string][] = [
  ['Success Alert', '✓', 'Success — changes saved.'],
  ['Warning Alert', '⚠', 'Warning — check this value.'],
  ['Error Alert', '✕', 'Error — something went wrong.'],
  ['Info Alert', 'ℹ', 'Info — a helpful note.'],
]

export function AlertPreview({ pane, values }: { pane: TEPaneLite; values: Values }): JSX.Element {
  const br = px(fieldValue(pane, 'Shape', 'Border Radius', values)) || '8px'
  const pad = px(fieldValue(pane, 'Shape', 'Padding', values)) || '14px'
  const bs = fieldValue(pane, 'Shape', 'Border Style', values) || 'Left accent'
  const icon = bool(fieldValue(pane, 'Behavior', 'Show Icon', values) || 'true')

  return (
    <div style={{ padding: 20, borderRadius: 9, maxWidth: 460, background: PANE_BG }}>
      {ALERT_KINDS.map(([group, ic, msg]) => {
        const abg = fieldValue(pane, group, 'Background Color', values)
        const atc = fieldValue(pane, group, 'Text Color', values)
        const abd = fieldValue(pane, group, 'Border Color', values)
        const aic = fieldValue(pane, group, 'Icon Color', values)
        const border: CSSProperties =
          bs === 'Full border'
            ? { border: `1px solid ${abd}` }
            : bs === 'Left accent'
              ? { borderLeft: `4px solid ${abd}` }
              : {}
        return (
          <div
            key={group}
            style={{
              background: abg,
              color: atc,
              ...border,
              borderRadius: br,
              padding: pad,
              fontSize: 12.5,
              marginBottom: 8,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}
          >
            {icon && <span style={{ color: aic, fontWeight: 700 }}>{ic}</span>}
            {msg}
          </div>
        )
      })}
    </div>
  )
}

// ── NavPreview ───────────────────────────────────────────────────────────────

export function NavPreview({ pane, values }: { pane: TEPaneLite; values: Values }): JSX.Element {
  const txt = fieldValue(pane, 'Menu Colors', 'Menu Text Color', values) || MUT
  const hov = fieldValue(pane, 'Menu Colors', 'Menu Hover Color', values) || '#323236'
  const act = fieldValue(pane, 'Menu Colors', 'Active Menu Color', values) || '#4f8ef7'
  const actBg = fieldValue(pane, 'Menu Colors', 'Active Background', values) || '#1f3a63'
  // Menu font size now comes from Typography Scale's "Navigation" row (single
  // source of truth) rather than this pane's own field — cross-pane data isn't
  // available to this preview, so it just uses the shared default.
  const fs = '13px'
  const ics = px(fieldValue(pane, 'Sidebar & Menu', 'Menu Icon Size', values)) || '18px'

  const item = (ic: string, label: string, extra: CSSProperties): ReactNode => (
    <div
      key={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '7px 10px',
        borderRadius: 7,
        marginBottom: 2,
        fontSize: fs,
        ...extra,
      }}
    >
      <span style={{ fontSize: ics }}>{ic}</span>
      {label}
    </div>
  )

  return (
    <div
      style={{
        maxWidth: 240,
        borderRadius: 9,
        padding: '10px 8px',
        margin: 16,
        background: '#26262a',
      }}
    >
      {item('📊', 'Dashboard (active)', { background: actBg, color: act, fontWeight: 600 })}
      {item('👤', 'Users (hover)', { background: hov, color: txt })}
      {item('🖼️', 'Media', { color: txt })}
      {item('⚙️', 'Settings', { color: txt })}
    </div>
  )
}

// ── LayoutPreview ────────────────────────────────────────────────────────────

const LAY_SIDEBAR = '#26262a'
const LAY_HAIRLINE = '#3d3d42'
const LAY_ACCENT = '#4f8ef7'
const LAY_ACCENT_SOFT = 'rgba(79,142,247,.15)'

export function LayoutPreview({ pane, values }: { pane: TEPaneLite; values: Values }): JSX.Element {
  const sw = num(fieldValue(pane, 'Structure', 'Sidebar Width', values), 220)
  const pos = fieldValue(pane, 'Structure', 'Sidebar Position', values) || 'Left'
  const headH = px(fieldValue(pane, 'Structure', 'Header Height', values)) || '56px'
  const footH = px(fieldValue(pane, 'Structure', 'Footer Height', values)) || '44px'
  const cols = num(fieldValue(pane, 'Container & Grid', 'Grid Columns', values), 12)
  const gap = num(fieldValue(pane, 'Container & Grid', 'Grid Gap', values), 16)
  const cw = fieldValue(pane, 'Container & Grid', 'Container Width', values) || 'Fluid (100%)'
  const sideW = Math.round(sw / 5)

  const bar: CSSProperties = {
    background: LAY_SIDEBAR,
    padding: '6px 12px',
    color: MUT,
    fontSize: 10,
  }
  const sidebar = (
    <div
      style={{
        background: LAY_SIDEBAR,
        borderRight: `1px solid ${LAY_HAIRLINE}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        width: sideW,
        color: MUT,
        fontSize: 10,
      }}
    >
      {sw}px
    </div>
  )

  return (
    <div
      style={{
        border: `1px solid ${LAY_HAIRLINE}`,
        borderRadius: 9,
        overflow: 'hidden',
        fontSize: 10,
        color: MUT,
      }}
    >
      <div style={{ ...bar, borderBottom: `1px solid ${LAY_HAIRLINE}` }}>Header {headH}</div>
      <div style={{ display: 'flex', minHeight: 110 }}>
        {pos === 'Left' && sidebar}
        <div style={{ flex: 1, padding: 10 }}>
          <div style={{ border: `1px dashed ${LAY_ACCENT}`, borderRadius: 6, padding: 8 }}>
            <div style={{ marginBottom: 6, color: LAY_ACCENT, fontWeight: 600 }}>
              {cw} · {cols} cols · gap {gap}px
            </div>
            <div style={{ display: 'flex', gap: Math.max(2, gap / 4) }}>
              {Array.from({ length: cols }, (_, i) => (
                <span
                  key={i}
                  style={{
                    flex: 1,
                    height: 34,
                    borderRadius: 3,
                    background: LAY_ACCENT_SOFT,
                    border: `1px solid ${LAY_ACCENT}`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        {pos === 'Right' && sidebar}
      </div>
      <div style={{ ...bar, borderTop: `1px solid ${LAY_HAIRLINE}` }}>Footer {footH}</div>
    </div>
  )
}

// ── ImagesPreview ────────────────────────────────────────────────────────────

interface ImageRow {
  name: string
  w: number | string
  h: number | string
  fit: string
  pos?: string
  wu?: string
  hu?: string
}

export function ImagesPreview({ pane, values }: { pane: TEPaneLite; values: Values }): JSX.Element {
  let list: ImageRow[] = []
  try {
    list = JSON.parse(fieldValue(pane, 'Image Classes', 'Image Classes', values) || '[]')
  } catch {
    list = []
  }
  const rad = px(fieldValue(pane, 'Defaults', 'Image Border Radius', values)) || '6px'

  return (
    <div
      style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end', padding: 18 }}
    >
      {list.map((r, i) => {
        const nw = r.w === 'auto' ? null : Number(r.w)
        const nh = r.h === 'auto' ? null : Number(r.h)
        const base = Math.max(nw || nh || 80, nh || nw || 80)
        const sc = Math.min(1, 110 / base)
        const w = Math.max(26, Math.round((nw !== null ? nw : (nh || 80) * 1.3) * sc))
        const h = Math.max(26, Math.round((nh !== null ? nh : (nw || 80) * 0.7) * sc))
        const dims = `${r.w === 'auto' ? 'auto' : `${r.w}${r.wu || 'px'}`} × ${
          r.h === 'auto' ? 'auto' : `${r.h}${r.hu || 'px'}`
        }`
        return (
          <div key={`${r.name}-${i}`} style={{ textAlign: 'center' }}>
            <div
              style={{
                width: w,
                height: h,
                borderRadius: rad,
                background: 'linear-gradient(135deg, #4f8ef7, #a855f7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 15,
                margin: '0 auto',
                boxShadow: '0 3px 10px rgba(0,0,0,.25)',
              }}
            >
              🖼️
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 10.5, marginTop: 6, color: TXT }}>
              .{r.name || '…'}
            </div>
            <div style={{ fontSize: 10, color: MUT, marginTop: 1 }}>
              {dims} · {r.fit}
              {r.pos ? ` · ${r.pos}` : ''}
            </div>
          </div>
        )
      })}
    </div>
  )
}
