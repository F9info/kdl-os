'use client'

import {
  Heading as HeadingIcon,
  Type,
  Image as ImageIcon,
  RectangleHorizontal,
  Minus,
  Star,
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
]

export const ATOM_BY_TYPE: Record<string, AtomDefinition> = Object.fromEntries(
  ATOM_CATALOGUE.map((a) => [a.type, a])
)
