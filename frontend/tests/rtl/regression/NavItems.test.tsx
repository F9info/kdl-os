import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import { general } from '@/app/admin/page-builder/packs/general'
import { NavLinks, MAX_VISIBLE, flatten } from '@/app/admin/page-builder/packs/general/nav-items'

const comp = general.components as any
const NavBar = comp.NavBar.render
const Footer = comp.Footer.render
const puck = { metadata: { projectId: 'p1' } }
const item = (label: string, children: unknown[] = [], extra = {}) => ({
  id: label,
  label,
  url: `/p/${label.toLowerCase()}`,
  open_in_new_tab: false,
  children,
  ...extra,
})
const menuReply = (items: unknown[]) =>
  vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { menu: { items } } }) })

beforeEach(() => vi.restoreAllMocks())
afterEach(() => vi.unstubAllGlobals())

const fallback = 'Home|/p/home\nAbout|/p/about'
const base = { variant: '1', brand: 'B', logoUrl: '', ctaLabel: '', ctaHref: '#', primaryColor: '' }

describe('NavLinks', () => {
  const many = Array.from({ length: 10 }, (_, i) => ({
    label: `Page${i + 1}`,
    href: `/p/${i + 1}`,
    children: [],
  }))

  it(`shows ${MAX_VISIBLE} links and puts the rest under "More"`, () => {
    render(<NavLinks items={many} linkClass="x" />)
    expect(screen.getByText('Page7')).toBeTruthy()
    const more = document.querySelector('[data-nav-more="true"]')!
    expect(more.textContent).toContain('More')
    expect(more.textContent).toContain('Page8')
    expect(more.textContent).toContain('Page10')
    // the 8th+ are only inside the dropdown, not top-level links
    expect(document.querySelectorAll('nav a, a').length).toBe(10)
  })

  it('does not add "More" at the limit', () => {
    render(<NavLinks items={many.slice(0, MAX_VISIBLE)} linkClass="x" />)
    expect(document.querySelector('[data-nav-more]')).toBeNull()
  })

  it('renders sub-items in a dropdown', () => {
    render(
      <NavLinks
        items={[
          {
            label: 'About',
            href: '/p/about',
            children: [{ label: 'Team', href: '/p/team', children: [] }],
          },
        ]}
        linkClass="x"
      />
    )
    expect(screen.getByText('Team').closest('a')?.getAttribute('href')).toBe('/p/team')
  })

  it('flatten() lists every linkable item once (footer)', () => {
    const tree = [
      { label: 'A', href: '/a', children: [{ label: 'B', href: '/b', children: [] }] },
      { label: 'Group', href: '', children: [{ label: 'C', href: '/c', children: [] }] },
    ]
    expect(flatten(tree).map((i) => i.label)).toEqual(['A', 'B', 'C'])
  })
})

describe('NavBar / Footer read the Menus module', () => {
  it('NavBar shows the menu items (not its own text) once the menu has items', async () => {
    const f = menuReply([item('Home'), item('Gallery')])
    vi.stubGlobal('fetch', f)
    render(<NavBar {...base} links={fallback} puck={puck} />)
    expect(await screen.findByText('Gallery')).toBeTruthy()
    expect(screen.queryByText('About')).toBeNull()
    expect(f).toHaveBeenCalledWith('/api/menus/public?key=header&project_id=p1')
  })

  it('NavBar falls back to its own lines while the menu is empty', async () => {
    vi.stubGlobal('fetch', menuReply([]))
    render(<NavBar {...base} links={fallback} puck={puck} />)
    await waitFor(() => expect(screen.getByText('About')).toBeTruthy())
  })

  it('Footer reads the footer menu', async () => {
    const f = menuReply([item('Home'), item('Privacy')])
    vi.stubGlobal('fetch', f)
    render(
      <Footer
        variant="1"
        brand="B"
        logoUrl=""
        tagline="t"
        links={fallback}
        copyright="c"
        puck={puck}
      />
    )
    expect(await screen.findByText('Privacy')).toBeTruthy()
    expect(f).toHaveBeenCalledWith('/api/menus/public?key=footer&project_id=p1')
  })

  it('blocks javascript: links from the menu', async () => {
    vi.stubGlobal('fetch', menuReply([item('Bad', [], { url: 'javascript:alert(1)' })]))
    render(<NavBar {...base} links={fallback} puck={puck} />)
    expect((await screen.findByText('Bad')).closest('a')?.getAttribute('href')).toBe('#')
  })
})
