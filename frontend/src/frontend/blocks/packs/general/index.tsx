import { useEffect, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Config, CustomField } from '@puckeditor/core'
import type { ComponentPack } from '../types'
import { variantField } from '../variant-field'
import { imageField } from '../image-field'
import { InlineEditableText } from '../inline-editable-text'
import { NavLinks, flatten, useNavItems } from './nav-items'
import { ContactFormBlock } from './contact-form'

type Align = 'left' | 'center' | 'right'

// CMS content shown as cards. `endpoint` is the module's public list route; `map` turns one
// row into a card. Add a kind here to show another module's content.
type ContentKind = 'team' | 'testimonials' | 'catalog' | 'work' | 'sectors' | 'cases'
type Card = { title: string; subtitle?: string; text?: string; image?: string }
const CONTENT_KINDS: Record<
  ContentKind,
  { label: string; endpoint: string; map: (r: Record<string, string | null>) => Card }
> = {
  team: {
    label: 'Team',
    endpoint: '/api/team/public',
    map: (r) => ({
      title: r.name ?? '',
      subtitle: r.role ?? '',
      text: r.bio ?? '',
      image: r.photo_url ?? '',
    }),
  },
  testimonials: {
    label: 'Testimonials',
    endpoint: '/api/testimonials/public',
    map: (r) => ({ title: r.name ?? '', subtitle: r.role ?? '', text: r.quote ?? '' }),
  },
  catalog: {
    label: 'Products and services',
    endpoint: '/api/catalog/public',
    map: (r) => ({
      title: r.name ?? '',
      subtitle: r.category ?? '',
      text: r.description ?? '',
      image: r.image ?? '',
    }),
  },
  work: {
    label: 'Our work',
    endpoint: '/api/work/public',
    map: (r) => ({
      title: r.name ?? '',
      subtitle: r.eyebrow ?? '',
      text: r.subtitle ?? '',
      image: r.image ?? '',
    }),
  },
  sectors: {
    label: 'Sectors',
    endpoint: '/api/sectors/public',
    map: (r) => ({
      title: r.name ?? '',
      subtitle: r.category ?? '',
      text: r.description ?? '',
      image: r.image ?? '',
    }),
  },
  cases: {
    label: 'Case studies',
    endpoint: '/api/projects-content/public',
    map: (r) => ({
      title: r.title ?? '',
      subtitle: r.eyebrow ?? '',
      text: r.description ?? '',
      image: r.image ?? '',
    }),
  },
}

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
    menuLink?: string
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
    menuLink?: string
    brand: string
    logoUrl: string
    tagline: string
    links: string
    copyright: string
  }
  FaqList: { sectionTitle: string; source: 'module' | 'block'; items: string }
  ContactForm: { formSlug: string; anchor: string; title: string }
  GalleryGrid: {
    sectionTitle: string
    source: 'module' | 'block'
    columns: '2' | '3' | '4'
    images: string
  }
  ContentGrid: {
    kind: ContentKind
    sectionTitle: string
    source: 'module' | 'block'
    columns: '2' | '3' | '4'
    items: string
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
  content: {
    title: 'Content (CMS)',
    components: ['FaqList', 'ContactForm', 'GalleryGrid', 'ContentGrid'],
  },
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
    <div className={`h-16 w-full overflow-hidden rounded-md border border-divider ${className}`}>
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
      <SketchBox className="flex gap-1 bg-surface p-2">
        <div className="flex flex-1 flex-col justify-center gap-1">
          <div className="h-1.5 w-3/4 rounded bg-faint/70" />
          <div className="h-1.5 w-2/3 rounded bg-faint/50" />
          <div className="mt-1 h-2 w-8 rounded bg-primary" />
        </div>
        <div className="flex-1 rounded bg-border" />
      </SketchBox>
    )
  if (variant === '3')
    return (
      <SketchBox className="flex flex-col items-center justify-center gap-1 bg-inverse p-2">
        <div className="h-1.5 w-2/3 rounded bg-inverse-foreground/80" />
        <div className="h-1.5 w-1/2 rounded bg-inverse-foreground/60" />
        <div className="mt-1 h-2 w-8 rounded bg-inverse-foreground" />
      </SketchBox>
    )
  if (variant === '4')
    return (
      <SketchBox className="flex items-center justify-center bg-surface p-2">
        <div className="flex w-3/4 flex-col items-center gap-1 rounded-md border border-border p-2">
          <div className="h-1.5 w-2/3 rounded bg-faint/70" />
          <div className="h-2 w-8 rounded bg-primary" />
        </div>
      </SketchBox>
    )
  return (
    <SketchBox className="flex flex-col items-center justify-center gap-1 bg-background p-2">
      <div className="h-1.5 w-2/3 rounded bg-faint/70" />
      <div className="h-1.5 w-1/2 rounded bg-faint/50" />
      <div className="mt-1 h-2 w-8 rounded bg-primary" />
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
      <SketchBox className="flex items-center bg-background p-2">
        <div className="mr-2 h-full w-1 rounded bg-faint" />
        <div className="space-y-1">
          <div className="h-1.5 w-24 rounded bg-faint/70" />
          <div className="h-1.5 w-16 rounded bg-faint/50" />
        </div>
      </SketchBox>
    )
  if (variant === '3')
    return (
      <SketchBox className="flex items-center justify-center bg-surface p-2">
        <div className="h-full w-full space-y-1 rounded-md border border-border bg-background p-2">
          <div className="h-1.5 w-3/4 rounded bg-faint/70" />
          <div className="h-1.5 w-1/2 rounded bg-faint/50" />
        </div>
      </SketchBox>
    )
  if (variant === '4')
    return (
      <SketchBox className="flex flex-col justify-center gap-1.5 bg-surface p-2">
        <div className="h-1 w-10 rounded bg-border" />
        <div className="h-1.5 w-3/4 rounded bg-faint/70" />
        <div className="h-1.5 w-1/2 rounded bg-faint/50" />
      </SketchBox>
    )
  return (
    <SketchBox className="flex flex-col justify-center gap-1.5 bg-surface p-2">
      <div className="h-1.5 w-3/4 rounded bg-faint/70" />
      <div className="h-1.5 w-2/3 rounded bg-faint/50" />
      <div className="h-1.5 w-1/2 rounded bg-faint/50" />
    </SketchBox>
  )
}

// "Edit this menu" shortcut shown in the editor panel of NavBar/Footer. The value is unused.
function menuLinkField(key: 'header' | 'footer'): CustomField<string | undefined> {
  return {
    type: 'custom',
    label: key === 'header' ? 'Header menu' : 'Footer menu',
    render: () => (
      <a
        href={`/admin/menus?key=${key}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex rounded-md border border-border px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10"
      >
        Edit {key} menu (Navigation) →
      </a>
    ),
  }
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
      <SketchBox className="flex flex-col items-center justify-center gap-1 bg-surface p-2">
        <div className="h-1.5 w-16 rounded bg-body" />
        <div className="flex gap-1.5">
          <div className="h-1 w-6 rounded bg-faint/60" />
          <div className="h-1 w-6 rounded bg-faint/60" />
          <div className="h-1 w-6 rounded bg-faint/60" />
        </div>
      </SketchBox>
    )
  if (variant === '3')
    return (
      <SketchBox className="flex items-center justify-between bg-inverse p-2">
        <div className="h-1.5 w-10 rounded bg-inverse-foreground/80" />
        <div className="flex gap-1.5">
          <div className="h-1 w-5 rounded bg-inverse-foreground/50" />
          <div className="h-1 w-5 rounded bg-inverse-foreground/50" />
        </div>
        <div className="h-2.5 w-8 rounded bg-inverse-foreground" />
      </SketchBox>
    )
  if (variant === '4')
    return (
      <SketchBox className="flex items-center justify-between bg-surface p-2">
        <div className="h-1.5 w-10 rounded bg-body" />
        <div className="h-2.5 w-10 rounded bg-inverse" />
      </SketchBox>
    )
  return (
    <SketchBox className="flex items-center justify-between bg-surface p-2">
      <div className="h-1.5 w-10 rounded bg-body" />
      <div className="flex gap-1.5">
        <div className="h-1 w-5 rounded bg-faint/60" />
        <div className="h-1 w-5 rounded bg-faint/60" />
        <div className="h-1 w-5 rounded bg-faint/60" />
      </div>
      <div className="h-2.5 w-8 rounded bg-primary" />
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
      <SketchBox className="flex flex-col items-center justify-center gap-1 bg-surface p-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-1.5 w-2/3 rounded bg-faint/60" />
        ))}
      </SketchBox>
    )
  if (variant === '3')
    return (
      <SketchBox className="grid grid-cols-3 gap-1 bg-inverse p-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded bg-inverse-foreground/15" />
        ))}
      </SketchBox>
    )
  if (variant === '4')
    return (
      <SketchBox className="flex items-center justify-around bg-surface p-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-6 w-6 rounded-full bg-border" />
        ))}
      </SketchBox>
    )
  return (
    <SketchBox className="grid grid-cols-3 gap-1 bg-surface p-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded border border-divider bg-background" />
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
        className={`flex flex-col items-center justify-center gap-1 p-2 ${dark ? 'bg-inverse' : 'bg-surface'}`}
      >
        <div className="h-1.5 w-16 rounded bg-inverse-foreground/80" />
        <div className="flex gap-1.5">
          <div className="h-1 w-5 rounded bg-inverse-foreground/40" />
          <div className="h-1 w-5 rounded bg-inverse-foreground/40" />
        </div>
      </SketchBox>
    )
  if (variant === '3')
    return (
      <SketchBox className="flex items-center justify-between bg-background p-2">
        <div className="h-1.5 w-16 rounded bg-body" />
        <div className="flex gap-1.5">
          <div className="h-1 w-5 rounded bg-faint/60" />
          <div className="h-1 w-5 rounded bg-faint/60" />
        </div>
      </SketchBox>
    )
  if (variant === '4')
    return (
      <SketchBox className="flex items-center justify-center bg-surface p-2">
        <div className="h-1 w-24 rounded bg-border" />
      </SketchBox>
    )
  return (
    <SketchBox
      className={`flex items-center justify-between p-2 ${dark ? 'bg-inverse' : 'bg-surface'}`}
    >
      <div className="h-1.5 w-14 rounded bg-inverse-foreground/80" />
      <div className="flex gap-1.5">
        <div className="h-1 w-5 rounded bg-inverse-foreground/40" />
        <div className="h-1 w-5 rounded bg-inverse-foreground/40" />
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
      <SketchBox className="flex items-center justify-center gap-1.5 bg-inverse p-2">
        <div className="h-3 w-3 flex-none rounded-full bg-highlight" />
        <div className="h-1.5 w-16 rounded bg-inverse-foreground/70" />
      </SketchBox>
    )
  if (variant === '3')
    return (
      <SketchBox className="flex flex-col items-center justify-center gap-1.5 border border-divider bg-surface p-2">
        <div className="h-1.5 w-20 rounded bg-body" />
        <div className="h-0.5 w-4 rounded bg-highlight" />
      </SketchBox>
    )
  if (variant === '4')
    return (
      <SketchBox className="flex items-center justify-center bg-background p-2">
        <div className="flex h-10 w-24 flex-col items-center justify-center gap-1 rounded-md border border-divider bg-card shadow-sm">
          <div className="h-1 w-14 rounded bg-body" />
          <div className="h-1.5 w-8 rounded bg-highlight" />
        </div>
      </SketchBox>
    )
  return (
    <SketchBox className="flex flex-col items-center justify-center gap-1 bg-gradient-to-r from-highlight to-highlight/70 p-2">
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
          className="mt-2 inline-flex rounded-lg bg-primary px-6 py-3 text-primary-foreground font-medium hover:bg-primary/85 transition"
        >
          {ctaLabel}
        </a>
      ) : null

      if (variant === '2') {
        return (
          <section className="grid grid-cols-1 items-center gap-10 px-6 py-16 md:grid-cols-2 md:py-24">
            <div className={`flex flex-col ${alignFlex[align]} gap-5`}>
              <h1 className="max-w-xl text-3xl font-bold tracking-tight text-title md:text-5xl">
                {title}
              </h1>
              <p className="max-w-lg text-base text-body md:text-xl">{subtitle}</p>
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
          <section className="flex flex-col items-center gap-5 bg-inverse px-6 py-16 text-center md:py-24">
            <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-inverse-foreground md:text-5xl">
              {title}
            </h1>
            <p className="max-w-2xl text-base text-inverse-foreground/70 md:text-xl">{subtitle}</p>
            {cta}
          </section>
        )
      }
      if (variant === '4') {
        return (
          <section className="px-6 py-16 md:py-24">
            <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-divider p-10 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-title md:text-3xl">{title}</h1>
              {cta}
            </div>
          </section>
        )
      }
      return (
        <section className={`flex flex-col ${alignFlex[align]} gap-5 px-6 py-16 md:py-24`}>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-title max-w-3xl">
            {title}
          </h1>
          <p className="text-base md:text-xl text-body max-w-2xl">{subtitle}</p>
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
      const cls = `font-semibold tracking-tight text-title px-6 ${
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
      const colorCls = muted ? 'text-muted-foreground' : 'text-body'

      if (variant === '2') {
        return (
          <blockquote
            className={`mx-6 max-w-3xl border-l-4 border-border py-1 pl-5 text-xl italic leading-relaxed ${alignCls} ${colorCls}`}
          >
            {text}
          </blockquote>
        )
      }
      if (variant === '3') {
        return (
          <div className="px-6">
            <p
              className={`mx-auto max-w-3xl rounded-xl border border-divider bg-background p-6 leading-relaxed ${alignCls} ${colorCls}`}
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
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-faint">
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
              ? 'bg-primary text-primary-foreground hover:bg-primary/85'
              : 'border border-border text-title hover:bg-foreground/5'
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
          background === 'muted' ? 'bg-background' : background === 'accent' ? 'bg-primary/10' : ''
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
      menuLink: menuLinkField('header'),
      links: { type: 'textarea', label: 'Fallback links (used only if the menu is empty)' },
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
    render: function NavBarRender({
      variant,
      brand,
      logoUrl,
      links,
      ctaLabel,
      ctaHref,
      primaryColor,
      puck,
    }) {
      const items = useNavItems('header', links, puck?.metadata?.projectId as string | undefined)
      const logo = logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={brand} className="h-8 w-8 rounded object-contain" />
      ) : null
      const cta = ctaLabel ? (
        <a
          href={ctaHref}
          style={primaryColor ? { backgroundColor: primaryColor } : undefined}
          className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
        >
          {ctaLabel}
        </a>
      ) : null

      if (variant === '2') {
        return (
          <header className="flex flex-col items-center gap-3 border-b border-divider px-6 py-4">
            <span className="flex items-center gap-2 text-lg font-bold text-title">
              {logo}
              {brand}
            </span>
            <nav className="flex flex-wrap items-center justify-center gap-6">
              <NavLinks
                items={items}
                linkClass="text-sm font-medium text-body hover:text-primary"
              />
              {cta}
            </nav>
          </header>
        )
      }
      if (variant === '3') {
        return (
          <header className="flex items-center justify-between gap-6 bg-inverse px-6 py-4">
            <span className="flex items-center gap-2 text-lg font-bold text-inverse-foreground">
              {logo}
              {brand}
            </span>
            <nav className="hidden md:flex items-center gap-6">
              <NavLinks
                items={items}
                linkClass="text-sm font-medium text-inverse-foreground/70 hover:text-inverse-foreground"
                panelClass="bg-inverse text-inverse-foreground border border-inverse-foreground/15"
              />
            </nav>
            {cta}
          </header>
        )
      }
      if (variant === '4') {
        return (
          <header className="flex items-center justify-between gap-6 border-b border-divider px-6 py-4">
            <span className="flex items-center gap-2 text-lg font-bold text-title">
              {logo}
              {brand}
            </span>
            {cta}
          </header>
        )
      }
      return (
        <header className="flex items-center justify-between gap-6 border-b border-divider px-6 py-4">
          <span className="flex items-center gap-2 text-lg font-bold text-title">
            {logo}
            {brand}
          </span>
          <nav className="hidden md:flex items-center gap-6">
            <NavLinks items={items} linkClass="text-sm font-medium text-body hover:text-primary" />
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
              <div className="text-3xl font-bold text-title">{value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{label}</div>
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
          <h2 className="text-2xl font-bold text-title md:text-3xl">{sectionTitle}</h2>
          {sectionSubtitle ? (
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">{sectionSubtitle}</p>
          ) : null}
        </div>
      )

      if (variant === '2') {
        return (
          <section className="px-6 py-12 md:py-20">
            <div className="mx-auto max-w-3xl">
              {header}
              <div className="flex flex-col divide-y divide-divider">
                {rows.map(([icon, title, desc], i) => (
                  <div key={i} className="flex items-start gap-4 py-5">
                    <span className="text-2xl">{icon}</span>
                    <div>
                      <h3 className="font-semibold text-title">{title}</h3>
                      <p className="text-sm text-muted-foreground">{desc}</p>
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
          <section className="bg-inverse px-6 py-12 md:py-20">
            <div className="mx-auto max-w-5xl">
              <div className="mb-10 text-center">
                <h2 className="text-2xl font-bold text-inverse-foreground md:text-3xl">
                  {sectionTitle}
                </h2>
                {sectionSubtitle ? (
                  <p className="mx-auto mt-3 max-w-2xl text-inverse-foreground/70">
                    {sectionSubtitle}
                  </p>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
                {rows.map(([icon, title, desc], i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-2 rounded-xl bg-inverse-foreground/10 p-6"
                  >
                    <span className="text-3xl">{icon}</span>
                    <h3 className="font-semibold text-inverse-foreground">{title}</h3>
                    <p className="text-sm text-inverse-foreground/70">{desc}</p>
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
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-background text-2xl">
                      {icon}
                    </span>
                    <h3 className="font-semibold text-title">{title}</h3>
                    <p className="text-sm text-muted-foreground">{desc}</p>
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
                  className="flex flex-col gap-2 rounded-xl border border-divider p-6 transition hover:shadow-md"
                >
                  <span className="text-3xl">{icon}</span>
                  <h3 className="font-semibold text-title">{title}</h3>
                  <p className="text-sm text-muted-foreground">{desc}</p>
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
      menuLink: menuLinkField('footer'),
      links: { type: 'textarea', label: 'Fallback links (used only if the menu is empty)' },
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
    render: function FooterRender({ variant, brand, logoUrl, tagline, links, copyright, puck }) {
      const items = flatten(
        useNavItems('footer', links, puck?.metadata?.projectId as string | undefined)
      )
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
          <footer className="bg-inverse px-4 py-10 text-center text-inverse-foreground/70 md:px-8">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 text-lg font-bold text-inverse-foreground">
                {brandMark}
              </div>
              <p className="text-sm text-inverse-foreground/60">{tagline}</p>
              <nav className="flex flex-wrap gap-x-6 gap-y-2">
                {items.map((l, i) => (
                  <a key={i} href={l.href} className="text-sm hover:text-inverse-foreground">
                    {l.label}
                  </a>
                ))}
              </nav>
              <div className="mt-4 w-full border-t border-inverse-foreground/15 pt-6 text-xs text-inverse-foreground/50">
                {copyright}
              </div>
            </div>
          </footer>
        )
      }
      if (variant === '3') {
        return (
          <footer className="border-t border-divider bg-background px-4 py-10 text-body md:px-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 text-lg font-bold text-title">
                  {brandMark}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{tagline}</p>
              </div>
              <nav className="flex flex-wrap gap-x-6 gap-y-2">
                {items.map((l, i) => (
                  <a key={i} href={l.href} className="text-sm hover:text-title">
                    {l.label}
                  </a>
                ))}
              </nav>
            </div>
            <div className="mt-8 border-t border-divider pt-6 text-xs text-faint">{copyright}</div>
          </footer>
        )
      }
      if (variant === '4') {
        return (
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-4 py-6 text-sm text-muted-foreground md:px-8">
            <span className="flex items-center gap-2 font-semibold text-title">{brandMark}</span>
            <span>{copyright}</span>
          </footer>
        )
      }
      return (
        <footer className="bg-inverse px-4 py-10 text-inverse-foreground/70 md:px-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-lg font-bold text-inverse-foreground">
                {brandMark}
              </div>
              <p className="mt-1 text-sm text-inverse-foreground/60">{tagline}</p>
            </div>
            <nav className="flex flex-wrap gap-x-6 gap-y-2">
              {items.map((l, i) => (
                <a key={i} href={l.href} className="text-sm hover:text-inverse-foreground">
                  {l.label}
                </a>
              ))}
            </nav>
          </div>
          <div className="mt-8 border-t border-inverse-foreground/15 pt-6 text-xs text-inverse-foreground/50">
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
      logoUrl: '/seed/demologo/logo.svg',
      brand: 'DemoLogo',
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
          <section className="bg-background px-6 py-14 text-center md:py-16">
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={brand} className="mx-auto mb-6 h-9 w-auto" />
            )}
            <h2 className="mx-auto max-w-3xl text-2xl font-extrabold tracking-tight text-title md:text-3xl">
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
          <section className="border-y border-divider bg-surface px-6 py-8 text-center">
            {brand && (
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-faint">
                {brand}
              </p>
            )}
            <p className="mt-1 text-sm font-semibold text-title md:text-base">{headline}</p>
            <span
              className="mx-auto mt-3 block h-[3px] w-9 rounded-full"
              style={{ backgroundColor: primaryColor }}
            />
            {subtext && (
              <p className="mt-3 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                {subtext}
              </p>
            )}
          </section>
        )
      }
      if (variant === '4') {
        return (
          <section className="bg-background px-6 py-10 md:py-14">
            <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-divider bg-card p-8 text-center shadow-lg">
              {brand && (
                <span
                  className="text-xs font-semibold uppercase tracking-[0.2em]"
                  style={{ color: primaryColor }}
                >
                  {brand}
                </span>
              )}
              <p className="text-base font-bold text-title md:text-lg">{headline}</p>
              {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
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

  // Reads the FAQ module (Admin > FAQ) for this project; `items` ("Question|Answer" per line) is
  // the fallback while the module is off or empty, or when source = 'block'.
  FaqList: {
    label: 'FAQ list (CMS)',
    fields: {
      sectionTitle: { type: 'text' },
      source: {
        type: 'radio',
        options: [
          { label: 'FAQ module', value: 'module' },
          { label: 'This block', value: 'block' },
        ],
      },
      items: { type: 'textarea' },
    },
    defaultProps: {
      sectionTitle: '',
      source: 'module',
      items: 'What is this?|Replace this with your own question and answer.',
    },
    render: function FaqListRender({ sectionTitle, source, items, puck }) {
      const projectId = puck?.metadata?.projectId as string | undefined
      const { data: dbFaqs } = useQuery({
        queryKey: ['faq-entries-public', projectId],
        queryFn: () =>
          fetch(`/api/faq/public?project_id=${projectId}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((json) => (json?.data?.items ?? []) as { question: string; answer: string }[]),
        enabled: Boolean(projectId) && source !== 'block',
      })
      const own = (items ?? '')
        .split('\n')
        .map((line) => {
          const [q, ...a] = line.split('|')
          return { question: (q ?? '').trim(), answer: a.join('|').trim() }
        })
        .filter((f) => f.question)
      const list = source !== 'block' && dbFaqs && dbFaqs.length > 0 ? dbFaqs : own
      return (
        <section className="mx-auto max-w-3xl px-6 py-12">
          {sectionTitle && (
            <h2 className="mb-6 text-center text-3xl font-bold text-title">{sectionTitle}</h2>
          )}
          <div className="divide-y divide-divider rounded-xl border border-divider bg-card">
            {list.map((f, i) => (
              <details key={i} className="group px-5 py-4">
                <summary className="cursor-pointer list-none text-lg font-semibold text-title">
                  {f.question}
                </summary>
                <p className="mt-2 text-body">{f.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )
    },
  },
  // Shows a form from the Forms module (Admin > Forms) by its slug. A button elsewhere on the page
  // can point at `#<anchor>` to scroll here.
  ContactForm: {
    label: 'Contact form',
    fields: { formSlug: { type: 'text' }, anchor: { type: 'text' }, title: { type: 'text' } },
    defaultProps: { formSlug: 'contact', anchor: 'contact', title: 'Get in touch' },
    render: function ContactFormRender({ formSlug, anchor, title, puck }) {
      return (
        <ContactFormBlock
          formSlug={formSlug}
          anchor={anchor}
          title={title}
          readOnly={Boolean(puck?.isEditing)}
        />
      )
    },
  },
  // Reads the Gallery module (Admin > Gallery); `images` ("url|caption" per line) is the fallback.
  GalleryGrid: {
    label: 'Gallery (CMS)',
    fields: {
      sectionTitle: { type: 'text' },
      source: {
        type: 'radio',
        options: [
          { label: 'Gallery module', value: 'module' },
          { label: 'This block', value: 'block' },
        ],
      },
      columns: {
        type: 'radio',
        options: [
          { label: '2', value: '2' },
          { label: '3', value: '3' },
          { label: '4', value: '4' },
        ],
      },
      images: { type: 'textarea' },
    },
    defaultProps: { sectionTitle: '', source: 'module', columns: '3', images: '' },
    render: function GalleryGridRender({ sectionTitle, source, columns, images, puck }) {
      const projectId = puck?.metadata?.projectId as string | undefined
      const [open, setOpen] = useState<number | null>(null)
      const { data: dbItems } = useQuery({
        queryKey: ['gallery-items-public', projectId],
        queryFn: () =>
          fetch(`/api/gallery/public?project_id=${projectId}`)
            .then((r) => (r.ok ? r.json() : null))
            .then(
              (json) =>
                (json?.data?.items ?? []) as {
                  title: string
                  image_url: string
                  caption?: string
                }[]
            ),
        enabled: Boolean(projectId) && source !== 'block',
      })
      const own = (images ?? '')
        .split('\n')
        .map((line) => {
          const [url, ...c] = line.split('|')
          return {
            title: c.join('|').trim(),
            image_url: (url ?? '').trim(),
            caption: c.join('|').trim(),
          }
        })
        .filter((g) => g.image_url)
      const list = source !== 'block' && dbItems && dbItems.length > 0 ? dbItems : own
      useEffect(() => {
        if (open === null) return
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null)
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [open])
      const cols = {
        '2': 'sm:grid-cols-2',
        '3': 'sm:grid-cols-2 lg:grid-cols-3',
        '4': 'sm:grid-cols-2 lg:grid-cols-4',
      }[columns ?? '3']
      return (
        <section className="mx-auto max-w-6xl px-6 py-12">
          {sectionTitle && (
            <h2 className="mb-6 text-center text-3xl font-bold text-title">{sectionTitle}</h2>
          )}
          <div className={`grid grid-cols-1 gap-4 ${cols}`}>
            {list.map((g, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setOpen(i)}
                className="group overflow-hidden rounded-xl border border-divider bg-card text-left"
                aria-label={`Open ${g.title}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.image_url}
                  alt={g.title}
                  className="aspect-[4/3] w-full object-cover transition group-hover:scale-105"
                />
                {g.caption && <p className="px-4 py-3 text-sm text-body">{g.caption}</p>}
              </button>
            ))}
          </div>
          {open !== null && list[open] && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label={list[open].title}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
              onClick={() => setOpen(null)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={list[open].image_url}
                alt={list[open].title}
                className="max-h-full max-w-full rounded-lg"
              />
              <button
                type="button"
                aria-label="Close"
                className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-black"
                onClick={() => setOpen(null)}
              >
                ✕
              </button>
            </div>
          )}
        </section>
      )
    },
  },

  // One block for every CMS list: pick the kind; it reads that module for this project.
  // `items` ("Title|Subtitle|Text|ImageUrl" per line) is the fallback / "This block" content.
  ContentGrid: {
    label: 'CMS content grid',
    fields: {
      kind: {
        type: 'select',
        options: (Object.keys(CONTENT_KINDS) as ContentKind[]).map((k) => ({
          label: CONTENT_KINDS[k].label,
          value: k,
        })),
      },
      sectionTitle: { type: 'text' },
      source: {
        type: 'radio',
        options: [
          { label: 'CMS module', value: 'module' },
          { label: 'This block', value: 'block' },
        ],
      },
      columns: {
        type: 'radio',
        options: [
          { label: '2', value: '2' },
          { label: '3', value: '3' },
          { label: '4', value: '4' },
        ],
      },
      items: { type: 'textarea' },
    },
    defaultProps: { kind: 'team', sectionTitle: '', source: 'module', columns: '3', items: '' },
    render: function ContentGridRender({ kind, sectionTitle, source, columns, items, puck }) {
      const projectId = puck?.metadata?.projectId as string | undefined
      const def = CONTENT_KINDS[kind] ?? CONTENT_KINDS.team
      const { data: rows } = useQuery({
        queryKey: ['cms-content-public', kind, projectId],
        queryFn: () =>
          fetch(`${def.endpoint}?project_id=${projectId}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((json) => (json?.data?.items ?? []) as Record<string, string | null>[]),
        enabled: Boolean(projectId) && source !== 'block',
      })
      const own: Card[] = (items ?? '')
        .split('\n')
        .map((line) => {
          const [title, subtitle, text, image] = line.split('|').map((x) => x.trim())
          return { title: title ?? '', subtitle, text, image }
        })
        .filter((c) => c.title)
      const cards: Card[] = source !== 'block' && rows && rows.length > 0 ? rows.map(def.map) : own
      const cols = {
        '2': 'sm:grid-cols-2',
        '3': 'sm:grid-cols-2 lg:grid-cols-3',
        '4': 'sm:grid-cols-2 lg:grid-cols-4',
      }[columns ?? '3']
      const quote = kind === 'testimonials'
      return (
        <section className="mx-auto max-w-6xl px-6 py-12">
          {sectionTitle && (
            <h2 className="mb-6 text-center text-3xl font-bold text-title">{sectionTitle}</h2>
          )}
          <div className={`grid grid-cols-1 gap-6 ${cols}`}>
            {cards.map((c, i) => (
              <article key={i} className="overflow-hidden rounded-xl border border-divider bg-card">
                {c.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image} alt={c.title} className="aspect-[4/3] w-full object-cover" />
                )}
                <div className="p-5">
                  {quote && c.text && <p className="mb-3 italic text-body">“{c.text}”</p>}
                  <h3 className="text-lg font-semibold text-title">{c.title}</h3>
                  {c.subtitle && <p className="text-sm text-muted-foreground">{c.subtitle}</p>}
                  {!quote && c.text && <p className="mt-2 text-body">{c.text}</p>}
                </div>
              </article>
            ))}
          </div>
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
