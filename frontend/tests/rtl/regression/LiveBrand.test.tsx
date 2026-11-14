import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '../utils'
import { config } from '@/frontend/blocks/puck.config'
import { BRAND_LOGO_BLOCK_TYPES } from '@/frontend/lib/apply-identity'

const h = vi.hoisted(() => ({ identity: {} as Record<string, string> }))
vi.mock('@/lib/axios', () => ({
  default: { get: vi.fn(async () => ({ data: { data: { identity: h.identity } } })) },
}))

// A header, footer or tagline block shows the company name and logo from Application Identity wherever it is drawn
// (live site, editor canvas, previews). What is saved inside the page is only the fallback when Identity has nothing.
type Def = {
  defaultProps: Record<string, unknown>
  render: (p: Record<string, unknown>) => React.ReactElement
}
const def = (t: string) => config.components![t] as unknown as Def
const draw = (
  type: string,
  props: Record<string, unknown> = {},
  metaIdentity?: Record<string, string>
) =>
  render(
    def(type).render({
      ...def(type).defaultProps,
      ...props,
      puck: { isEditing: true, metadata: metaIdentity ? { identity: metaIdentity } : {} },
    })
  ).container

const logos = (c: HTMLElement) =>
  Array.from(c.querySelectorAll('img')).map((i) => i.getAttribute('src') ?? '')

beforeEach(() => {
  h.identity = {}
})

describe.each(['ConstructionHeader', 'ConstructionFooter', 'NavBar', 'Footer'])('%s', (type) => {
  it('shows the Identity logo and company name, ignoring the logo saved in the page', async () => {
    h.identity = { company_name: 'Acme Robotics', logo_light: '/identity/acme.png' }
    const c = draw(type, { logoUrl: '/seed/demologo/logo.svg', brand: 'DemoLogo' })
    await waitFor(() => expect(logos(c)).toContain('/identity/acme.png'))
    expect(logos(c)).not.toContain('/seed/demologo/logo.svg')
    // the name is the logo's alt text (or visible text when a block shows both)
    const named = `${c.textContent} ${Array.from(c.querySelectorAll('img'))
      .map((i) => i.alt)
      .join(' ')}`
    expect(named).toContain('Acme Robotics')
    expect(named).not.toContain('DemoLogo')
  })

  it('shows it even when the page saved no logo at all', async () => {
    h.identity = { logo_light: '/identity/acme.png' }
    const c = draw(type, { logoUrl: '' })
    await waitFor(() => expect(logos(c)).toContain('/identity/acme.png'))
  })

  it('company logo wins over the app logo', async () => {
    h.identity = { company_logo_light: '/identity/company.png', logo_light: '/identity/app.png' }
    const c = draw(type, { logoUrl: '' })
    await waitFor(() => expect(logos(c)).toContain('/identity/company.png'))
    expect(logos(c)).not.toContain('/identity/app.png')
  })

  it("keeps the page's own logo when Identity has none", async () => {
    h.identity = { app_name: '' }
    const c = draw(type, { logoUrl: '/page/own.png' })
    await new Promise((r) => setTimeout(r, 50))
    expect(logos(c)).toContain('/page/own.png')
  })

  it("a landing page's own Branding wins over the project's Identity", async () => {
    h.identity = { logo_light: '/identity/project.png' }
    const c = draw(type, { logoUrl: '' }, { logo_light: '/identity/landing.png' })
    await waitFor(() => expect(logos(c)).toContain('/identity/landing.png'))
    expect(logos(c)).not.toContain('/identity/project.png')
  })
})

describe('which blocks are brand-logo blocks', () => {
  it('every one is registered, and carries the logo and brand props', () => {
    for (const type of BRAND_LOGO_BLOCK_TYPES) {
      if (!config.components![type]) continue // a pack that is not installed
      expect(def(type).defaultProps, type).toHaveProperty('logoUrl')
      expect(def(type).defaultProps, type).toHaveProperty('brand')
    }
  })

  it('a block that is not a brand-logo block is left alone', async () => {
    h.identity = { logo_light: '/identity/acme.png' }
    const c = draw('ConstructionHero', {})
    await new Promise((r) => setTimeout(r, 50))
    expect(logos(c)).not.toContain('/identity/acme.png')
  })

  it('the backend seeds the same list the frontend overlays (they must not drift apart)', () => {
    const file = fs.readFileSync(
      path.join(
        process.cwd(),
        '../backend/src/modules/template-engine/drivers/website-seed-content.js'
      ),
      'utf8'
    )
    const block = /const BRAND_LOGO_BLOCK_TYPES = new Set\(\[([\s\S]*?)\]\)/.exec(file)?.[1] ?? ''
    const backend = [...block.matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]).sort()
    expect(backend.length).toBeGreaterThan(3)
    expect([...BRAND_LOGO_BLOCK_TYPES].sort()).toEqual(backend)
  })
})
