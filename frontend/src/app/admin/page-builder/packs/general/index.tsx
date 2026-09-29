import type { ReactNode } from 'react'
import type { Config } from '@puckeditor/core'
import type { ComponentPack } from '../types'
import { variantField } from '../variant-field'
import { imageField } from '../image-field'
import { InlineEditableText } from '../inline-editable-text'

type Align = 'left' | 'center' | 'right'

const alignFlex: Record<Align, string> = {
  left: 'text-left items-start',
  center: 'text-center items-center',
  right: 'text-right items-end',
}

const gapClass = { sm: 'gap-3', md: 'gap-6', lg: 'gap-10' } as const
const padClass = { sm: 'py-6', md: 'py-12', lg: 'py-20' } as const
const spaceClass = { sm: 'h-4', md: 'h-8', lg: 'h-16', xl: 'h-28' } as const

type GeneralProps = {
  Hero: {
    variant: '1' | '2' | '3' | '4'
    title: string
    subtitle: string
    ctaLabel: string
    ctaHref: string
    align: Align
    image: string
    primaryColor: string
  }
  Heading: { text: string; level: '1' | '2' | '3'; align: Align }
  Text: { text: string; align: Align; muted: boolean; variant: '1' | '2' | '3' | '4' }
  Button: { label: string; href: string; variant: 'primary' | 'secondary' }
  Image: { src: string; alt: string; rounded: boolean }
  Spacer: { size: 'sm' | 'md' | 'lg' | 'xl' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Columns: { gap: 'sm' | 'md' | 'lg'; left: any; right: any }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Section: { background: 'none' | 'muted' | 'accent'; padding: 'sm' | 'md' | 'lg'; content: any }
  NavBar: {
    variant: '1' | '2' | '3' | '4'
    brand: string
    logoUrl: string
    links: string
    ctaLabel: string
    ctaHref: string
    primaryColor: string
  }
  StatsStrip: { stats: string }
  FeatureCards: {
    variant: '1' | '2' | '3' | '4'
    sectionTitle: string
    sectionSubtitle: string
    cards: string
  }
  Footer: {
    variant: '1' | '2' | '3' | '4'
    brand: string
    logoUrl: string
    tagline: string
    links: string
    copyright: string
  }
  TaglineStrip: {
    variant: '1' | '2' | '3' | '4'
    logoUrl: string
    brand: string
    headline: string
    highlightPhrase: string
    subtext: string
    primaryColor: string
    accentColor: string
    ctaLabel: string
    ctaHref: string
  }
}

// Old 'layout'/'content' category cards are gone — Section/Columns/Spacer/
// Heading/Text/Button/Image stay reachable via blocks-panel.tsx's "Inner
// Content" quick-insert row. The remaining components join the 16-category
// taxonomy from templateEnginesections.html: Hero owns 'welcome' outright;
// NavBar/Footer/StatsStrip/FeatureCards fold into categories construction
// already defines (compose.ts concatenates same-key category component
// arrays across packs) so those pickers show more real design choices.
const typedCategories: NonNullable<Config<GeneralProps>['categories']> = {
  welcome: { title: 'Welcome', components: ['Hero'] },
  services: { title: 'Services', components: ['FeatureCards'] },
  bottombar: { title: 'Footer', components: ['Footer'] },
  counters: { title: 'Counters', components: ['StatsStrip'] },
  taglinestrip: { title: 'Tagline Strip', components: ['TaglineStrip'] },
}

// ─── Shared helpers (mirrors the pipe-delimited-line pattern the medical/
// construction packs use for repeatable rows) ────────────────────────────
function parseLine<T>(raw: string, parser: (line: string) => T | null): T[] {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map(parser)
    .filter((v): v is T => v !== null)
}

function parsePipeLines(raw: string, fieldCount: number): string[][] {
  return parseLine(raw, (line) => {
    const parts = line.split('|').map((p) => p.trim())
    return parts.length >= fieldCount ? parts : null
  })
}

// ─── Design-variant thumbnails (abstract layout sketches, not live content
// previews — see variant-field.tsx for why) ───────────────────────────────

function SketchBox({ className, children }: { className: string; children?: ReactNode }) {
  return (
    <div className={`h-16 w-full overflow-hidden rounded-md border border-slate-200 ${className}`}>
      {children}
    </div>
  )
}

const HERO_VARIANT_LABELS: Record<string, string> = {
  '1': 'Centered, plain',
  '2': 'Split, image right',
  '3': 'Dark, centered',
  '4': 'Minimal card',
}
function HeroVariantThumb({ variant }: { variant: string }) {
  if (variant === '2')
    return (
      <SketchBox className="flex gap-1 bg-white p-2">
        <div className="flex flex-1 flex-col justify-center gap-1">
          <div className="h-1.5 w-3/4 rounded bg-slate-400/70" />
          <div className="h-1.5 w-2/3 rounded bg-slate-400/50" />
          <div className="mt-1 h-2 w-8 rounded bg-blue-600" />
        </div>
        <div className="flex-1 rounded bg-slate-300" />
      </SketchBox>
    )
  if (variant === '3')
    return (
      <SketchBox className="flex flex-col items-center justify-center gap-1 bg-slate-900 p-2">
        <div className="h-1.5 w-2/3 rounded bg-white/80" />
        <div className="h-1.5 w-1/2 rounded bg-white/60" />
        <div className="mt-1 h-2 w-8 rounded bg-white" />
      </SketchBox>
    )
  if (variant === '4')
    return (
      <SketchBox className="flex items-center justify-center bg-white p-2">
        <div className="flex w-3/4 flex-col items-center gap-1 rounded-md border border-slate-300 p-2">
          <div className="h-1.5 w-2/3 rounded bg-slate-400/70" />
          <div className="h-2 w-8 rounded bg-blue-600" />
        </div>
      </SketchBox>
    )
  return (
    <SketchBox className="flex flex-col items-center justify-center gap-1 bg-slate-50 p-2">
      <div className="h-1.5 w-2/3 rounded bg-slate-400/70" />
      <div className="h-1.5 w-1/2 rounded bg-slate-400/50" />
      <div className="mt-1 h-2 w-8 rounded bg-blue-600" />
    </SketchBox>
  )
}

const TEXT_VARIANT_LABELS: Record<string, string> = {
  '1': 'Plain paragraph',
  '2': 'Pull quote',
  '3': 'Card',
  '4': 'Labeled intro',
}
function TextVariantThumb({ variant }: { variant: string }) {
  if (variant === '2')
    return (
      <SketchBox className="flex items-center bg-slate-50 p-2">
        <div className="mr-2 h-full w-1 rounded bg-slate-400" />
        <div className="space-y-1">
          <div className="h-1.5 w-24 rounded bg-slate-400/70" />
          <div className="h-1.5 w-16 rounded bg-slate-400/50" />
        </div>
      </SketchBox>
    )
  if (variant === '3')
    return (
      <SketchBox className="flex items-center justify-center bg-white p-2">
        <div className="h-full w-full space-y-1 rounded-md border border-slate-300 bg-slate-50 p-2">
          <div className="h-1.5 w-3/4 rounded bg-slate-400/70" />
          <div className="h-1.5 w-1/2 rounded bg-slate-400/50" />
        </div>
      </SketchBox>
    )
  if (variant === '4')
    return (
      <SketchBox className="flex flex-col justify-center gap-1.5 bg-white p-2">
        <div className="h-1 w-10 rounded bg-slate-300" />
        <div className="h-1.5 w-3/4 rounded bg-slate-400/70" />
        <div className="h-1.5 w-1/2 rounded bg-slate-400/50" />
      </SketchBox>
    )
  return (
    <SketchBox className="flex flex-col justify-center gap-1.5 bg-white p-2">
      <div className="h-1.5 w-3/4 rounded bg-slate-400/70" />
      <div className="h-1.5 w-2/3 rounded bg-slate-400/50" />
      <div className="h-1.5 w-1/2 rounded bg-slate-400/50" />
    </SketchBox>
  )
}

const NAVBAR_VARIANT_LABELS: Record<string, string> = {
  '1': 'Brand + links + CTA',
  '2': 'Centered, stacked',
  '3': 'Dark',
  '4': 'Minimal',
}
function NavBarVariantThumb({ variant }: { variant: string }) {
  if (variant === '2')
    return (
      <SketchBox className="flex flex-col items-center justify-center gap-1 bg-white p-2">
        <div className="h-1.5 w-16 rounded bg-slate-700" />
        <div className="flex gap-1.5">
          <div className="h-1 w-6 rounded bg-slate-400/60" />
          <div className="h-1 w-6 rounded bg-slate-400/60" />
          <div className="h-1 w-6 rounded bg-slate-400/60" />
        </div>
      </SketchBox>
    )
  if (variant === '3')
    return (
      <SketchBox className="flex items-center justify-between bg-slate-800 p-2">
        <div className="h-1.5 w-10 rounded bg-white/80" />
        <div className="flex gap-1.5">
          <div className="h-1 w-5 rounded bg-white/50" />
          <div className="h-1 w-5 rounded bg-white/50" />
        </div>
        <div className="h-2.5 w-8 rounded bg-white" />
      </SketchBox>
    )
  if (variant === '4')
    return (
      <SketchBox className="flex items-center justify-between bg-white p-2">
        <div className="h-1.5 w-10 rounded bg-slate-700" />
        <div className="h-2.5 w-10 rounded bg-slate-900" />
      </SketchBox>
    )
  return (
    <SketchBox className="flex items-center justify-between bg-white p-2">
      <div className="h-1.5 w-10 rounded bg-slate-700" />
      <div className="flex gap-1.5">
        <div className="h-1 w-5 rounded bg-slate-400/60" />
        <div className="h-1 w-5 rounded bg-slate-400/60" />
        <div className="h-1 w-5 rounded bg-slate-400/60" />
      </div>
      <div className="h-2.5 w-8 rounded bg-blue-600" />
    </SketchBox>
  )
}

const FEATURE_CARDS_VARIANT_LABELS: Record<string, string> = {
  '1': '3-column grid',
  '2': 'Centered list',
  '3': 'Dark band',
  '4': 'Icon row',
}
function FeatureCardsVariantThumb({ variant }: { variant: string }) {
  if (variant === '2')
    return (
      <SketchBox className="flex flex-col items-center justify-center gap-1 bg-white p-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-1.5 w-2/3 rounded bg-slate-400/60" />
        ))}
      </SketchBox>
    )
  if (variant === '3')
    return (
      <SketchBox className="grid grid-cols-3 gap-1 bg-slate-800 p-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded bg-white/15" />
        ))}
      </SketchBox>
    )
  if (variant === '4')
    return (
      <SketchBox className="flex items-center justify-around bg-white p-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-6 w-6 rounded-full bg-slate-300" />
        ))}
      </SketchBox>
    )
  return (
    <SketchBox className="grid grid-cols-3 gap-1 bg-white p-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded border border-slate-200 bg-slate-50" />
      ))}
    </SketchBox>
  )
}

const FOOTER_VARIANT_LABELS: Record<string, string> = {
  '1': 'Split, dark',
  '2': 'Centered, dark',
  '3': 'Split, light',
  '4': 'Minimal',
}
function FooterVariantThumb({ variant }: { variant: string }) {
  const dark = variant === '1' || variant === '2'
  if (variant === '2')
    return (
      <SketchBox
        className={`flex flex-col items-center justify-center gap-1 p-2 ${dark ? 'bg-slate-900' : 'bg-white'}`}
      >
        <div className="h-1.5 w-16 rounded bg-white/80" />
        <div className="flex gap-1.5">
          <div className="h-1 w-5 rounded bg-white/40" />
          <div className="h-1 w-5 rounded bg-white/40" />
        </div>
      </SketchBox>
    )
  if (variant === '3')
    return (
      <SketchBox className="flex items-center justify-between bg-slate-50 p-2">
        <div className="h-1.5 w-16 rounded bg-slate-700" />
        <div className="flex gap-1.5">
          <div className="h-1 w-5 rounded bg-slate-400/60" />
          <div className="h-1 w-5 rounded bg-slate-400/60" />
        </div>
      </SketchBox>
    )
  if (variant === '4')
    return (
      <SketchBox className="flex items-center justify-center bg-white p-2">
        <div className="h-1 w-24 rounded bg-slate-300" />
      </SketchBox>
    )
  return (
    <SketchBox
      className={`flex items-center justify-between p-2 ${dark ? 'bg-slate-900' : 'bg-white'}`}
    >
      <div className="h-1.5 w-14 rounded bg-white/80" />
      <div className="flex gap-1.5">
        <div className="h-1 w-5 rounded bg-white/40" />
        <div className="h-1 w-5 rounded bg-white/40" />
      </div>
    </SketchBox>
  )
}

const TAGLINE_STRIP_VARIANT_LABELS: Record<string, string> = {
  '1': 'Gradient banner',
  '2': 'Dark, mark + text',
  '3': 'Minimal rule bar',
  '4': 'Floating card',
}
function TaglineStripVariantThumb({ variant }: { variant: string }) {
  if (variant === '2')
    return (
      <SketchBox className="flex items-center justify-center gap-1.5 bg-slate-900 p-2">
        <div className="h-3 w-3 flex-none rounded-full bg-orange-400" />
        <div className="h-1.5 w-16 rounded bg-white/70" />
      </SketchBox>
    )
  if (variant === '3')
    return (
      <SketchBox className="flex flex-col items-center justify-center gap-1.5 border border-slate-200 bg-white p-2">
        <div className="h-1.5 w-20 rounded bg-slate-700" />
        <div className="h-0.5 w-4 rounded bg-orange-400" />
      </SketchBox>
    )
  if (variant === '4')
    return (
      <SketchBox className="flex items-center justify-center bg-slate-100 p-2">
        <div className="flex h-10 w-24 flex-col items-center justify-center gap-1 rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="h-1 w-14 rounded bg-slate-700" />
          <div className="h-1.5 w-8 rounded bg-orange-400" />
        </div>
      </SketchBox>
    )
  return (
    <SketchBox className="flex flex-col items-center justify-center gap-1 bg-gradient-to-r from-orange-600 to-orange-400 p-2">
      <div className="h-1 w-10 rounded bg-white/70" />
      <div className="h-1.5 w-20 rounded bg-white" />
    </SketchBox>
  )
}

const typedComponents: Config<GeneralProps>['components'] = {
  Hero: {
    label: 'Hero',
    fields: {
      variant: variantField(HERO_VARIANT_LABELS, HeroVariantThumb),
      title: { type: 'text' },
      subtitle: { type: 'textarea' },
      ctaLabel: { type: 'text' },
      ctaHref: { type: 'text' },
      align: {
        type: 'radio',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Center', value: 'center' },
          { label: 'Right', value: 'right' },
        ],
      },
      image: { type: 'text' },
      primaryColor: { type: 'text' },
    },
    defaultProps: {
      variant: '1',
      title: 'Build faster with KDL',
      subtitle: 'A flexible, modern page builder that ships responsive pages to every device.',
      ctaLabel: 'Get started',
      ctaHref: '#',
      align: 'center',
      image:
        'data:image/svg+xml;utf8,' +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700"><rect width="100%" height="100%" fill="#e2e8f0"/></svg>'
        ),
      primaryColor: '',
    },
    render: ({ variant, title, subtitle, ctaLabel, ctaHref, align, image, primaryColor }) => {
      const cta = ctaLabel ? (
        <a
          href={ctaHref}
          style={primaryColor ? { backgroundColor: primaryColor } : undefined}
          className="mt-2 inline-flex rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition"
        >
          {ctaLabel}
        </a>
      ) : null

      if (variant === '2') {
        return (
          <section className="grid grid-cols-1 items-center gap-10 px-6 py-16 md:grid-cols-2 md:py-24">
            <div className={`flex flex-col ${alignFlex[align]} gap-5`}>
              <h1 className="max-w-xl text-3xl font-bold tracking-tight md:text-5xl">{title}</h1>
              <p className="max-w-lg text-base text-slate-600 md:text-xl">{subtitle}</p>
              {cta}
            </div>
            <div className="min-h-[280px] overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="" className="h-full w-full object-cover" />
            </div>
          </section>
        )
      }
      if (variant === '3') {
        return (
          <section className="flex flex-col items-center gap-5 bg-slate-900 px-6 py-16 text-center md:py-24">
            <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-white md:text-5xl">
              {title}
            </h1>
            <p className="max-w-2xl text-base text-slate-300 md:text-xl">{subtitle}</p>
            {cta}
          </section>
        )
      }
      if (variant === '4') {
        return (
          <section className="px-6 py-16 md:py-24">
            <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-slate-200 p-10 text-center">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
              {cta}
            </div>
          </section>
        )
      }
      return (
        <section className={`flex flex-col ${alignFlex[align]} gap-5 px-6 py-16 md:py-24`}>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight max-w-3xl">{title}</h1>
          <p className="text-base md:text-xl text-slate-600 max-w-2xl">{subtitle}</p>
          {cta}
        </section>
      )
    },
  },
  Heading: {
    label: 'Heading',
    fields: {
      text: { type: 'text' },
      level: {
        type: 'select',
        options: [
          { label: 'H1', value: '1' },
          { label: 'H2', value: '2' },
          { label: 'H3', value: '3' },
        ],
      },
      align: {
        type: 'radio',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Center', value: 'center' },
          { label: 'Right', value: 'right' },
        ],
      },
    },
    defaultProps: { text: 'Section heading', level: '2', align: 'left' },
    render: ({ text, level, align }) => {
      const cls = `font-semibold tracking-tight px-6 ${
        align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
      } ${
        level === '1'
          ? 'text-3xl md:text-4xl'
          : level === '2'
            ? 'text-2xl md:text-3xl'
            : 'text-xl md:text-2xl'
      }`
      if (level === '1') return <h1 className={cls}>{text}</h1>
      if (level === '3') return <h3 className={cls}>{text}</h3>
      return <h2 className={cls}>{text}</h2>
    },
  },
  Text: {
    label: 'Text',
    fields: {
      variant: variantField(TEXT_VARIANT_LABELS, TextVariantThumb),
      text: { type: 'textarea' },
      align: {
        type: 'radio',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Center', value: 'center' },
          { label: 'Right', value: 'right' },
        ],
      },
      muted: {
        type: 'radio',
        options: [
          { label: 'Normal', value: false },
          { label: 'Muted', value: true },
        ],
      },
    },
    defaultProps: {
      variant: '1',
      text: 'Write something compelling here.',
      align: 'left',
      muted: false,
    },
    render: ({ variant, text, align, muted }) => {
      const alignCls =
        align === 'center'
          ? 'mx-auto text-center'
          : align === 'right'
            ? 'ml-auto text-right'
            : 'text-left'
      const colorCls = muted ? 'text-slate-500' : 'text-slate-800'

      if (variant === '2') {
        return (
          <blockquote
            className={`mx-6 max-w-3xl border-l-4 border-slate-300 py-1 pl-5 text-xl italic leading-relaxed ${alignCls} ${colorCls}`}
          >
            {text}
          </blockquote>
        )
      }
      if (variant === '3') {
        return (
          <div className="px-6">
            <p
              className={`mx-auto max-w-3xl rounded-xl border border-slate-200 bg-slate-50 p-6 leading-relaxed ${alignCls} ${colorCls}`}
            >
              {text}
            </p>
          </div>
        )
      }
      if (variant === '4') {
        return (
          <div
            className={`px-6 max-w-3xl ${align === 'center' ? 'mx-auto' : align === 'right' ? 'ml-auto' : ''}`}
          >
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              Overview
            </div>
            <p className={`leading-relaxed ${alignCls} ${colorCls}`}>{text}</p>
          </div>
        )
      }
      return <p className={`px-6 max-w-3xl leading-relaxed ${alignCls} ${colorCls}`}>{text}</p>
    },
  },
  Button: {
    label: 'Button',
    fields: {
      label: { type: 'text' },
      href: { type: 'text' },
      variant: {
        type: 'radio',
        options: [
          { label: 'Primary', value: 'primary' },
          { label: 'Secondary', value: 'secondary' },
        ],
      },
    },
    defaultProps: { label: 'Click me', href: '#', variant: 'primary' },
    render: ({ label, href, variant }) => (
      <div className="px-6">
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
      </div>
    ),
  },
  Image: {
    label: 'Image',
    fields: {
      src: { type: 'text' },
      alt: { type: 'text' },
      rounded: {
        type: 'radio',
        options: [
          { label: 'Square', value: false },
          { label: 'Rounded', value: true },
        ],
      },
    },
    defaultProps: {
      src: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=1200&h=600&fit=crop&auto=format',
      alt: '',
      rounded: true,
    },
    render: ({ src, alt, rounded }) => (
      <div className="px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className={`w-full h-auto object-cover ${rounded ? 'rounded-xl' : ''}`}
        />
      </div>
    ),
  },
  Spacer: {
    label: 'Spacer',
    fields: {
      size: {
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
          { label: 'XL', value: 'xl' },
        ],
      },
    },
    defaultProps: { size: 'md' },
    render: ({ size }) => <div className={spaceClass[size]} />,
  },
  Columns: {
    label: 'Columns',
    fields: {
      gap: {
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
      left: { type: 'slot' },
      right: { type: 'slot' },
    },
    defaultProps: { gap: 'md', left: [], right: [] },
    render: ({ gap, left: Left, right: Right }) => (
      <div className={`grid grid-cols-1 md:grid-cols-2 ${gapClass[gap]} px-6`}>
        <div>
          <Left />
        </div>
        <div>
          <Right />
        </div>
      </div>
    ),
  },
  Section: {
    label: 'Section',
    fields: {
      background: {
        type: 'select',
        options: [
          { label: 'None', value: 'none' },
          { label: 'Muted', value: 'muted' },
          { label: 'Accent', value: 'accent' },
        ],
      },
      padding: {
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
      content: { type: 'slot' },
    },
    defaultProps: { background: 'none', padding: 'md', content: [] },
    render: ({ background, padding, content: Content }) => (
      <section
        className={`${
          background === 'muted' ? 'bg-slate-50' : background === 'accent' ? 'bg-blue-50' : ''
        } ${padClass[padding]}`}
      >
        <div className="mx-auto max-w-5xl">
          <Content />
        </div>
      </section>
    ),
  },
  NavBar: {
    label: 'Nav Bar',
    fields: {
      variant: variantField(NAVBAR_VARIANT_LABELS, NavBarVariantThumb),
      brand: { type: 'text' },
      logoUrl: { type: 'text' },
      links: { type: 'textarea' },
      ctaLabel: { type: 'text' },
      ctaHref: { type: 'text' },
      primaryColor: { type: 'text' },
    },
    defaultProps: {
      variant: '1',
      brand: 'Your Brand',
      logoUrl: '',
      links: ['Home|#', 'About|#', 'Contact|#'].join('\n'),
      ctaLabel: 'Get Started',
      ctaHref: '#',
      primaryColor: '',
    },
    render: ({ variant, brand, logoUrl, links, ctaLabel, ctaHref, primaryColor }) => {
      const rows = parsePipeLines(links, 2)
      const logo = logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={brand} className="h-8 w-8 rounded object-contain" />
      ) : null
      const cta = ctaLabel ? (
        <a
          href={ctaHref}
          style={primaryColor ? { backgroundColor: primaryColor } : undefined}
          className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition"
        >
          {ctaLabel}
        </a>
      ) : null

      if (variant === '2') {
        return (
          <header className="flex flex-col items-center gap-3 border-b border-slate-200 px-6 py-4">
            <span className="flex items-center gap-2 text-lg font-bold text-slate-900">
              {logo}
              {brand}
            </span>
            <nav className="flex flex-wrap items-center justify-center gap-6">
              {rows.map(([label, href], i) => (
                <a
                  key={i}
                  href={href}
                  className="text-sm font-medium text-slate-700 hover:text-blue-600"
                >
                  {label}
                </a>
              ))}
              {cta}
            </nav>
          </header>
        )
      }
      if (variant === '3') {
        return (
          <header className="flex items-center justify-between gap-6 bg-slate-900 px-6 py-4">
            <span className="flex items-center gap-2 text-lg font-bold text-white">
              {logo}
              {brand}
            </span>
            <nav className="hidden md:flex items-center gap-6">
              {rows.map(([label, href], i) => (
                <a
                  key={i}
                  href={href}
                  className="text-sm font-medium text-slate-300 hover:text-white"
                >
                  {label}
                </a>
              ))}
            </nav>
            {cta}
          </header>
        )
      }
      if (variant === '4') {
        return (
          <header className="flex items-center justify-between gap-6 border-b border-slate-200 px-6 py-4">
            <span className="flex items-center gap-2 text-lg font-bold text-slate-900">
              {logo}
              {brand}
            </span>
            {cta}
          </header>
        )
      }
      return (
        <header className="flex items-center justify-between gap-6 border-b border-slate-200 px-6 py-4">
          <span className="flex items-center gap-2 text-lg font-bold text-slate-900">
            {logo}
            {brand}
          </span>
          <nav className="hidden md:flex items-center gap-6">
            {rows.map(([label, href], i) => (
              <a
                key={i}
                href={href}
                className="text-sm font-medium text-slate-700 hover:text-blue-600"
              >
                {label}
              </a>
            ))}
          </nav>
          {cta}
        </header>
      )
    },
  },
  StatsStrip: {
    label: 'Stats Strip',
    fields: { stats: { type: 'textarea' } },
    defaultProps: {
      stats: [
        '25+|Years of experience',
        '15K+|Happy customers',
        '50+|Team members',
        '30+|Projects delivered',
      ].join('\n'),
    },
    render: ({ stats }) => {
      const rows = parsePipeLines(stats, 2)
      return (
        <div className="grid grid-cols-2 gap-6 px-6 py-12 md:grid-cols-4">
          {rows.map(([value, label], i) => (
            <div key={i} className="text-center">
              <div className="text-3xl font-bold text-slate-900">{value}</div>
              <div className="mt-1 text-sm text-slate-500">{label}</div>
            </div>
          ))}
        </div>
      )
    },
  },
  FeatureCards: {
    label: 'Feature Cards',
    fields: {
      variant: variantField(FEATURE_CARDS_VARIANT_LABELS, FeatureCardsVariantThumb),
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      cards: { type: 'textarea' },
    },
    defaultProps: {
      variant: '1',
      sectionTitle: 'What we offer',
      sectionSubtitle: 'Everything you need, built for reliability and speed.',
      cards: [
        '⚡ | Fast | Ships responsive pages to every device in minutes.',
        '🔧 | Flexible | Compose pages from reusable, editable blocks.',
        '🔒 | Reliable | Built on infrastructure that scales with you.',
      ].join('\n'),
    },
    render: ({ variant, sectionTitle, sectionSubtitle, cards }) => {
      const rows = parsePipeLines(cards, 3)
      const header = (
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">{sectionTitle}</h2>
          {sectionSubtitle ? (
            <p className="mx-auto mt-3 max-w-2xl text-slate-500">{sectionSubtitle}</p>
          ) : null}
        </div>
      )

      if (variant === '2') {
        return (
          <section className="px-6 py-12 md:py-20">
            <div className="mx-auto max-w-3xl">
              {header}
              <div className="flex flex-col divide-y divide-slate-200">
                {rows.map(([icon, title, desc], i) => (
                  <div key={i} className="flex items-start gap-4 py-5">
                    <span className="text-2xl">{icon}</span>
                    <div>
                      <h3 className="font-semibold text-slate-900">{title}</h3>
                      <p className="text-sm text-slate-500">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )
      }
      if (variant === '3') {
        return (
          <section className="bg-slate-900 px-6 py-12 md:py-20">
            <div className="mx-auto max-w-5xl">
              <div className="mb-10 text-center">
                <h2 className="text-2xl font-bold text-white md:text-3xl">{sectionTitle}</h2>
                {sectionSubtitle ? (
                  <p className="mx-auto mt-3 max-w-2xl text-slate-300">{sectionSubtitle}</p>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
                {rows.map(([icon, title, desc], i) => (
                  <div key={i} className="flex flex-col gap-2 rounded-xl bg-white/5 p-6">
                    <span className="text-3xl">{icon}</span>
                    <h3 className="font-semibold text-white">{title}</h3>
                    <p className="text-sm text-slate-300">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )
      }
      if (variant === '4') {
        return (
          <section className="px-6 py-12 md:py-20">
            <div className="mx-auto max-w-5xl">
              {header}
              <div className="flex flex-col items-center gap-8 sm:flex-row sm:justify-center">
                {rows.map(([icon, title, desc], i) => (
                  <div
                    key={i}
                    className="flex max-w-[220px] flex-col items-center gap-2 text-center"
                  >
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-2xl">
                      {icon}
                    </span>
                    <h3 className="font-semibold text-slate-900">{title}</h3>
                    <p className="text-sm text-slate-500">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )
      }
      return (
        <section className="px-6 py-12 md:py-20">
          <div className="mx-auto max-w-5xl">
            {header}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
              {rows.map(([icon, title, desc], i) => (
                <div
                  key={i}
                  className="flex flex-col gap-2 rounded-xl border border-slate-200 p-6 transition hover:shadow-md"
                >
                  <span className="text-3xl">{icon}</span>
                  <h3 className="font-semibold text-slate-900">{title}</h3>
                  <p className="text-sm text-slate-500">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },
  Footer: {
    label: 'Footer',
    fields: {
      variant: variantField(FOOTER_VARIANT_LABELS, FooterVariantThumb),
      brand: { type: 'text' },
      logoUrl: { type: 'text' },
      tagline: { type: 'text' },
      links: { type: 'textarea' },
      copyright: { type: 'text' },
    },
    defaultProps: {
      variant: '1',
      brand: 'Your Brand',
      logoUrl: '',
      tagline: 'Building something great.',
      links: ['Home|#', 'About|#', 'Contact|#'].join('\n'),
      copyright: `© ${new Date().getFullYear()} Your Brand. All rights reserved.`,
    },
    render: ({ variant, brand, logoUrl, tagline, links, copyright }) => {
      const rows = parsePipeLines(links, 2)
      // Logo image already carries the brand name/mark — show the text
      // name only as a fallback when there's no logo, not alongside it.
      const brandMark = logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={brand} className="h-7 w-7 rounded object-contain" />
      ) : (
        <span>{brand}</span>
      )

      if (variant === '2') {
        return (
          <footer className="bg-slate-900 px-4 py-10 text-center text-slate-300 md:px-8">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 text-lg font-bold text-white">
                {brandMark}
              </div>
              <p className="text-sm text-slate-400">{tagline}</p>
              <nav className="flex gap-6">
                {rows.map(([label, href], i) => (
                  <a key={i} href={href} className="text-sm hover:text-white">
                    {label}
                  </a>
                ))}
              </nav>
              <div className="mt-4 w-full border-t border-slate-800 pt-6 text-xs text-slate-500">
                {copyright}
              </div>
            </div>
          </footer>
        )
      }
      if (variant === '3') {
        return (
          <footer className="border-t border-slate-200 bg-slate-50 px-4 py-10 text-slate-600 md:px-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 text-lg font-bold text-slate-900">
                  {brandMark}
                </div>
                <p className="mt-1 text-sm text-slate-500">{tagline}</p>
              </div>
              <nav className="flex gap-6">
                {rows.map(([label, href], i) => (
                  <a key={i} href={href} className="text-sm hover:text-slate-900">
                    {label}
                  </a>
                ))}
              </nav>
            </div>
            <div className="mt-8 border-t border-slate-200 pt-6 text-xs text-slate-400">
              {copyright}
            </div>
          </footer>
        )
      }
      if (variant === '4') {
        return (
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-6 text-sm text-slate-500 md:px-8">
            <span className="flex items-center gap-2 font-semibold text-slate-900">
              {brandMark}
            </span>
            <span>{copyright}</span>
          </footer>
        )
      }
      return (
        <footer className="bg-slate-900 px-4 py-10 text-slate-300 md:px-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-lg font-bold text-white">
                {brandMark}
              </div>
              <p className="mt-1 text-sm text-slate-400">{tagline}</p>
            </div>
            <nav className="flex gap-6">
              {rows.map(([label, href], i) => (
                <a key={i} href={href} className="text-sm hover:text-white">
                  {label}
                </a>
              ))}
            </nav>
          </div>
          <div className="mt-8 border-t border-slate-800 pt-6 text-xs text-slate-500">
            {copyright}
          </div>
        </footer>
      )
    },
  },
  TaglineStrip: {
    label: 'Tagline Strip',
    fields: {
      variant: variantField(TAGLINE_STRIP_VARIANT_LABELS, TaglineStripVariantThumb),
      logoUrl: imageField('Logo'),
      brand: { type: 'text' },
      headline: { type: 'textarea' },
      highlightPhrase: { type: 'text' },
      subtext: { type: 'text' },
      primaryColor: { type: 'text' },
      accentColor: { type: 'text' },
      ctaLabel: { type: 'text' },
      ctaHref: { type: 'text' },
    },
    defaultProps: {
      variant: '1',
      logoUrl: '/seed/subhadra/brand/logo.png',
      brand: 'Subhadra Group',
      headline: 'Your one-stop solution for building engineering products & services.',
      highlightPhrase: 'one-stop solution',
      subtext: 'Design · Installation · Service · Maintenance',
      primaryColor: '#ff4d1c',
      accentColor: '#ff9a3c',
      ctaLabel: '',
      ctaHref: '#',
    },
    render: ({
      id,
      puck,
      variant,
      logoUrl,
      brand,
      headline,
      highlightPhrase,
      subtext,
      primaryColor,
      accentColor,
      ctaLabel,
      ctaHref,
    }) => {
      const isEditing = puck?.isEditing ?? false
      if (variant === '2') {
        const parts = highlightPhrase ? headline.split(highlightPhrase) : [headline]
        return (
          <section className="bg-[#eef1f6] px-6 py-14 text-center md:py-16">
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={brand} className="mx-auto mb-6 h-9 w-auto" />
            )}
            <h2 className="mx-auto max-w-3xl text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
              {isEditing ? (
                <InlineEditableText
                  id={id}
                  path={['headline']}
                  value={headline ?? ''}
                  isEditing={isEditing}
                  multiline
                />
              ) : parts.length > 1 ? (
                <>
                  {parts[0]}
                  <span
                    className="bg-clip-text text-transparent"
                    style={{
                      backgroundImage: `linear-gradient(90deg, ${primaryColor}, ${accentColor})`,
                    }}
                  >
                    {highlightPhrase}
                  </span>
                  {parts[1]}
                </>
              ) : (
                headline
              )}
            </h2>
          </section>
        )
      }
      if (variant === '3') {
        return (
          <section className="border-y border-slate-200 bg-white px-6 py-8 text-center">
            {brand && (
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                {brand}
              </p>
            )}
            <p className="mt-1 text-sm font-semibold text-slate-900 md:text-base">{headline}</p>
            <span
              className="mx-auto mt-3 block h-[3px] w-9 rounded-full"
              style={{ backgroundColor: primaryColor }}
            />
            {subtext && (
              <p className="mt-3 text-[11px] uppercase tracking-[0.15em] text-slate-500">
                {subtext}
              </p>
            )}
          </section>
        )
      }
      if (variant === '4') {
        return (
          <section className="bg-slate-50 px-6 py-10 md:py-14">
            <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
              {brand && (
                <span
                  className="text-xs font-semibold uppercase tracking-[0.2em]"
                  style={{ color: primaryColor }}
                >
                  {brand}
                </span>
              )}
              <p className="text-base font-bold text-slate-900 md:text-lg">{headline}</p>
              {subtext && <p className="text-xs text-slate-500">{subtext}</p>}
              {ctaLabel && (
                <a
                  href={ctaHref}
                  style={{ backgroundColor: primaryColor }}
                  className="mt-2 inline-flex rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  {ctaLabel}
                </a>
              )}
            </div>
          </section>
        )
      }
      return (
        <section
          className="px-6 py-14 text-center text-white md:py-16"
          style={{ background: `linear-gradient(90deg, ${primaryColor}, ${accentColor})` }}
        >
          {(isEditing || brand) && (
            <span className="text-xs font-semibold uppercase tracking-[0.25em] opacity-90 md:text-sm">
              —{' '}
              <InlineEditableText
                id={id}
                path={['brand']}
                value={brand ?? ''}
                isEditing={isEditing}
              />{' '}
              —
            </span>
          )}
          <h2 className="mx-auto mt-3 max-w-3xl text-xl font-extrabold tracking-tight md:text-3xl">
            <InlineEditableText
              id={id}
              path={['headline']}
              value={headline ?? ''}
              isEditing={isEditing}
              multiline
            />
          </h2>
          {(isEditing || subtext) && (
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] opacity-90 md:text-xs">
              <InlineEditableText
                id={id}
                path={['subtext']}
                value={subtext ?? ''}
                isEditing={isEditing}
              />
            </p>
          )}
        </section>
      )
    },
  },
}

export const general: ComponentPack = {
  key: 'general',
  label: 'General',
  components: typedComponents as NonNullable<Config['components']>,
  categories: typedCategories,
  // Hero/NavBar/FeatureCards/Footer each have 4 real render branches (see
  // their `variant` field above) but were never registered here — the
  // Insert-a-block modal's per-variant card grid reads this map directly
  // (blockVariants[componentKey]), so without an entry here it silently
  // fell back to a single, variant-less card despite 4 designs existing.
  variants: {
    Hero: ['1', '2', '3', '4'],
    NavBar: ['1', '2', '3', '4'],
    FeatureCards: ['1', '2', '3', '4'],
    Footer: ['1', '2', '3', '4'],
    TaglineStrip: ['1', '2', '3', '4'],
  },
}
