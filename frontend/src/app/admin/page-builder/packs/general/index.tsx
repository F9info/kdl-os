import type { Config } from '@puckeditor/core'
import type { ComponentPack } from '../types'

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
  Hero: { title: string; subtitle: string; ctaLabel: string; ctaHref: string; align: Align }
  Heading: { text: string; level: '1' | '2' | '3'; align: Align }
  Text: { text: string; align: Align; muted: boolean }
  Button: { label: string; href: string; variant: 'primary' | 'secondary' }
  Image: { src: string; alt: string; rounded: boolean }
  Spacer: { size: 'sm' | 'md' | 'lg' | 'xl' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Columns: { gap: 'sm' | 'md' | 'lg'; left: any; right: any }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Section: { background: 'none' | 'muted' | 'accent'; padding: 'sm' | 'md' | 'lg'; content: any }
  NavBar: { brand: string; links: string; ctaLabel: string; ctaHref: string }
  StatsStrip: { stats: string }
  FeatureCards: { sectionTitle: string; sectionSubtitle: string; cards: string }
  Footer: { brand: string; tagline: string; links: string; copyright: string }
}

const typedCategories: NonNullable<Config<GeneralProps>['categories']> = {
  layout: { title: 'Layout', components: ['Section', 'Columns', 'Spacer', 'NavBar', 'Footer'] },
  content: {
    title: 'Content',
    components: ['Hero', 'Heading', 'Text', 'Button', 'Image', 'StatsStrip', 'FeatureCards'],
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

const typedComponents: Config<GeneralProps>['components'] = {
  Hero: {
    label: 'Hero',
    fields: {
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
    },
    defaultProps: {
      title: 'Build faster with KDL',
      subtitle: 'A flexible, modern page builder that ships responsive pages to every device.',
      ctaLabel: 'Get started',
      ctaHref: '#',
      align: 'center',
    },
    render: ({ title, subtitle, ctaLabel, ctaHref, align }) => (
      <section className={`flex flex-col ${alignFlex[align]} gap-5 px-6 py-16 md:py-24`}>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight max-w-3xl">{title}</h1>
        <p className="text-base md:text-xl text-slate-600 max-w-2xl">{subtitle}</p>
        {ctaLabel ? (
          <a
            href={ctaHref}
            className="mt-2 inline-flex rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition"
          >
            {ctaLabel}
          </a>
        ) : null}
      </section>
    ),
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
    defaultProps: { text: 'Write something compelling here.', align: 'left', muted: false },
    render: ({ text, align, muted }) => (
      <p
        className={`px-6 max-w-3xl leading-relaxed ${
          align === 'center'
            ? 'mx-auto text-center'
            : align === 'right'
              ? 'ml-auto text-right'
              : 'text-left'
        } ${muted ? 'text-slate-500' : 'text-slate-800'}`}
      >
        {text}
      </p>
    ),
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
    defaultProps: { src: 'https://placehold.co/1200x600', alt: '', rounded: true },
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
      brand: { type: 'text' },
      links: { type: 'textarea' },
      ctaLabel: { type: 'text' },
      ctaHref: { type: 'text' },
    },
    defaultProps: {
      brand: 'Your Brand',
      links: ['Home|#', 'About|#', 'Contact|#'].join('\n'),
      ctaLabel: 'Get Started',
      ctaHref: '#',
    },
    render: ({ brand, links, ctaLabel, ctaHref }) => {
      const rows = parsePipeLines(links, 2)
      return (
        <header className="flex items-center justify-between gap-6 border-b border-slate-200 px-6 py-4">
          <span className="text-lg font-bold text-slate-900">{brand}</span>
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
          {ctaLabel ? (
            <a
              href={ctaHref}
              className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              {ctaLabel}
            </a>
          ) : null}
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
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      cards: { type: 'textarea' },
    },
    defaultProps: {
      sectionTitle: 'What we offer',
      sectionSubtitle: 'Everything you need, built for reliability and speed.',
      cards: [
        '⚡ | Fast | Ships responsive pages to every device in minutes.',
        '🔧 | Flexible | Compose pages from reusable, editable blocks.',
        '🔒 | Reliable | Built on infrastructure that scales with you.',
      ].join('\n'),
    },
    render: ({ sectionTitle, sectionSubtitle, cards }) => {
      const rows = parsePipeLines(cards, 3)
      return (
        <section className="px-6 py-12 md:py-20">
          <div className="mx-auto max-w-5xl">
            <div className="mb-10 text-center">
              <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">{sectionTitle}</h2>
              {sectionSubtitle ? (
                <p className="mx-auto mt-3 max-w-2xl text-slate-500">{sectionSubtitle}</p>
              ) : null}
            </div>
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
      brand: { type: 'text' },
      tagline: { type: 'text' },
      links: { type: 'textarea' },
      copyright: { type: 'text' },
    },
    defaultProps: {
      brand: 'Your Brand',
      tagline: 'Building something great.',
      links: ['Home|#', 'About|#', 'Contact|#'].join('\n'),
      copyright: `© ${new Date().getFullYear()} Your Brand. All rights reserved.`,
    },
    render: ({ brand, tagline, links, copyright }) => {
      const rows = parsePipeLines(links, 2)
      return (
        <footer className="bg-slate-900 px-6 py-10 text-slate-300">
          <div className="mx-auto flex max-w-5xl flex-wrap items-start justify-between gap-6">
            <div>
              <div className="text-lg font-bold text-white">{brand}</div>
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
          <div className="mx-auto mt-8 max-w-5xl border-t border-slate-800 pt-6 text-xs text-slate-500">
            {copyright}
          </div>
        </footer>
      )
    },
  },
}

export const general: ComponentPack = {
  key: 'general',
  label: 'General',
  components: typedComponents as NonNullable<Config['components']>,
  categories: typedCategories,
}
