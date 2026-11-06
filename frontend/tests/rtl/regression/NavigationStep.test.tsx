import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '../utils'
import { NavigationStep } from '@/app/admin/template-engine/_components/stages/NavigationStep'

const h = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}))

vi.mock('@/lib/axios', () => ({
  default: { post: h.post, get: h.get, put: h.put, patch: h.patch, delete: h.del },
}))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn(), useToast: () => ({ toasts: [] }) }))
vi.mock('@/app/admin/page-builder/store', () => ({
  listPages: async () => [
    { id: 'pg-1', title: 'Sample Service 1', slug: 'sample-service-1', projectId: 'proj-1' },
    { id: 'pg-2', title: 'Contact Detail', slug: 'contact-detail', projectId: 'proj-1' },
  ],
}))

const item = (id: string, label: string, extra: object = {}) => ({
  id,
  label,
  url: `/p/${label.toLowerCase()}`,
  link_type: 'custom',
  page_id: null,
  parent_id: null,
  order: 0,
  is_active: true,
  open_in_new_tab: false,
  no_page: false,
  children: [],
  ...extra,
})
const menus: Record<string, { id: string; key: string; items: ReturnType<typeof item>[] }> = {
  header: { id: 'm-header', key: 'header', items: [item('a', 'About'), item('b', 'Blog')] },
  footer: { id: 'm-footer', key: 'footer', items: [item('f1', 'Privacy Policy')] },
}

const props = () => ({
  projectId: 'proj-1',
  runId: 'run-1',
  onBack: vi.fn(),
  onNext: vi.fn(),
  onLayouts: vi.fn(),
})

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  h.post.mockImplementation(async (url: string, body: { key: string }) => {
    if (url === '/menus/ensure')
      return {
        data: { data: { menu: { project_id: 'proj-1', name: body.key, ...menus[body.key]! } } },
      }
    return { data: { data: { item: { id: 'new' } } } }
  })
  h.get.mockImplementation(async (url: string) => {
    if (url === '/menus/options') return { data: { data: { footer_same_as_header: false } } }
    if (url === '/detail-page-types') return { data: { data: { items: [] } } }
    return { data: { data: {} } }
  })
  h.patch.mockResolvedValue({ data: {} })
  h.put.mockResolvedValue({ data: {} })
  h.del.mockResolvedValue({ data: {} })
})

const ensured = () => h.post.mock.calls.filter((c) => c[0] === '/menus/ensure').map((c) => c[1].key)

describe('Navigation: one editor for the Header and the Footer menu', () => {
  it('opens on the Header menu and offers a Footer tab', async () => {
    render(<NavigationStep {...props()} />)
    expect(await screen.findByText('About')).toBeTruthy()
    expect(screen.getByTestId('nav-tab-header')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('nav-tab-footer')).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByText('Website · Navigation')).toBeTruthy()
  })

  it('the Footer tab edits the footer menu: its own items, no scaffold page chips, and no mirror buttons', async () => {
    render(<NavigationStep {...props()} />)
    await screen.findByText('About')
    fireEvent.click(screen.getByTestId('nav-tab-footer'))
    expect(await screen.findByText('Privacy Policy')).toBeTruthy()
    expect(screen.queryByText('About')).toBeNull()
    expect(screen.getByText('Website · Footer navigation')).toBeTruthy()
    expect(ensured()).toContain('footer')
    // header-only tools are gone
    expect(screen.queryByText('Common pages — tap to add')).toBeNull()
    expect(screen.queryByPlaceholderText(/add a custom page/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /also show .* on footer/i })).toBeNull()
  })

  it('remembers the chosen menu, so old links like /admin/menus?key=footer can open the footer', async () => {
    window.localStorage.setItem('te-website-ui:proj-1:navMenu', JSON.stringify('footer'))
    render(<NavigationStep {...props()} />)
    expect(await screen.findByText('Privacy Policy')).toBeTruthy()
    expect(screen.getByTestId('nav-tab-footer')).toHaveAttribute('aria-selected', 'true')
  })

  it('editing the footer never overwrites the list of pages the site is built from (header only)', async () => {
    render(<NavigationStep {...props()} />)
    await screen.findByText('About')
    await waitFor(() =>
      expect(
        JSON.parse(window.localStorage.getItem('te-website-ui:proj-1:navigation') ?? '[]')
      ).toEqual(['About', 'Blog'])
    )
    fireEvent.click(screen.getByTestId('nav-tab-footer'))
    await screen.findByText('Privacy Policy')
    await new Promise((r) => setTimeout(r, 30))
    expect(
      JSON.parse(window.localStorage.getItem('te-website-ui:proj-1:navigation') ?? '[]')
    ).toEqual(['About', 'Blog'])
  })

  it('"Use the same links as the header menu" is a Footer option that is saved', async () => {
    render(<NavigationStep {...props()} />)
    await screen.findByText('About')
    expect(screen.queryByTestId('footer-same-as-header')).toBeNull() // header tab: not shown
    fireEvent.click(screen.getByTestId('nav-tab-footer'))
    const toggle = await screen.findByTestId('footer-same-as-header')
    await waitFor(() => expect(toggle).toBeEnabled())
    fireEvent.click(toggle)
    await waitFor(() =>
      expect(h.put).toHaveBeenCalledWith('/menus/options', { footer_same_as_header: true })
    )
  })
})

describe('Navigation: what only the old page could do', () => {
  it('edits an item: label, link and new tab are saved', async () => {
    render(<NavigationStep {...props()} />)
    // "About" is also a suggestion chip, so wait for the menu row itself (it has an Edit button)
    fireEvent.click(await screen.findByRole('button', { name: 'Edit About' }))
    const label = await screen.findByLabelText(/^label/i)
    fireEvent.change(label, { target: { value: 'About us' } })
    fireEvent.change(screen.getByLabelText(/^url/i), { target: { value: '/p/about-us' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(h.patch).toHaveBeenCalledWith('/menus/items/a', {
        label: 'About us',
        url: '/p/about-us',
        open_in_new_tab: false,
      })
    )
  })

  it('a page link has no URL field to edit (its address comes from the page)', async () => {
    menus.header!.items = [item('p1', 'Sample Service 1', { link_type: 'page', page_id: 'pg-1' })]
    render(<NavigationStep {...props()} />)
    await screen.findByText('Sample Service 1')
    fireEvent.click(screen.getByRole('button', { name: 'Edit Sample Service 1' }))
    await screen.findByLabelText(/^label/i)
    expect(screen.queryByLabelText(/^url/i)).toBeNull()
    menus.header!.items = [item('a', 'About'), item('b', 'Blog')]
  })

  it('lists existing pages and adds one to the menu as a real page link', async () => {
    render(<NavigationStep {...props()} />)
    await screen.findByText('About')
    const box = screen.getByTestId('existing-pages')
    fireEvent.click(await within(box).findByText('Existing pages (2)'))
    fireEvent.click(await within(box).findByRole('button', { name: /Sample Service 1/ }))
    await waitFor(() =>
      expect(h.post).toHaveBeenCalledWith(
        '/menus/m-header/items',
        expect.objectContaining({
          label: 'Sample Service 1',
          link_type: 'page',
          page_id: 'pg-1',
          url: '/p/sample-service-1',
        })
      )
    )
  })

  it('does not offer a page that is already in the menu', async () => {
    menus.header!.items = [item('p1', 'Contact Detail', { link_type: 'page', page_id: 'pg-2' })]
    render(<NavigationStep {...props()} />)
    await screen.findByText('Contact Detail')
    await waitFor(() => expect(screen.getByText('Existing pages (1)')).toBeTruthy())
    menus.header!.items = [item('a', 'About'), item('b', 'Blog')]
  })
})

describe('Navigation: moving on', () => {
  it('Next: Pages and Skip to Layouts call their own handlers; Back goes back', async () => {
    const p = props()
    render(<NavigationStep {...p} />)
    await screen.findByText('About')
    fireEvent.click(screen.getByTestId('nav-next'))
    expect(p.onNext).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('nav-skip-layouts'))
    expect(p.onLayouts).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(p.onBack).toHaveBeenCalledTimes(1)
  })
})
