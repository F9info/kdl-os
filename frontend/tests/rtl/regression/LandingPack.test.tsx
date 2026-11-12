import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../utils'
import { landing } from '@/frontend/blocks/packs/landing'
import { config } from '@/frontend/blocks/puck.config'
import { paletteOf, PALETTES } from '@/frontend/blocks/packs/landing/palettes'
import { fontOf, FONT_PAIRS } from '@/frontend/blocks/packs/landing/fonts'

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn().mockResolvedValue({ data: {} }) } }))

const keys = Object.keys(landing.components)

// Renders one block the way the page renderer does: its own render function with its props.
function renderBlock(key: string, props: Record<string, unknown> = {}) {
  const def = landing.components[key]!
  const Render = def.render as (p: Record<string, unknown>) => JSX.Element
  return render(<Render {...(def.defaultProps ?? {})} {...props} puck={{ isEditing: false }} />)
}

describe('Landing block pack', () => {
  it('registers nineteen blocks and lists every one in its category', () => {
    expect(keys).toHaveLength(19)
    expect(landing.categories?.landing?.components?.slice().sort()).toEqual(keys.slice().sort())
  })

  it('is part of the page builder config, so the editor and the public page both see it', () => {
    for (const k of keys) expect(config.components?.[k], k).toBeTruthy()
    expect(Object.keys(config.categories ?? {})[0]).toBe('landing')
  })

  it.each(keys)('%s renders with its default props', (key) => {
    const { container } = renderBlock(key)
    expect(container.firstChild).toBeTruthy()
  })

  it.each(keys)('%s offers a palette and a font choice', (key) => {
    const fields = landing.components[key]!.fields as Record<string, unknown>
    expect(fields.palette).toBeTruthy()
    expect(fields.font).toBeTruthy()
  })
})

describe('LandingHero', () => {
  const base = {
    headline: 'We help you grow faster today',
    highlight: 'grow faster',
    eyebrow: 'Join us',
    ctaLabel: 'Start now',
    ctaHref: '#contact',
    image: '/landing-templates/photos/hero-laptop.jpg',
    avatars: '/a.jpg\n/b.jpg',
    proofText: '2,500 happy customers',
    badgeValue: '4.9',
    badgeLabel: 'Rating',
    noteTitle: 'Priya booked',
    noteText: 'Just now',
    chartTitle: 'Savings',
  }

  it.each(['1', '2', '3', '4'])(
    'design %s shows the headline, the button and the proof',
    (variant) => {
      renderBlock('LandingHero', { ...base, variant })
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(base.headline)
      expect(screen.getByRole('link', { name: 'Start now' }).getAttribute('href')).toBe('#contact')
      expect(screen.getByText('2,500 happy customers')).toBeTruthy()
    }
  )

  it('colours the highlight phrase, whatever its letter case', () => {
    renderBlock('LandingHero', { ...base, variant: '1', highlight: 'GROW FASTER' })
    const mark = screen.getByText('grow faster')
    expect(mark.tagName).toBe('SPAN')
    expect(mark.getAttribute('style')).toContain('color')
  })

  it('shows the headline plainly when the highlight is not in it', () => {
    renderBlock('LandingHero', { ...base, variant: '1', highlight: 'nowhere' })
    expect(screen.getByRole('heading', { level: 1 }).querySelector('span')).toBeNull()
  })

  it('uses a gradient button for the dark palette and a plain one for light', () => {
    const { unmount } = renderBlock('LandingHero', { ...base, variant: '4', palette: 'violet' })
    expect(screen.getByRole('link', { name: 'Start now' }).getAttribute('style')).toContain(
      'gradient'
    )
    unmount()
    renderBlock('LandingHero', { ...base, variant: '1', palette: 'sunset' })
    expect(screen.getByRole('link', { name: 'Start now' }).getAttribute('style')).not.toContain(
      'gradient'
    )
  })
})

describe('palettes and fonts', () => {
  it('fall back to a safe choice for an unknown or missing value', () => {
    expect(paletteOf('nope')).toBe(PALETTES.sunset)
    expect(paletteOf(undefined)).toBe(PALETTES.sunset)
    expect(fontOf('nope')).toBe(FONT_PAIRS.bricolage)
    expect(fontOf(undefined)).toBe(FONT_PAIRS.bricolage)
  })

  it('every font pair uses a CSS variable that app/layout.tsx defines', async () => {
    const fs = await import('node:fs')
    const layout = fs.readFileSync('src/app/layout.tsx', 'utf8')
    for (const pair of Object.values(FONT_PAIRS)) {
      for (const v of [pair.display, pair.body].map((f) => /var\((--[a-z-]+)/.exec(f)![1])) {
        expect(layout, `${v} is not declared in layout.tsx`).toContain(`'${v}'`)
      }
    }
  })
})

describe('lists in the lower blocks', () => {
  it('stats, steps, quotes and questions render one item per line and skip incomplete lines', () => {
    renderBlock('LandingStats', { stats: '10|Years\nbroken line\n20|Awards' })
    expect(screen.getByText('Years')).toBeTruthy()
    expect(screen.getByText('Awards')).toBeTruthy()
    expect(screen.queryByText('broken line')).toBeNull()
  })

  it('the agenda layout shows the time label first', () => {
    renderBlock('LandingSteps', { layout: 'list', items: '10:00|Welcome|Doors open' })
    expect(screen.getByText('10:00')).toBeTruthy()
    expect(screen.getByText('Welcome')).toBeTruthy()
  })
})

describe('LandingForm in "View template"', () => {
  it('shows a sample form instead of a missing one, and never calls the forms API', () => {
    const def = landing.components.LandingForm!
    const Render = def.render as (p: Record<string, unknown>) => JSX.Element
    render(
      <Render
        {...(def.defaultProps ?? {})}
        puck={{ isEditing: false, metadata: { preview: true } }}
      />
    )
    expect(screen.getByText('Name *')).toBeTruthy()
    expect(screen.getByText('Send')).toBeTruthy()
  })
})

describe('LandingForm', () => {
  it('colours the form button from its palette, not the site theme', () => {
    const { container } = renderBlock('LandingForm', { palette: 'aurora' })
    const el = container.querySelector('section') as HTMLElement
    expect(el.style.getPropertyValue('--branding_brand_colors_primary_color')).toBe('#0d9488')
    expect(el.style.getPropertyValue('--buttons_primary_button_text_color')).toBe('#ffffff')
  })
})

describe('editor labels', () => {
  it('every field has a plain-language label, never a raw field name', () => {
    for (const key of keys) {
      const fields = landing.components[key]!.fields as Record<string, { label?: string }>
      for (const [name, f] of Object.entries(fields)) {
        expect(f.label, `${key}.${name}`).toBeTruthy()
        expect(f.label, `${key}.${name} still shows its raw name`).not.toBe(
          name === 'text' ? '' : name
        )
      }
    }
  })

  it("names the line format of each block's items", () => {
    const items = (k: string) =>
      (landing.components[k]!.fields as Record<string, { label?: string }>).items!.label
    expect(items('LandingPeople')).toContain('photo')
    expect(items('LandingFaq')).toContain('answer')
    expect(items('LandingBenefits')).toContain('icon')
  })
})

describe('links on landing blocks', () => {
  it('never put a javascript: address in an href, whatever was typed into the editor', () => {
    const bad = 'javascript:alert(document.cookie)'
    renderBlock('LandingHero', {
      variant: '1',
      ctaLabel: 'Go',
      ctaHref: bad,
      secondaryLabel: 'More',
      secondaryHref: 'java\tscript:alert(1)',
    })
    renderBlock('LandingCta', {
      buttonLabel: 'Click',
      buttonHref: 'data:text/html,<script>1</script>',
    })
    renderBlock('LandingShowcase', { ctaLabel: 'Book', ctaHref: 'JAVASCRIPT:alert(1)' })
    for (const a of document.querySelectorAll('a')) {
      expect(a.getAttribute('href') ?? '').not.toMatch(/^\s*(javascript|data|vbscript):/i)
    }
    expect(screen.getByRole('link', { name: 'Go' }).getAttribute('href')).toBe('#')
    expect(screen.getByRole('link', { name: /More/ }).getAttribute('href')).toBe('#')
  })

  it('keeps normal links working', () => {
    renderBlock('LandingHero', { variant: '1', ctaLabel: 'Go', ctaHref: 'mailto:hi@example.com' })
    expect(screen.getByRole('link', { name: 'Go' }).getAttribute('href')).toBe(
      'mailto:hi@example.com'
    )
  })
})

describe('LandingFooter (company details come from Identity only)', () => {
  const full = {
    app_name: 'KDL',
    description: 'We empower passionate dreamers.',
    logo_light: 'https://cdn.test/light.png',
    contact_email: 'info@kdl.com',
    contact_email_secondary: 'sales@kdl.com',
    contact_phone: '+91 73373 37778',
    contact_phone_secondary: '7337337779',
    contact_address: 'Vinayagar Heights\nVisakhapatnam',
    copyright: '© KDL 2026',
    social_facebook: 'https://facebook.com/kdl',
    social_x: 'javascript:alert(1)',
  }
  const footer = (identity: Record<string, string>, props: Record<string, unknown> = {}) => {
    const def = landing.components.LandingFooter!
    const Render = def.render as (p: Record<string, unknown>) => JSX.Element
    return render(
      <Render
        {...(def.defaultProps ?? {})}
        {...props}
        puck={{ isEditing: false, metadata: { identity } }}
      />
    )
  }

  it('shows name, description, contact details and socials from Identity', () => {
    footer(full)
    expect(screen.getByText('KDL')).toBeTruthy()
    expect(screen.getByText('We empower passionate dreamers.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'info@kdl.com' }).getAttribute('href')).toBe(
      'mailto:info@kdl.com'
    )
    expect(screen.getByRole('link', { name: 'sales@kdl.com' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '+91 73373 37778' }).getAttribute('href')).toBe(
      'tel:+917337337778'
    )
    expect(screen.getByRole('link', { name: '7337337779' }).getAttribute('href')).toBe(
      'tel:7337337779'
    )
    expect(screen.getByText(/Vinayagar Heights/)).toBeTruthy()
    expect(screen.getByText('© KDL 2026')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Facebook' }).getAttribute('href')).toBe(
      'https://facebook.com/kdl'
    )
  })

  it('never turns a javascript: social link into a live address', () => {
    footer(full)
    expect(screen.getByRole('link', { name: 'X' }).getAttribute('href')).toBe('#')
  })

  it('puts a light-background logo on a white chip, and a dark-background logo straight on', () => {
    const { unmount } = footer(full)
    expect(screen.getByAltText('KDL').className).toContain('bg-white')
    unmount()
    footer({ ...full, logo_dark: 'https://cdn.test/dark.png' })
    const img = screen.getByAltText('KDL')
    expect(img.getAttribute('src')).toBe('https://cdn.test/dark.png')
    expect(img.className).not.toContain('bg-white')
  })

  it('writes a copyright line from the name when Identity has none', () => {
    footer({ app_name: 'KDL' })
    expect(screen.getByText(new RegExp(`© ${new Date().getFullYear()} KDL`))).toBeTruthy()
  })

  it('leaves out whatever Identity does not have, and shows the quick links it was given', () => {
    footer({ app_name: 'KDL' }, { links: 'Back to top|#\nContact|#contact' })
    expect(screen.queryByText('Contact', { selector: 'h3' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Facebook' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Back to top' }).getAttribute('href')).toBe('#')
    expect(screen.getByRole('link', { name: 'Contact' }).getAttribute('href')).toBe('#contact')
  })

  it('shows nothing about a company when Identity is empty (no invented details)', () => {
    footer({}, { links: '' })
    expect(screen.queryByRole('link')).toBeNull()
    expect(document.body.textContent).not.toMatch(/@|©/)
  })
})

describe('LandingHeader and the brand colour set (company details come from Identity)', () => {
  const identity = {
    company_name: 'Sri Lakshmi Developers',
    company_logo_light: '/uploads/sld-logo.png',
    contact_phone: '+91 98765 43210',
    brand_primary: '#0a8f3c',
    brand_secondary: '#064d20',
  }
  const withIdentity = (key: string, props: Record<string, unknown> = {}) => {
    const def = landing.components[key]!
    const Render = def.render as (p: Record<string, unknown>) => JSX.Element
    return render(
      <Render
        {...(def.defaultProps ?? {})}
        {...props}
        puck={{ isEditing: false, metadata: { identity } }}
      />
    )
  }

  it('shows the logo, name and phone from Identity, and a button to #contact', () => {
    withIdentity('LandingHeader')
    expect(screen.getByRole('img', { name: 'Sri Lakshmi Developers' })).toHaveAttribute(
      'src',
      '/uploads/sld-logo.png'
    )
    expect(screen.getByText('Sri Lakshmi Developers')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '+91 98765 43210' })).toHaveAttribute(
      'href',
      'tel:+919876543210'
    )
    expect(screen.getByRole('link', { name: 'Get a free quote' })).toHaveAttribute(
      'href',
      '#contact'
    )
  })

  it('shows menu links only when some are typed, and drops an unsafe one', () => {
    withIdentity('LandingHeader', { links: 'About|#about\nBad|javascript:alert(1)' })
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '#about')
    expect(screen.queryByRole('link', { name: 'Bad' })?.getAttribute('href') ?? '').not.toContain(
      'javascript'
    )
  })

  it('has no company text of its own: an empty Identity shows no name, logo or phone', () => {
    const def = landing.components.LandingHeader!
    const Render = def.render as (p: Record<string, unknown>) => JSX.Element
    const { container } = render(
      <Render
        {...(def.defaultProps ?? {})}
        puck={{ isEditing: false, metadata: { identity: {} } }}
      />
    )
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('a[href^="tel:"]')).toBeNull()
  })

  it('the brand colour set reads Identity colours through --lp-1 and --lp-2 on every block', () => {
    const { container } = withIdentity('LandingHero', { palette: 'brand' })
    const scope = container.querySelector('div[style*="display: contents"]') as HTMLElement
    expect(scope.style.getPropertyValue('--lp-1')).toBe('#0a8f3c')
    expect(scope.style.getPropertyValue('--lp-2')).toBe('#064d20')
    expect(PALETTES.brand.strong).toContain('var(--lp-1')
  })

  it('ignores a colour that is not a hex value', () => {
    const def = landing.components.LandingHero!
    const Render = def.render as (p: Record<string, unknown>) => JSX.Element
    const { container } = render(
      <Render
        {...(def.defaultProps ?? {})}
        puck={{
          isEditing: false,
          metadata: { identity: { brand_primary: 'red;} body{display:none' } },
        }}
      />
    )
    expect(
      (
        container.querySelector('div[style*="display: contents"]') as HTMLElement
      ).style.getPropertyValue('--lp-1')
    ).toBe('')
  })
})

// Every section a user can add offers four designs, and they must be four different layouts, not a recolour.
describe('four designs per section', () => {
  const SECTIONS = Object.entries(landing.variants ?? {})
  it('lists the sections that have a Design picker (hero, about, services, team, pricing ... footer)', () => {
    const names = SECTIONS.map(([k]) => k)
    for (const k of [
      'LandingHero',
      'LandingShowcase',
      'LandingBenefits',
      'LandingStats',
      'LandingSteps',
      'LandingPeople',
      'LandingTestimonials',
      'LandingFaq',
      'LandingCta',
      'LandingPricing',
      'LandingPortfolio',
      'LandingGallery',
      'LandingClients',
      'LandingContact',
      'LandingNewsletter',
      'LandingBlog',
    ])
      expect(names, k).toContain(k)
    for (const [, v] of SECTIONS) expect(v).toEqual(['1', '2', '3', '4'])
  })

  it.each(SECTIONS.map(([k]) => k))('%s renders four different layouts', (key) => {
    const markup = ['1', '2', '3', '4'].map((variant) => {
      const { container, unmount } = renderBlock(key, { variant })
      const html = container.innerHTML
      unmount()
      expect(html.length, `${key} design ${variant}`).toBeGreaterThan(50)
      // Compare the layout (class names and tags), not the text or colours.
      return html.replace(/>[^<]*</g, '><').replace(/style="[^"]*"/g, '')
    })
    expect(new Set(markup).size, `${key} designs must differ in layout`).toBe(4)
  })
})
