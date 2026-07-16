import type { Config, Data } from '@puckeditor/core'

/**
 * KDL Page Builder — responsive block library.
 *
 * Every block styles itself with Tailwind utility classes and mobile-first
 * breakpoints (md:) so a page authored once renders fluidly on phone, tablet
 * and desktop. Puck's built-in viewport switcher (see the editor page) lets
 * an admin preview each breakpoint without leaving the canvas.
 *
 * This file is the single source of truth for the builder: it is imported by
 * both the editor (`<Puck config={config} />`) and the public renderer
 * (`<Render config={config} />`), guaranteeing edit-time and runtime parity.
 */

type Align = 'left' | 'center' | 'right'

const alignFlex: Record<Align, string> = {
  left: 'text-left items-start',
  center: 'text-center items-center',
  right: 'text-right items-end',
}

export type Props = {
  Hero: { title: string; subtitle: string; ctaLabel: string; ctaHref: string; align: Align }
  Heading: { text: string; level: '1' | '2' | '3'; align: Align }
  Text: { text: string; align: Align; muted: boolean }
  Button: { label: string; href: string; variant: 'primary' | 'secondary' }
  Image: { src: string; alt: string; rounded: boolean }
  Spacer: { size: 'sm' | 'md' | 'lg' | 'xl' }
  Columns: { gap: 'sm' | 'md' | 'lg'; left: any; right: any }
  Section: { background: 'none' | 'muted' | 'accent'; padding: 'sm' | 'md' | 'lg'; content: any }
}

const gapClass = { sm: 'gap-3', md: 'gap-6', lg: 'gap-10' } as const
const padClass = { sm: 'py-6', md: 'py-12', lg: 'py-20' } as const
const spaceClass = { sm: 'h-4', md: 'h-8', lg: 'h-16', xl: 'h-28' } as const

export const config: Config<Props> = {
  root: {
    fields: { title: { type: 'text' } },
    defaultProps: { title: 'Untitled page' },
    render: ({ children }) => (
      <main className="min-h-screen bg-white text-slate-900">{children}</main>
    ),
  },
  categories: {
    layout: { title: 'Layout', components: ['Section', 'Columns', 'Spacer'] },
    content: { title: 'Content', components: ['Hero', 'Heading', 'Text', 'Button', 'Image'] },
  },
  components: {
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
            align === 'center' ? 'mx-auto text-center' : align === 'right' ? 'ml-auto text-right' : 'text-left'
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
          <img src={src} alt={alt} className={`w-full h-auto object-cover ${rounded ? 'rounded-xl' : ''}`} />
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
  },
}

export const emptyData: Data = { root: { props: { title: 'Untitled page' } }, content: [], zones: {} }

export default config
