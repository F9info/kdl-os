'use client'

import { useEffect, useState } from 'react'
import DOMPurify from 'dompurify'
import { Button } from '@/components/ui/button'
import { MediaPicker } from '@/components/shared/MediaPicker'
import {
  Heading as HeadingIcon,
  Pilcrow,
  Image as ImageIcon,
  RectangleHorizontal,
  Minus,
  Star,
  Tag,
  SeparatorHorizontal,
  Sparkles,
  Menu as MenuIcon,
  Share2,
  Video as VideoIcon,
  Zap,
  LayoutGrid,
  List as ListIcon,
  Square,
  Quote as QuoteIcon,
  MessageSquare,
  BarChart3,
  ClipboardList,
  Code2,
  GalleryHorizontal,
  Upload,
} from 'lucide-react'

export type Align = 'left' | 'center' | 'right'

/** Generic per-atom visual styling — an Elementor-style "Style" tab that
 *  applies to ANY atom regardless of type, layered on top of that atom's own
 *  content fields rather than replacing them. */
export interface AtomStyle {
  textColor?: string
  bgColor?: string
  borderWidth?: 'none' | 'thin' | 'medium' | 'thick'
  borderColor?: string
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'full'
  shadow?: 'none' | 'sm' | 'md' | 'lg'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  /** CSS font-family — inherited by child text since this lands on the
   *  atom's own wrapper div (see atomStyleProps), no per-render-fn wiring
   *  needed for Heading/Paragraph. */
  fontFamily?: string
}

export interface ComposerAtom {
  id: string
  type: string
  hideMobile?: boolean
  /** Only meaningful on a 'layout' atom — its nested content. */
  children?: ComposerAtom[]
  /** Only meaningful on a direct child of a grid-mode 'layout' atom. */
  colSpan?: number
  /** Bootstrap-style column offset — 0/unset means auto-flow (no offset). */
  colStart?: number
  /** Generic per-atom Style tab settings (color/background/border/shadow/padding). */
  style?: AtomStyle
  [prop: string]: unknown
}

// Matches Theme Engine's own font choices (webapp.typography.*.typography_scale
// setting-field's `options.choices`) so a hand-picked font here stays inside
// the same set the rest of the platform already uses.
const FONT_FAMILY_CHOICES = [
  'Inter',
  'Sora',
  'Roboto',
  'Poppins',
  'Poppins, Sora',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Source Sans 3',
  'SF Pro',
  'System UI',
]

const BORDER_WIDTH_PX: Record<NonNullable<AtomStyle['borderWidth']>, string> = {
  none: '0',
  thin: '1px',
  medium: '2px',
  thick: '4px',
}
const BORDER_RADIUS_PX: Record<NonNullable<AtomStyle['borderRadius']>, string> = {
  none: '0',
  sm: '4px',
  md: '8px',
  lg: '16px',
  full: '9999px',
}
const SHADOW_CSS: Record<NonNullable<AtomStyle['shadow']>, string> = {
  none: 'none',
  sm: '0 1px 3px rgba(0,0,0,0.12)',
  md: '0 4px 10px rgba(0,0,0,0.15)',
  lg: '0 12px 24px rgba(0,0,0,0.18)',
}
const STYLE_PADDING_PX: Record<NonNullable<AtomStyle['padding']>, string> = {
  none: '0',
  sm: '8px',
  md: '16px',
  lg: '28px',
}

/** Wrapper style for the Style tab's settings — used identically by the
 *  interactive canvas and the public/plain renderer so what you see while
 *  editing is exactly what publishes. No-op (empty object) when nothing in
 *  the Style tab has been touched, so existing atoms/pages are unaffected. */
export function atomStyleProps(atom: ComposerAtom): { style: React.CSSProperties } {
  const s = atom.style
  if (!s) return { style: {} }
  const style: React.CSSProperties = {}
  if (s.textColor) style.color = s.textColor
  if (s.bgColor) style.backgroundColor = s.bgColor
  if (s.borderWidth && s.borderWidth !== 'none') {
    style.borderWidth = BORDER_WIDTH_PX[s.borderWidth]
    style.borderStyle = 'solid'
    style.borderColor = s.borderColor || '#e2e8f0'
  }
  if (s.borderRadius && s.borderRadius !== 'none')
    style.borderRadius = BORDER_RADIUS_PX[s.borderRadius]
  if (s.shadow && s.shadow !== 'none') style.boxShadow = SHADOW_CSS[s.shadow]
  if (s.padding && s.padding !== 'none') style.padding = STYLE_PADDING_PX[s.padding]
  if (s.fontFamily) style.fontFamily = s.fontFamily
  return { style }
}

/** Matches sectionBuilder.html's ELEMENT_GROUPS exactly — the left palette
 *  renders one heading + tile grid per group, in this order. */
export const ATOM_GROUPS = [
  'Basic',
  'Branding & Navigation',
  'Media',
  'Content',
  'Advanced',
] as const
export type AtomGroup = (typeof ATOM_GROUPS)[number]

export interface AtomDefinition {
  type: string
  label: string
  group: AtomGroup
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>
  defaultProps: Record<string, unknown>
  Render: (atom: ComposerAtom) => React.ReactNode
  Field: (props: {
    atom: ComposerAtom
    onChange: (patch: Record<string, unknown>) => void
  }) => React.ReactNode
}

function headingRender(atom: ComposerAtom) {
  const text = String(atom.text ?? '')
  const level = String(atom.level ?? '2')
  const align = String(atom.align ?? 'left') as Align
  const cls = `font-semibold tracking-tight ${
    align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
  } ${level === '1' ? 'text-3xl md:text-4xl' : level === '3' ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl'}`
  if (level === '1') return <h1 className={cls}>{text}</h1>
  if (level === '3') return <h3 className={cls}>{text}</h3>
  return <h2 className={cls}>{text}</h2>
}

function textRender(atom: ComposerAtom) {
  const text = String(atom.text ?? '')
  const align = String(atom.align ?? 'left') as Align
  const muted = Boolean(atom.muted)
  const alignCls =
    align === 'center'
      ? 'mx-auto text-center'
      : align === 'right'
        ? 'ml-auto text-right'
        : 'text-left'
  return (
    <p
      className={`max-w-3xl leading-relaxed ${alignCls} ${muted ? 'text-slate-500' : 'text-slate-800'}`}
    >
      {text}
    </p>
  )
}

function buttonRender(atom: ComposerAtom) {
  const label = String(atom.label ?? 'Click me')
  const href = String(atom.href ?? '#')
  const variant = atom.variant === 'secondary' ? 'secondary' : 'primary'
  // A custom bg/text color (Style tab — same fields the brand-color prefill
  // writes to on drop) overrides the variant's own Tailwind fill, since that
  // fill is opaque and would otherwise hide a color set on the outer wrapper.
  const custom = atom.style as AtomStyle | undefined
  const customStyle: React.CSSProperties | undefined =
    variant === 'primary' && (custom?.bgColor || custom?.textColor)
      ? { backgroundColor: custom.bgColor || undefined, color: custom.textColor || undefined }
      : undefined
  return (
    <a
      href={href}
      style={customStyle}
      className={`inline-flex rounded-lg px-5 py-2.5 font-medium transition ${
        variant === 'primary'
          ? customStyle
            ? ''
            : 'bg-blue-600 text-white hover:bg-blue-700'
          : 'border border-slate-300 text-slate-800 hover:bg-slate-100'
      }`}
    >
      {label}
    </a>
  )
}

function imageRender(atom: ComposerAtom) {
  const src = String(atom.src ?? '')
  const alt = String(atom.alt ?? '')
  const rounded = Boolean(atom.rounded)
  if (!src)
    return (
      <div
        className={`grid aspect-video w-full place-items-center bg-gradient-to-br from-slate-100 to-slate-200 text-sm text-slate-400 ${rounded ? 'rounded-xl' : ''}`}
      >
        No image yet
      </div>
    )
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`h-auto w-full object-cover ${rounded ? 'rounded-xl' : ''}`}
    />
  )
}

const SPACER_SIZE = { sm: 'h-4', md: 'h-8', lg: 'h-16', xl: 'h-28' } as const

function spacerRender(atom: ComposerAtom) {
  const size = (atom.size as keyof typeof SPACER_SIZE) ?? 'md'
  return <div className={SPACER_SIZE[size] ?? SPACER_SIZE.md} />
}

function badgeRender(atom: ComposerAtom) {
  const text = String(atom.text ?? 'New')
  const tone = String(atom.tone ?? 'primary')
  const cls =
    tone === 'secondary'
      ? 'bg-slate-100 text-slate-700'
      : tone === 'neutral'
        ? 'bg-slate-800 text-white'
        : 'bg-blue-100 text-blue-700'
  // Same override convention as buttonRender — a custom Style-tab color
  // beats the tone's own Tailwind fill instead of sitting invisibly on the
  // (differently-shaped) wrapper behind it.
  const custom = atom.style as AtomStyle | undefined
  const customStyle: React.CSSProperties | undefined =
    tone === 'primary' && (custom?.bgColor || custom?.textColor)
      ? { backgroundColor: custom.bgColor || undefined, color: custom.textColor || undefined }
      : undefined
  return (
    <span
      style={customStyle}
      className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${customStyle ? '' : cls}`}
    >
      {text}
    </span>
  )
}

function dividerRender() {
  return <hr className="w-full border-slate-200" />
}

const LOGO_HEIGHT = { sm: 24, md: 32, lg: 44 } as const

function logoRender(atom: ComposerAtom) {
  const src = String(atom.src ?? '')
  const text = String(atom.text ?? 'Your Brand')
  const height = LOGO_HEIGHT[(atom.size as keyof typeof LOGO_HEIGHT) ?? 'md'] ?? LOGO_HEIGHT.md
  if (src)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={text} style={{ height }} className="w-auto" />
    )
  return <span className="text-xl font-black text-slate-900">{text}</span>
}

function splitCsv(s: unknown) {
  return String(s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

function splitLines(s: unknown) {
  return String(s ?? '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
}

function navRender(atom: ComposerAtom) {
  const items = splitCsv(atom.items ?? 'Home, About, Services, Contact')
  const align = String(atom.align ?? 'center') as Align
  const justify =
    align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'
  // A dark/transparent row (Style tab background) needs light nav text —
  // the hardcoded text-slate-800 class would otherwise win over any color
  // set on the row's own wrapper, since inherited color never overrides a
  // descendant's own class. Same override convention as buttonRender/
  // badgeRender: a custom Style-tab text color replaces the default class.
  const textColor = (atom.style as AtomStyle | undefined)?.textColor
  return (
    <nav className={`flex flex-wrap gap-6 ${justify}`}>
      {items.map((item, i) => (
        <span
          key={i}
          style={textColor ? { color: textColor } : undefined}
          className={`text-sm font-semibold ${textColor ? '' : 'text-slate-800'}`}
        >
          {item}
        </span>
      ))}
    </nav>
  )
}

function socialRender(atom: ComposerAtom) {
  const items = splitCsv(atom.items ?? 'f, ig, x, in')
  const color = String(atom.color ?? '#2563eb')
  return (
    <div className="flex gap-2.5">
      {items.map((item, i) => (
        <span
          key={i}
          className="grid h-9 w-9 place-items-center rounded-full text-xs font-bold"
          style={{ backgroundColor: `${color}18`, color }}
        >
          {item}
        </span>
      ))}
    </div>
  )
}

function videoRender(atom: ComposerAtom) {
  const thumb = String(atom.thumb ?? '')
  const height = Number(atom.height ?? 320)
  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-slate-900" style={{ height }}>
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-75"
        />
      ) : null}
      <div className="absolute inset-0 grid place-items-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-blue-600 shadow-lg">
          ▶
        </span>
      </div>
    </div>
  )
}

function icontextRender(atom: ComposerAtom) {
  const icon = String(atom.icon ?? '★')
  const text = String(atom.text ?? 'A short highlight')
  const color = String(atom.color ?? '#2563eb')
  return (
    <div className="flex items-center gap-3">
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-lg"
        style={{ backgroundColor: `${color}18`, color }}
      >
        {icon}
      </span>
      <span className="text-[15px] text-slate-700">{text}</span>
    </div>
  )
}

// The one real nested-layout primitive — Grid, Flex and Stack all render
// through this same container + recursive-children path (Stack is just Flex
// with fewer knobs shown in its Field), so there's a single layout engine
// instead of three parallel ones. Gap uses the Theme Engine's CSS custom
// properties (falls back to a fixed value if the token isn't defined yet)
// rather than a hardcoded px value.
const GAP_VALUE: Record<string, string> = {
  sm: 'var(--space-sm, 0.5rem)',
  md: 'var(--space-md, 1rem)',
  lg: 'var(--space-lg, 1.5rem)',
  xl: 'var(--space-xl, 2rem)',
}
const ALIGN_ITEMS: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
}
const JUSTIFY_CONTENT: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
}

export function layoutContainerStyle(atom: ComposerAtom): {
  className: string
  style: React.CSSProperties
} {
  const mode = String(atom.mode ?? 'grid')
  const gap = GAP_VALUE[String(atom.gap ?? 'md')] ?? GAP_VALUE.md
  const align = ALIGN_ITEMS[String(atom.align ?? 'stretch')] ?? 'stretch'
  if (mode === 'grid') {
    const columns = Math.max(1, Math.min(12, Number(atom.columns ?? 2)))
    return {
      className: 'grid w-full',
      style: { gridTemplateColumns: `repeat(${columns}, 1fr)`, gap, alignItems: align },
    }
  }
  const direction =
    mode === 'stack'
      ? atom.direction === 'horizontal'
        ? 'row'
        : 'column'
      : atom.direction === 'column'
        ? 'column'
        : 'row'
  return {
    className: 'flex w-full',
    style: {
      flexDirection: direction as React.CSSProperties['flexDirection'],
      flexWrap: mode === 'flex' && atom.wrap ? 'wrap' : 'nowrap',
      gap,
      alignItems: align,
      justifyContent: JUSTIFY_CONTENT[String(atom.justify ?? 'start')] ?? 'flex-start',
    },
  }
}

/** Grid-cell placement for a direct child of a grid-mode 'layout' atom — a
 *  no-op outside a grid parent. `colStart` is the Bootstrap-offset
 *  equivalent (0/unset = auto-flow, same as no offset class). */
export function childWrapStyle(
  parent: ComposerAtom,
  child: ComposerAtom
): React.CSSProperties | undefined {
  if (parent.type !== 'layout' || String(parent.mode ?? 'grid') !== 'grid') return undefined
  const columns = Math.max(1, Math.min(12, Number(parent.columns ?? 2)))
  const span = Math.max(1, Math.min(columns, Number(child.colSpan ?? 1)))
  const start = Number(child.colStart ?? 0)
  const gridColumn = start > 0 ? `${Math.min(columns, start)} / span ${span}` : `span ${span}`
  return { gridColumn }
}

/** Grid rows start at 1 column (full width) so a single element fills the row.
 *  When a sibling lands in that same row (via its persistent "+" or a drop),
 *  the row must widen or the new child just wraps to a second grid line and
 *  stacks under the first — never sitting beside it. Grows columns to fit,
 *  never shrinks (removing a child leaves the row's column count alone). */
export function normalizeGridColumns(atoms: ComposerAtom[]): ComposerAtom[] {
  return atoms.map((atom) => {
    if (atom.type !== 'layout') return atom
    const children = normalizeGridColumns(
      Array.isArray(atom.children) ? (atom.children as ComposerAtom[]) : []
    )
    const mode = String(atom.mode ?? 'grid')
    let columns = atom.columns
    if (mode === 'grid' && children.length > 0) {
      const current = Math.max(1, Math.min(12, Number(atom.columns ?? 1)))
      if (children.length > current) columns = Math.min(12, children.length)
    }
    return { ...atom, columns, children }
  })
}

/** Plain (non-interactive) recursive render — used for the public site and
 *  as this atom type's own `Render`. The interactive canvas builds its own
 *  parallel recursion (selection/drag chrome per node) in ComposerCanvas. */
function layoutRender(atom: ComposerAtom) {
  const children = Array.isArray(atom.children) ? (atom.children as ComposerAtom[]) : []
  const { className, style } = layoutContainerStyle(atom)
  return (
    <div className={className} style={style}>
      {children.map((child) => {
        const def = ATOM_BY_TYPE[child.type]
        if (!def) return null
        return (
          <div
            key={child.id}
            style={childWrapStyle(atom, child)}
            className={child.hideMobile ? 'hidden md:block' : undefined}
          >
            <div style={atomStyleProps(child).style}>{def.Render(child)}</div>
          </div>
        )
      })}
    </div>
  )
}

function layoutField({
  atom,
  onChange,
}: {
  atom: ComposerAtom
  onChange: (patch: Record<string, unknown>) => void
}) {
  const mode = String(atom.mode ?? 'grid')
  return (
    <div className="flex flex-col gap-3.5">
      <ChipRow
        label="Layout type"
        value={mode}
        options={[
          { label: 'Grid', value: 'grid' },
          { label: 'Flex', value: 'flex' },
          { label: 'Stack', value: 'stack' },
        ]}
        onChange={(nextMode) => onChange({ mode: nextMode })}
      />
      {mode === 'grid' ? (
        <ChipRow
          label="Columns"
          value={String(atom.columns ?? 12)}
          options={[2, 3, 4, 6, 12].map((n) => ({ label: `${n}`, value: String(n) }))}
          onChange={(v) => onChange({ columns: Number(v) })}
        />
      ) : (
        <ChipRow
          label="Direction"
          value={String(atom.direction ?? (mode === 'stack' ? 'vertical' : 'row'))}
          options={
            mode === 'stack'
              ? [
                  { label: 'Vertical', value: 'vertical' },
                  { label: 'Horizontal', value: 'horizontal' },
                ]
              : [
                  { label: 'Row', value: 'row' },
                  { label: 'Column', value: 'column' },
                ]
          }
          onChange={(direction) => onChange({ direction })}
        />
      )}
      <ChipRow
        label="Gap"
        value={String(atom.gap ?? 'md')}
        options={[
          { label: 'S', value: 'sm' },
          { label: 'M', value: 'md' },
          { label: 'L', value: 'lg' },
          { label: 'XL', value: 'xl' },
        ]}
        onChange={(gap) => onChange({ gap })}
      />
      <ChipRow
        label="Align"
        value={String(atom.align ?? 'stretch')}
        options={[
          { label: 'Start', value: 'start' },
          { label: 'Center', value: 'center' },
          { label: 'End', value: 'end' },
          { label: 'Stretch', value: 'stretch' },
        ]}
        onChange={(align) => onChange({ align })}
      />
      {mode !== 'stack' ? (
        <ChipRow
          label="Justify"
          value={String(atom.justify ?? 'start')}
          options={[
            { label: 'Start', value: 'start' },
            { label: 'Center', value: 'center' },
            { label: 'End', value: 'end' },
            { label: 'Between', value: 'between' },
          ]}
          onChange={(justify) => onChange({ justify })}
        />
      ) : null}
      {mode === 'flex' ? (
        <label className="flex items-center gap-2 text-[11.5px] text-slate-300">
          <input
            type="checkbox"
            checked={Boolean(atom.wrap)}
            onChange={(e) => onChange({ wrap: e.target.checked })}
          />
          Wrap items
        </label>
      ) : null}
    </div>
  )
}

function listRender(atom: ComposerAtom) {
  const items = splitLines(atom.items ?? 'First point\nSecond point\nThird point')
  return (
    <div className="flex w-full flex-col gap-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2.5 text-[15px] text-slate-800">
          <span className="font-bold text-blue-600">✓</span>
          {item}
        </div>
      ))}
    </div>
  )
}

function cardRender(atom: ComposerAtom) {
  const icon = String(atom.icon ?? '★')
  const title = String(atom.title ?? 'Feature title')
  const text = String(atom.text ?? 'A short description of this feature.')
  const color = String(atom.color ?? '#2563eb')
  return (
    <div className="max-w-sm rounded-2xl border border-slate-100 p-6 shadow-sm">
      <span
        className="mb-3 grid h-11 w-11 place-items-center rounded-xl text-lg"
        style={{ backgroundColor: `${color}18`, color }}
      >
        {icon}
      </span>
      <div className="mb-1.5 text-base font-bold text-slate-900">{title}</div>
      <p className="text-sm leading-relaxed text-slate-600">{text}</p>
    </div>
  )
}

function quoteRender(atom: ComposerAtom) {
  const text = String(atom.text ?? 'A memorable quote goes here.')
  const author = String(atom.author ?? 'Someone, Somewhere')
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="mb-2.5 text-xl italic text-slate-900">&ldquo;{text}&rdquo;</p>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{author}</p>
    </div>
  )
}

function testimonialRender(atom: ComposerAtom) {
  const avatar = String(atom.avatar ?? '')
  const quote = String(
    atom.quote ?? 'This made everything so much easier — exactly what we needed.'
  )
  const name = String(atom.name ?? 'Jane Doe')
  const role = String(atom.role ?? 'CEO, Acme Inc.')
  return (
    <div className="max-w-xl">
      <p className="mb-3.5 leading-relaxed text-slate-700">&ldquo;{quote}&rdquo;</p>
      <div className="flex items-center gap-2.5">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-sm text-slate-400">
            {name.charAt(0)}
          </span>
        )}
        <div>
          <div className="text-sm font-bold text-slate-900">{name}</div>
          <div className="text-xs text-slate-500">{role}</div>
        </div>
      </div>
    </div>
  )
}

function statsRender(atom: ComposerAtom) {
  const number = String(atom.number ?? '500+')
  const label = String(atom.label ?? 'Happy clients')
  const color = String(atom.color ?? '#2563eb')
  return (
    <div className="text-center">
      <div className="text-4xl font-black" style={{ color }}>
        {number}
      </div>
      <div className="text-sm font-semibold text-slate-600">{label}</div>
    </div>
  )
}

function ratingRender(atom: ComposerAtom) {
  const count = Math.max(0, Math.min(5, Number(atom.count ?? 5)))
  const color = String(atom.color ?? '#f59e0b')
  return (
    <span className="text-xl tracking-wide" style={{ color }}>
      {'★'.repeat(count)}
      {'☆'.repeat(5 - count)}
    </span>
  )
}

function formRender(atom: ComposerAtom) {
  const fields = splitCsv(atom.fields ?? 'Name, Email, Message')
  const buttonText = String(atom.buttonText ?? 'Send')
  return (
    <div className="flex w-full max-w-md flex-col gap-2.5">
      {fields.map((f, i) => (
        <div
          key={i}
          className="rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-400"
        >
          {f}
        </div>
      ))}
      <span className="inline-flex w-fit rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white">
        {buttonText}
      </span>
    </div>
  )
}

// Trust boundary: this atom's `code` is only ever authored by an
// authenticated admin building a section, the same trust level as any other
// CMS "raw HTML / embed" block — never end-user or public input. Sanitized
// anyway (DOMPurify's default allowlist — strips <script>, inline event
// handlers, javascript: URIs — while still permitting the embeds/markup
// this atom exists for) as defense in depth, not because the author is
// untrusted.
function htmlRender(atom: ComposerAtom) {
  const code = String(atom.code ?? '<p>Custom HTML goes here.</p>')
  return <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(code) }} />
}

function TextInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
      />
    </label>
  )
}

function TextareaInput({
  label,
  value,
  onChange,
  rows = 3,
  mono,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
  mono?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className={`w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 ${mono ? 'font-mono' : ''}`}
      />
    </label>
  )
}

/** Image URL field with an "Upload" trigger into the shared media library —
 *  same MediaPicker + upload-to-/media/upload flow as BrandingFileControl,
 *  reused here instead of a bespoke uploader. Typing/pasting a URL directly
 *  still works; Upload is the alternative, not a replacement. */
function ImageUrlField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  return (
    <div>
      <span className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
          className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPickerOpen(true)}
          className="shrink-0 gap-1.5"
          title="Upload or choose from media library"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload
        </Button>
      </div>
      {pickerOpen && (
        <MediaPicker
          open
          onClose={() => setPickerOpen(false)}
          onSelect={(media) => {
            const url = media[0]?.url
            if (url) onChange(url)
            setPickerOpen(false)
          }}
          typeFilter="IMAGE"
        />
      )}
    </div>
  )
}

/** Swatch-row color picker — matches sectionBuilder.html's colourPicker():
 *  a row of preset swatches (brand primary/secondary + 3 neutrals) plus a
 *  native colour input as the "anything else" escape hatch. */
const SWATCH_PRESETS = ['#2563eb', '#f59e0b', '#0f172a', '#ffffff', '#e2e8f0']

function ColorInput({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string
  value: string
  fallback: string
  onChange: (v: string) => void
}) {
  const current = value || fallback
  return (
    <div>
      <span className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {SWATCH_PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            title={c}
            aria-label={`Use colour ${c}`}
            style={{ backgroundColor: c }}
            className={`h-6 w-6 rounded-md border-2 ${current === c ? 'border-blue-500' : 'border-slate-700'}`}
          />
        ))}
        <input
          type="color"
          value={/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(current) ? current : fallback}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-8 cursor-pointer rounded border border-slate-700 bg-transparent p-0"
        />
      </div>
    </div>
  )
}

export function ChipRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { label: string; value: T }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div>
      <span className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold ${
              value === o.value
                ? 'border-blue-500 bg-blue-500/15 text-blue-300'
                : 'border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** The "Style" tab — Elementor-style generic visual settings that apply to
 *  ANY atom regardless of type, separate from that atom's own content Field.
 *  Reads/writes the single `atom.style` object; `atomStyleProps()` above is
 *  what actually renders these values. */
export function AtomStyleField({
  atom,
  onChange,
}: {
  atom: ComposerAtom
  onChange: (patch: Record<string, unknown>) => void
}) {
  const s: AtomStyle = atom.style ?? {}
  function patchStyle(next: Partial<AtomStyle>) {
    onChange({ style: { ...s, ...next } })
  }
  return (
    <div className="flex flex-col gap-3.5">
      <ColorInput
        label="Text color"
        value={s.textColor ?? ''}
        fallback="#0f172a"
        onChange={(textColor) => patchStyle({ textColor })}
      />
      <ColorInput
        label="Background color"
        value={s.bgColor ?? ''}
        fallback="#ffffff"
        onChange={(bgColor) => patchStyle({ bgColor })}
      />
      <ChipRow
        label="Border width"
        value={s.borderWidth ?? 'none'}
        options={[
          { label: 'None', value: 'none' },
          { label: 'Thin', value: 'thin' },
          { label: 'Medium', value: 'medium' },
          { label: 'Thick', value: 'thick' },
        ]}
        onChange={(borderWidth) => patchStyle({ borderWidth })}
      />
      {s.borderWidth && s.borderWidth !== 'none' ? (
        <ColorInput
          label="Border color"
          value={s.borderColor ?? ''}
          fallback="#e2e8f0"
          onChange={(borderColor) => patchStyle({ borderColor })}
        />
      ) : null}
      <ChipRow
        label="Border radius"
        value={s.borderRadius ?? 'none'}
        options={[
          { label: 'None', value: 'none' },
          { label: 'S', value: 'sm' },
          { label: 'M', value: 'md' },
          { label: 'L', value: 'lg' },
          { label: 'Full', value: 'full' },
        ]}
        onChange={(borderRadius) => patchStyle({ borderRadius })}
      />
      <ChipRow
        label="Box shadow"
        value={s.shadow ?? 'none'}
        options={[
          { label: 'None', value: 'none' },
          { label: 'S', value: 'sm' },
          { label: 'M', value: 'md' },
          { label: 'L', value: 'lg' },
        ]}
        onChange={(shadow) => patchStyle({ shadow })}
      />
      <ChipRow
        label="Padding"
        value={s.padding ?? 'none'}
        options={[
          { label: 'None', value: 'none' },
          { label: 'S', value: 'sm' },
          { label: 'M', value: 'md' },
          { label: 'L', value: 'lg' },
        ]}
        onChange={(padding) => patchStyle({ padding })}
      />
      <label className="block">
        <span className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
          Font family
        </span>
        <select
          value={s.fontFamily ?? ''}
          onChange={(e) => patchStyle({ fontFamily: e.target.value || undefined })}
          className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
        >
          <option value="">Default</option>
          {FONT_FAMILY_CHOICES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

// ── Hero Slider ────────────────────────────────────────────────────────────
// A self-contained atom (no `children` tree — like Card/Testimonial), one
// image+text pair per slide, each independently image-left or image-right.
// Arrows/dots/autoplay are plain React state — no carousel library needed
// for a prev/next + dot-indicator slider.

interface SliderSlide {
  id: string
  image: string
  heading: string
  text: string
  buttonLabel: string
  buttonHref: string
  imagePosition: 'left' | 'right'
  textAlign: 'left' | 'center' | 'right'
  bgImage: string
  bgColor: string
  bgGradient: string
}

function newSlide(n: number, imagePosition: 'left' | 'right'): SliderSlide {
  return {
    id: `slide-${crypto.randomUUID()}`,
    image: '',
    heading: `Slide ${n} heading`,
    text: 'Supporting text for this slide.',
    buttonLabel: 'Learn more',
    buttonHref: '#',
    imagePosition,
    textAlign: 'left',
    bgImage: '',
    bgColor: '',
    bgGradient: 'none',
  }
}

const SLIDE_GRADIENTS: Record<string, string> = {
  none: '',
  blue: 'linear-gradient(135deg, #1d4ed8, #38bdf8)',
  sunset: 'linear-gradient(135deg, #f97316, #db2777)',
  dark: 'linear-gradient(135deg, #0f172a, #1e293b)',
  purple: 'linear-gradient(135deg, #7c3aed, #c026d3)',
}

const SLIDE_TEXT_ALIGN_CLASS: Record<SliderSlide['textAlign'], string> = {
  left: 'items-start text-left',
  center: 'items-center text-center',
  right: 'items-end text-right',
}

function SliderCarousel({ atom }: { atom: ComposerAtom }) {
  const slides = Array.isArray(atom.slides) ? (atom.slides as SliderSlide[]) : []
  const count = slides.length
  const [index, setIndex] = useState(0)
  const current = Math.min(index, Math.max(0, count - 1))

  useEffect(() => {
    if (!atom.autoplay || count <= 1) return
    const ms = Number(atom.interval ?? 5000)
    const id = setInterval(() => setIndex((i) => (i + 1) % count), ms)
    return () => clearInterval(id)
  }, [atom.autoplay, atom.interval, count])

  if (count === 0) {
    return (
      <div className="grid h-64 place-items-center rounded-xl border-2 border-dashed border-slate-200 text-sm text-slate-400">
        No slides yet — add one from the Settings panel.
      </div>
    )
  }

  const slide = slides[current]!
  const alignCls = SLIDE_TEXT_ALIGN_CLASS[slide.textAlign ?? 'left']

  // Background precedence: image > gradient > solid color > none (transparent,
  // shows the canvas white through — same as before these fields existed).
  const bgStyle: React.CSSProperties = {}
  let hasBgImage = false
  if (slide.bgImage) {
    bgStyle.backgroundImage = `url(${slide.bgImage})`
    bgStyle.backgroundSize = 'cover'
    bgStyle.backgroundPosition = 'center'
    hasBgImage = true
  } else if (slide.bgGradient && slide.bgGradient !== 'none' && SLIDE_GRADIENTS[slide.bgGradient]) {
    bgStyle.backgroundImage = SLIDE_GRADIENTS[slide.bgGradient]
  } else if (slide.bgColor) {
    bgStyle.backgroundColor = slide.bgColor
  }
  const onDarkBg =
    hasBgImage || (slide.bgGradient && slide.bgGradient !== 'none') || Boolean(slide.bgColor)

  const imageBlock = (
    <div className="aspect-video w-full overflow-hidden rounded-lg bg-gradient-to-br from-slate-100 to-slate-200">
      {slide.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={slide.image} alt="" className="h-full w-full object-cover" />
      ) : null}
    </div>
  )
  const textBlock = (
    <div className={`flex flex-col ${alignCls}`}>
      <h3
        className={`mb-3 text-2xl font-bold md:text-3xl ${onDarkBg ? 'text-white' : 'text-slate-900'}`}
      >
        {slide.heading}
      </h3>
      <p className={`mb-5 leading-relaxed ${onDarkBg ? 'text-white/85' : 'text-slate-600'}`}>
        {slide.text}
      </p>
      {slide.buttonLabel ? (
        <a
          href={slide.buttonHref || '#'}
          className="inline-flex rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700"
        >
          {slide.buttonLabel}
        </a>
      ) : null}
    </div>
  )

  return (
    <div className="w-full">
      <div className="relative overflow-hidden rounded-xl p-8" style={bgStyle}>
        {hasBgImage ? <div className="absolute inset-0 bg-black/35" /> : null}
        <div className="relative grid items-center gap-8 md:grid-cols-2">
          {slide.imagePosition === 'left' ? (
            <>
              {imageBlock}
              {textBlock}
            </>
          ) : (
            <>
              {textBlock}
              {imageBlock}
            </>
          )}
          {count > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous slide"
                onClick={() => setIndex((i) => (i - 1 + count) % count)}
                className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-700 shadow hover:bg-white"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Next slide"
                onClick={() => setIndex((i) => (i + 1) % count)}
                className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-700 shadow hover:bg-white"
              >
                ›
              </button>
            </>
          ) : null}
        </div>
      </div>
      {count > 1 ? (
        <div className="mt-4 flex justify-center gap-1.5">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-2 w-2 rounded-full transition ${
                i === current ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function sliderRender(atom: ComposerAtom) {
  return <SliderCarousel atom={atom} />
}

function SliderField({
  atom,
  onChange,
}: {
  atom: ComposerAtom
  onChange: (patch: Record<string, unknown>) => void
}) {
  const slides = Array.isArray(atom.slides) ? (atom.slides as SliderSlide[]) : []
  const [activeIdx, setActiveIdx] = useState(0)
  const idx = Math.min(activeIdx, Math.max(0, slides.length - 1))
  const slide: SliderSlide | undefined = slides[idx]

  function patchSlide(patch: Partial<SliderSlide>) {
    onChange({ slides: slides.map((s, i) => (i === idx ? { ...s, ...patch } : s)) })
  }
  function addSlide() {
    const next = [
      ...slides,
      newSlide(slides.length + 1, slides.length % 2 === 0 ? 'right' : 'left'),
    ]
    onChange({ slides: next })
    setActiveIdx(next.length - 1)
  }
  function removeSlide(i: number) {
    const next = slides.filter((_, si) => si !== i)
    onChange({ slides: next })
    setActiveIdx((prev) => Math.max(0, Math.min(prev, next.length - 1)))
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <span className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
          Slides
        </span>
        <div className="flex flex-wrap gap-1.5">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold ${
                i === idx
                  ? 'border-blue-500 bg-blue-500/15 text-blue-300'
                  : 'border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {i + 1}
            </button>
          ))}
          <button
            type="button"
            onClick={addSlide}
            className="rounded-md border border-dashed border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:border-blue-500 hover:text-blue-300"
          >
            + Slide
          </button>
        </div>
      </div>

      {slide ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
              Slide {idx + 1}
            </span>
            {slides.length > 1 ? (
              <button
                type="button"
                onClick={() => removeSlide(idx)}
                className="text-[11px] font-bold text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            ) : null}
          </div>
          <ChipRow
            label="Image position"
            value={slide.imagePosition}
            options={[
              { label: 'Left', value: 'left' },
              { label: 'Right', value: 'right' },
            ]}
            onChange={(imagePosition) => patchSlide({ imagePosition })}
          />
          <ImageUrlField
            label="Image URL"
            value={slide.image}
            onChange={(image) => patchSlide({ image })}
          />
          <TextInput
            label="Heading"
            value={slide.heading}
            onChange={(heading) => patchSlide({ heading })}
          />
          <TextareaInput
            label="Text"
            rows={3}
            value={slide.text}
            onChange={(text) => patchSlide({ text })}
          />
          <ChipRow
            label="Text position"
            value={slide.textAlign ?? 'left'}
            options={[
              { label: 'Left', value: 'left' },
              { label: 'Center', value: 'center' },
              { label: 'Right', value: 'right' },
            ]}
            onChange={(textAlign) => patchSlide({ textAlign })}
          />
          <TextInput
            label="Button label"
            value={slide.buttonLabel}
            onChange={(buttonLabel) => patchSlide({ buttonLabel })}
          />
          <TextInput
            label="Button URL"
            value={slide.buttonHref}
            onChange={(buttonHref) => patchSlide({ buttonHref })}
          />
          <div className="border-t border-slate-800 pt-3.5">
            <span className="mb-2.5 block text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
              Slide background
            </span>
            <div className="flex flex-col gap-3.5">
              <ImageUrlField
                label="Background image"
                value={slide.bgImage ?? ''}
                onChange={(bgImage) => patchSlide({ bgImage })}
              />
              <ChipRow
                label="Background gradient"
                value={slide.bgGradient ?? 'none'}
                options={[
                  { label: 'None', value: 'none' },
                  { label: 'Blue', value: 'blue' },
                  { label: 'Sunset', value: 'sunset' },
                  { label: 'Dark', value: 'dark' },
                  { label: 'Purple', value: 'purple' },
                ]}
                onChange={(bgGradient) => patchSlide({ bgGradient })}
              />
              <ColorInput
                label="Background color"
                value={slide.bgColor ?? ''}
                fallback="#ffffff"
                onChange={(bgColor) => patchSlide({ bgColor })}
              />
              <p className="text-[11px] leading-relaxed text-slate-500">
                Background image wins over gradient, gradient wins over color. A background image
                adds a dark overlay automatically so text stays readable.
              </p>
            </div>
          </div>
        </>
      ) : null}

      <ChipRow
        label="Autoplay"
        value={atom.autoplay ? 'on' : 'off'}
        options={[
          { label: 'Off', value: 'off' },
          { label: 'On', value: 'on' },
        ]}
        onChange={(v) => onChange({ autoplay: v === 'on' })}
      />
    </div>
  )
}

// Catalogue order matches sectionBuilder.html's ELEMENT_TYPES exactly, group
// by group: Basic, Branding & Navigation, Media, Content, Advanced.
export const ATOM_CATALOGUE: AtomDefinition[] = [
  // ── Basic ──────────────────────────────────────────────────────────────
  {
    type: 'heading',
    label: 'Heading',
    group: 'Basic',
    icon: HeadingIcon,
    defaultProps: { text: 'Section heading', level: '2', align: 'left' },
    Render: headingRender,
    Field: ({ atom, onChange }) => (
      <div className="flex flex-col gap-3.5">
        <TextInput
          label="Text"
          value={String(atom.text ?? '')}
          onChange={(text) => onChange({ text })}
        />
        <ChipRow
          label="Level"
          value={String(atom.level ?? '2')}
          options={[
            { label: 'H1', value: '1' },
            { label: 'H2', value: '2' },
            { label: 'H3', value: '3' },
          ]}
          onChange={(level) => onChange({ level })}
        />
        <ChipRow
          label="Align"
          value={String(atom.align ?? 'left')}
          options={[
            { label: 'Left', value: 'left' },
            { label: 'Center', value: 'center' },
            { label: 'Right', value: 'right' },
          ]}
          onChange={(align) => onChange({ align })}
        />
      </div>
    ),
  },
  {
    type: 'text',
    label: 'Paragraph',
    group: 'Basic',
    icon: Pilcrow,
    defaultProps: { text: 'Write something compelling here.', align: 'left', muted: false },
    Render: textRender,
    Field: ({ atom, onChange }) => (
      <div className="flex flex-col gap-3.5">
        <TextInput
          label="Text"
          value={String(atom.text ?? '')}
          onChange={(text) => onChange({ text })}
        />
        <ChipRow
          label="Align"
          value={String(atom.align ?? 'left')}
          options={[
            { label: 'Left', value: 'left' },
            { label: 'Center', value: 'center' },
            { label: 'Right', value: 'right' },
          ]}
          onChange={(align) => onChange({ align })}
        />
      </div>
    ),
  },
  {
    type: 'button',
    label: 'Button',
    group: 'Basic',
    icon: RectangleHorizontal,
    defaultProps: { label: 'Click me', href: '#', variant: 'primary' },
    Render: buttonRender,
    Field: ({ atom, onChange }) => (
      <div className="flex flex-col gap-3.5">
        <TextInput
          label="Label"
          value={String(atom.label ?? '')}
          onChange={(label) => onChange({ label })}
        />
        <TextInput
          label="URL"
          value={String(atom.href ?? '')}
          onChange={(href) => onChange({ href })}
        />
        <ChipRow
          label="Style"
          value={String(atom.variant ?? 'primary')}
          options={[
            { label: 'Primary', value: 'primary' },
            { label: 'Secondary', value: 'secondary' },
          ]}
          onChange={(variant) => onChange({ variant })}
        />
      </div>
    ),
  },
  {
    type: 'badge',
    label: 'Badge',
    group: 'Basic',
    icon: Tag,
    defaultProps: { text: 'New', tone: 'primary' },
    Render: badgeRender,
    Field: ({ atom, onChange }) => (
      <div className="flex flex-col gap-3.5">
        <TextInput
          label="Text"
          value={String(atom.text ?? '')}
          onChange={(text) => onChange({ text })}
        />
        <ChipRow
          label="Tone"
          value={String(atom.tone ?? 'primary')}
          options={[
            { label: 'Primary', value: 'primary' },
            { label: 'Secondary', value: 'secondary' },
            { label: 'Neutral', value: 'neutral' },
          ]}
          onChange={(tone) => onChange({ tone })}
        />
      </div>
    ),
  },
  {
    type: 'divider',
    label: 'Divider',
    group: 'Basic',
    icon: SeparatorHorizontal,
    defaultProps: {},
    Render: dividerRender,
    Field: () => <p className="text-xs text-slate-500">A plain horizontal rule — no settings.</p>,
  },
  {
    type: 'spacer',
    label: 'Spacer',
    group: 'Basic',
    icon: Minus,
    defaultProps: { size: 'md' },
    Render: spacerRender,
    Field: ({ atom, onChange }) => (
      <ChipRow
        label="Size"
        value={String(atom.size ?? 'md')}
        options={[
          { label: 'S', value: 'sm' },
          { label: 'M', value: 'md' },
          { label: 'L', value: 'lg' },
          { label: 'XL', value: 'xl' },
        ]}
        onChange={(size) => onChange({ size })}
      />
    ),
  },
  // ── Branding & Navigation ─────────────────────────────────────────────
  {
    type: 'logo',
    label: 'Logo',
    group: 'Branding & Navigation',
    icon: Sparkles,
    defaultProps: { src: '', text: 'Your Brand', size: 'md' },
    Render: logoRender,
    Field: ({ atom, onChange }) => (
      <div className="flex flex-col gap-3.5">
        <TextInput
          label="Image URL (optional)"
          value={String(atom.src ?? '')}
          onChange={(src) => onChange({ src })}
        />
        <TextInput
          label="Text (used if no image)"
          value={String(atom.text ?? '')}
          onChange={(text) => onChange({ text })}
        />
        <ChipRow
          label="Size"
          value={String(atom.size ?? 'md')}
          options={[
            { label: 'S', value: 'sm' },
            { label: 'M', value: 'md' },
            { label: 'L', value: 'lg' },
          ]}
          onChange={(size) => onChange({ size })}
        />
      </div>
    ),
  },
  {
    type: 'nav',
    label: 'Navigation',
    group: 'Branding & Navigation',
    icon: MenuIcon,
    defaultProps: { items: 'Home, About, Services, Contact', align: 'center' },
    Render: navRender,
    Field: ({ atom, onChange }) => (
      <div className="flex flex-col gap-3.5">
        <TextareaInput
          label="Menu items (comma separated)"
          rows={2}
          value={String(atom.items ?? '')}
          onChange={(items) => onChange({ items })}
        />
        <ChipRow
          label="Align"
          value={String(atom.align ?? 'center')}
          options={[
            { label: 'Left', value: 'left' },
            { label: 'Center', value: 'center' },
            { label: 'Right', value: 'right' },
          ]}
          onChange={(align) => onChange({ align })}
        />
      </div>
    ),
  },
  {
    type: 'social',
    label: 'Social Icons',
    group: 'Branding & Navigation',
    icon: Share2,
    defaultProps: { items: 'f, ig, x, in', color: '#2563eb' },
    Render: socialRender,
    Field: ({ atom, onChange }) => (
      <div className="flex flex-col gap-3.5">
        <TextInput
          label="Icons (comma separated, e.g. f, ig, x, in)"
          value={String(atom.items ?? '')}
          onChange={(items) => onChange({ items })}
        />
        <ColorInput
          label="Color"
          value={String(atom.color ?? '')}
          fallback="#2563eb"
          onChange={(color) => onChange({ color })}
        />
      </div>
    ),
  },
  // ── Media ────────────────────────────────────────────────────────────
  {
    type: 'image',
    label: 'Image',
    group: 'Media',
    icon: ImageIcon,
    defaultProps: { src: '', alt: '', rounded: true },
    Render: imageRender,
    Field: ({ atom, onChange }) => (
      <div className="flex flex-col gap-3.5">
        <ImageUrlField
          label="Image URL"
          value={String(atom.src ?? '')}
          onChange={(src) => onChange({ src })}
        />
        <TextInput
          label="Alt text"
          value={String(atom.alt ?? '')}
          onChange={(alt) => onChange({ alt })}
        />
      </div>
    ),
  },
  {
    type: 'video',
    label: 'Video',
    group: 'Media',
    icon: VideoIcon,
    defaultProps: { thumb: '', height: 320 },
    Render: videoRender,
    Field: ({ atom, onChange }) => (
      <div className="flex flex-col gap-3.5">
        <TextInput
          label="Thumbnail image URL"
          value={String(atom.thumb ?? '')}
          onChange={(thumb) => onChange({ thumb })}
        />
        <label className="block">
          <span className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
            Height (px)
          </span>
          <input
            type="number"
            value={Number(atom.height ?? 320)}
            onChange={(e) => onChange({ height: Math.max(0, Number(e.target.value) || 0) })}
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
        </label>
      </div>
    ),
  },
  // ── Content ──────────────────────────────────────────────────────────
  {
    type: 'icontext',
    label: 'Icon + Text',
    group: 'Content',
    icon: Zap,
    defaultProps: { icon: '★', text: 'A short highlight', color: '#2563eb' },
    Render: icontextRender,
    Field: ({ atom, onChange }) => (
      <div className="flex flex-col gap-3.5">
        <TextInput
          label="Icon (emoji or symbol)"
          value={String(atom.icon ?? '')}
          onChange={(icon) => onChange({ icon })}
        />
        <TextInput
          label="Text"
          value={String(atom.text ?? '')}
          onChange={(text) => onChange({ text })}
        />
        <ColorInput
          label="Color"
          value={String(atom.color ?? '')}
          fallback="#2563eb"
          onChange={(color) => onChange({ color })}
        />
      </div>
    ),
  },
  {
    type: 'slider',
    label: 'Hero Slider',
    group: 'Content',
    icon: GalleryHorizontal,
    defaultProps: {
      slides: [newSlide(1, 'right'), newSlide(2, 'left')],
      autoplay: false,
      interval: 5000,
    },
    Render: sliderRender,
    Field: SliderField,
  },
  {
    type: 'layout',
    label: 'Layout',
    group: 'Content',
    icon: LayoutGrid,
    defaultProps: {
      mode: 'grid',
      columns: 12,
      direction: 'row',
      gap: 'md',
      align: 'stretch',
      justify: 'start',
      wrap: false,
      children: [],
    },
    Render: layoutRender,
    Field: layoutField,
  },
  {
    type: 'list',
    label: 'List',
    group: 'Content',
    icon: ListIcon,
    defaultProps: { items: 'First point\nSecond point\nThird point' },
    Render: listRender,
    Field: ({ atom, onChange }) => (
      <TextareaInput
        label="Items (one per line)"
        rows={4}
        value={String(atom.items ?? '')}
        onChange={(items) => onChange({ items })}
      />
    ),
  },
  {
    type: 'card',
    label: 'Card',
    group: 'Content',
    icon: Square,
    defaultProps: {
      icon: '★',
      title: 'Feature title',
      text: 'A short description of this feature.',
      color: '#2563eb',
    },
    Render: cardRender,
    Field: ({ atom, onChange }) => (
      <div className="flex flex-col gap-3.5">
        <TextInput
          label="Icon (emoji or symbol)"
          value={String(atom.icon ?? '')}
          onChange={(icon) => onChange({ icon })}
        />
        <TextInput
          label="Title"
          value={String(atom.title ?? '')}
          onChange={(title) => onChange({ title })}
        />
        <TextareaInput
          label="Text"
          value={String(atom.text ?? '')}
          onChange={(text) => onChange({ text })}
        />
        <ColorInput
          label="Color"
          value={String(atom.color ?? '')}
          fallback="#2563eb"
          onChange={(color) => onChange({ color })}
        />
      </div>
    ),
  },
  {
    type: 'quote',
    label: 'Quote',
    group: 'Content',
    icon: QuoteIcon,
    defaultProps: { text: 'A memorable quote goes here.', author: 'Someone, Somewhere' },
    Render: quoteRender,
    Field: ({ atom, onChange }) => (
      <div className="flex flex-col gap-3.5">
        <TextareaInput
          label="Quote"
          value={String(atom.text ?? '')}
          onChange={(text) => onChange({ text })}
        />
        <TextInput
          label="Author"
          value={String(atom.author ?? '')}
          onChange={(author) => onChange({ author })}
        />
      </div>
    ),
  },
  {
    type: 'testimonial',
    label: 'Testimonial',
    group: 'Content',
    icon: MessageSquare,
    defaultProps: {
      avatar: '',
      quote: 'This made everything so much easier — exactly what we needed.',
      name: 'Jane Doe',
      role: 'CEO, Acme Inc.',
    },
    Render: testimonialRender,
    Field: ({ atom, onChange }) => (
      <div className="flex flex-col gap-3.5">
        <TextInput
          label="Avatar image URL (optional)"
          value={String(atom.avatar ?? '')}
          onChange={(avatar) => onChange({ avatar })}
        />
        <TextareaInput
          label="Quote"
          value={String(atom.quote ?? '')}
          onChange={(quote) => onChange({ quote })}
        />
        <TextInput
          label="Name"
          value={String(atom.name ?? '')}
          onChange={(name) => onChange({ name })}
        />
        <TextInput
          label="Role / company"
          value={String(atom.role ?? '')}
          onChange={(role) => onChange({ role })}
        />
      </div>
    ),
  },
  {
    type: 'stats',
    label: 'Stat',
    group: 'Content',
    icon: BarChart3,
    defaultProps: { number: '500+', label: 'Happy clients', color: '#2563eb' },
    Render: statsRender,
    Field: ({ atom, onChange }) => (
      <div className="flex flex-col gap-3.5">
        <TextInput
          label="Number"
          value={String(atom.number ?? '')}
          onChange={(number) => onChange({ number })}
        />
        <TextInput
          label="Label"
          value={String(atom.label ?? '')}
          onChange={(label) => onChange({ label })}
        />
        <ColorInput
          label="Color"
          value={String(atom.color ?? '')}
          fallback="#2563eb"
          onChange={(color) => onChange({ color })}
        />
      </div>
    ),
  },
  {
    type: 'rating',
    label: 'Rating',
    group: 'Content',
    icon: Star,
    defaultProps: { count: 5, color: '#f59e0b' },
    Render: ratingRender,
    Field: ({ atom, onChange }) => (
      <div className="flex flex-col gap-3.5">
        <label className="block">
          <span className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
            Stars (0-5)
          </span>
          <input
            type="number"
            min={0}
            max={5}
            value={Number(atom.count ?? 5)}
            onChange={(e) =>
              onChange({ count: Math.max(0, Math.min(5, Number(e.target.value) || 0)) })
            }
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <ColorInput
          label="Color"
          value={String(atom.color ?? '')}
          fallback="#f59e0b"
          onChange={(color) => onChange({ color })}
        />
      </div>
    ),
  },
  // ── Advanced ─────────────────────────────────────────────────────────
  {
    type: 'form',
    label: 'Form',
    group: 'Advanced',
    icon: ClipboardList,
    defaultProps: { fields: 'Name, Email, Message', buttonText: 'Send' },
    Render: formRender,
    Field: ({ atom, onChange }) => (
      <div className="flex flex-col gap-3.5">
        <TextInput
          label="Fields (comma separated)"
          value={String(atom.fields ?? '')}
          onChange={(fields) => onChange({ fields })}
        />
        <TextInput
          label="Button text"
          value={String(atom.buttonText ?? '')}
          onChange={(buttonText) => onChange({ buttonText })}
        />
      </div>
    ),
  },
  {
    type: 'html',
    label: 'HTML / Embed',
    group: 'Advanced',
    icon: Code2,
    defaultProps: { code: '<p>Custom HTML goes here.</p>' },
    Render: htmlRender,
    Field: ({ atom, onChange }) => (
      <TextareaInput
        label="Custom HTML"
        rows={6}
        mono
        value={String(atom.code ?? '')}
        onChange={(code) => onChange({ code })}
      />
    ),
  },
]

export const ATOM_BY_TYPE: Record<string, AtomDefinition> = Object.fromEntries(
  ATOM_CATALOGUE.map((a) => [a.type, a])
)
