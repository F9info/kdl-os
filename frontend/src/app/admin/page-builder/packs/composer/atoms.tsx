'use client'

import DOMPurify from 'dompurify'
import {
  Heading as HeadingIcon,
  Type,
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
  Columns,
  LayoutGrid,
  List as ListIcon,
  Square,
  Quote as QuoteIcon,
  MessageSquare,
  BarChart3,
  ClipboardList,
  Code2,
} from 'lucide-react'

export type Align = 'left' | 'center' | 'right'

export interface ComposerAtom {
  id: string
  type: string
  hideMobile?: boolean
  [prop: string]: unknown
}

export interface AtomDefinition {
  type: string
  label: string
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
  return (
    <a
      href={href}
      className={`inline-flex rounded-lg px-5 py-2.5 font-medium transition ${
        variant === 'primary'
          ? 'bg-blue-600 text-white hover:bg-blue-700'
          : 'border border-slate-300 text-slate-800 hover:bg-slate-100'
      }`}
    >
      {label}
    </a>
  )
}

function imageRender(atom: ComposerAtom) {
  const src = String(atom.src ?? 'https://placehold.co/1200x600')
  const alt = String(atom.alt ?? '')
  const rounded = Boolean(atom.rounded)
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

const ICON_SIZE = { sm: 20, md: 32, lg: 48 } as const

function iconRender(atom: ComposerAtom) {
  const size = (atom.size as keyof typeof ICON_SIZE) ?? 'md'
  const color = String(atom.color ?? '#2563eb')
  return <Star size={ICON_SIZE[size] ?? ICON_SIZE.md} color={color} />
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
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${cls}`}
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
  return (
    <nav className={`flex flex-wrap gap-6 ${justify}`}>
      {items.map((item, i) => (
        <span key={i} className="text-sm font-semibold text-slate-800">
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

function columnsRender(atom: ComposerAtom) {
  const left = String(atom.left ?? 'First column text.')
  const right = String(atom.right ?? 'Second column text.')
  return (
    <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
      <p className="leading-relaxed text-slate-700">{left}</p>
      <p className="leading-relaxed text-slate-700">{right}</p>
    </div>
  )
}

function gridRender(atom: ComposerAtom) {
  const cols = Math.max(2, Math.min(6, Number(atom.cols ?? 3)))
  const items = (Array.isArray(atom.items) ? (atom.items as string[]) : []).slice(0, cols)
  while (items.length < cols) items.push('Column text.')
  return (
    <div className="grid w-full gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {items.map((t, i) => (
        <div
          key={i}
          className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700"
        >
          {t}
        </div>
      ))}
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
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
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
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className={`w-full rounded-md border border-slate-200 px-3 py-2 text-sm ${mono ? 'font-mono' : ''}`}
      />
    </label>
  )
}

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
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      <input
        type="color"
        value={value || fallback}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-14 cursor-pointer rounded-md border border-slate-200"
      />
    </label>
  )
}

function ChipRow<T extends string>({
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
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      <div className="flex gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold ${
              value === o.value
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export const ATOM_CATALOGUE: AtomDefinition[] = [
  {
    type: 'heading',
    label: 'Heading',
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
    label: 'Text',
    icon: Type,
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
    type: 'image',
    label: 'Image',
    icon: ImageIcon,
    defaultProps: { src: 'https://placehold.co/1200x600', alt: '', rounded: true },
    Render: imageRender,
    Field: ({ atom, onChange }) => (
      <div className="flex flex-col gap-3.5">
        <TextInput
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
    type: 'spacer',
    label: 'Spacer',
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
  {
    type: 'icon',
    label: 'Icon',
    icon: Star,
    defaultProps: { size: 'md', color: '#2563eb' },
    Render: iconRender,
    Field: ({ atom, onChange }) => (
      <div className="flex flex-col gap-3.5">
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
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">Color</span>
          <input
            type="color"
            value={String(atom.color ?? '#2563eb')}
            onChange={(e) => onChange({ color: e.target.value })}
            className="h-9 w-14 cursor-pointer rounded-md border border-slate-200"
          />
        </label>
      </div>
    ),
  },
  {
    type: 'badge',
    label: 'Badge',
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
    icon: SeparatorHorizontal,
    defaultProps: {},
    Render: dividerRender,
    Field: () => <p className="text-xs text-slate-400">A plain horizontal rule — no settings.</p>,
  },
  {
    type: 'logo',
    label: 'Logo',
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
  {
    type: 'video',
    label: 'Video',
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
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">Height (px)</span>
          <input
            type="number"
            value={Number(atom.height ?? 320)}
            onChange={(e) => onChange({ height: Math.max(0, Number(e.target.value) || 0) })}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
      </div>
    ),
  },
  {
    type: 'icontext',
    label: 'Icon + Text',
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
    type: 'columns',
    label: '2 Columns',
    icon: Columns,
    defaultProps: { left: 'First column text.', right: 'Second column text.' },
    Render: columnsRender,
    Field: ({ atom, onChange }) => (
      <div className="flex flex-col gap-3.5">
        <TextareaInput
          label="Left column"
          value={String(atom.left ?? '')}
          onChange={(left) => onChange({ left })}
        />
        <TextareaInput
          label="Right column"
          value={String(atom.right ?? '')}
          onChange={(right) => onChange({ right })}
        />
      </div>
    ),
  },
  {
    type: 'grid',
    label: 'Grid',
    icon: LayoutGrid,
    defaultProps: {
      cols: 3,
      items: ['First column text.', 'Second column text.', 'Third column text.'],
    },
    Render: gridRender,
    Field: ({ atom, onChange }) => {
      const items = Array.isArray(atom.items) ? (atom.items as string[]) : []
      const cols = Number(atom.cols ?? 3)
      return (
        <div className="flex flex-col gap-3.5">
          <ChipRow
            label="Columns"
            value={String(cols)}
            options={[2, 3, 4, 5, 6].map((n) => ({ label: `${n}`, value: String(n) }))}
            onChange={(v) => {
              const n = Number(v)
              const next = [...items]
              while (next.length < n) next.push('Column text.')
              onChange({ cols: n, items: next.slice(0, n) })
            }}
          />
          {items.slice(0, cols).map((t, i) => (
            <TextareaInput
              key={i}
              label={`Column ${i + 1}`}
              rows={2}
              value={t}
              onChange={(v) => {
                const next = [...items]
                next[i] = v
                onChange({ items: next })
              }}
            />
          ))}
        </div>
      )
    },
  },
  {
    type: 'list',
    label: 'List',
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
    icon: Star,
    defaultProps: { count: 5, color: '#f59e0b' },
    Render: ratingRender,
    Field: ({ atom, onChange }) => (
      <div className="flex flex-col gap-3.5">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">Stars (0-5)</span>
          <input
            type="number"
            min={0}
            max={5}
            value={Number(atom.count ?? 5)}
            onChange={(e) =>
              onChange({ count: Math.max(0, Math.min(5, Number(e.target.value) || 0)) })
            }
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
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
  {
    type: 'form',
    label: 'Form',
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
