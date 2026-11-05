import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../utils'
import LandingPagesPage from '@/app/admin/landing-pages/page'

const h = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  push: vi.fn(),
  can: vi.fn(),
}))

vi.mock('@/lib/axios', () => ({ default: { get: h.get, post: h.post, put: h.put } }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn(), useToast: () => ({ toasts: [] }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }) }))
vi.mock('@/admin/hooks/usePermissions', () => ({ usePermissions: () => ({ can: h.can }) }))
vi.mock('@/admin/components/shared/ModuleGuard', () => ({
  ModuleGuard: ({ children }: any) => children,
}))
vi.mock('@/admin/components/shared/PermissionGuard', () => ({
  PermissionGuard: ({ children }: any) => children,
}))

const templates = [
  { key: 'blank', name: 'Blank', description: 'Empty page.' },
  { key: 'lead-gen', name: 'Lead generation', description: 'Benefits and a CTA.' },
]

const mockSites = (sites: unknown[]) =>
  h.get.mockImplementation(async (url: string) => ({
    data: {
      data: url.endsWith('/identity')
        ? { identity: { app_name: 'Spring Co', logo_light: 'media/l.png' } }
        : url === '/landing/templates'
          ? { templates }
          : url === '/app-config'
            ? { identity: { app_name: 'Project' } }
            : { sites },
    },
  }))

beforeEach(() => {
  vi.clearAllMocks()
  h.can.mockReturnValue(true)
})

describe('Landing Pages admin page (T5.3)', () => {
  it('lists landing sites with status and an Edit link to the page editor', async () => {
    mockSites([
      {
        id: 's1',
        slug: 'spring',
        name: 'Spring sale',
        domain: null,
        pages: [{ id: 'pg1', slug: 'spring', title: 'Spring sale', status: 'DRAFT' }],
      },
    ])
    render(<LandingPagesPage />)
    expect(await screen.findByText('Spring sale')).toBeTruthy()
    expect(screen.getByText('Draft')).toBeTruthy()
    expect(screen.getByRole('link', { name: /edit/i }).getAttribute('href')).toBe(
      '/admin/template-engine/edit/pg1'
    )
    expect(screen.queryByRole('link', { name: /view/i })).toBeNull() // not published yet
  })

  it('shows an empty state, and hides "New landing page" without landing:add', async () => {
    mockSites([])
    h.can.mockReturnValue(false)
    render(<LandingPagesPage />)
    expect(await screen.findByText('No landing pages yet')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /new landing page/i })).toBeNull()
  })

  it('creates a page from a template and opens the editor; slug follows the name', async () => {
    mockSites([])
    h.post.mockResolvedValue({
      data: {
        data: {
          site: { id: 's1', slug: 'spring-sale', name: 'Spring sale', pages: [{ id: 'pg9' }] },
        },
      },
    })
    render(<LandingPagesPage />)
    fireEvent.click((await screen.findAllByRole('button', { name: /new landing page/i }))[0]!)
    fireEvent.change(await screen.findByLabelText(/^name/i), { target: { value: 'Spring sale' } })
    expect((screen.getByLabelText(/^slug/i) as HTMLInputElement).value).toBe('spring-sale')
    fireEvent.click(await screen.findByLabelText(/lead generation/i))
    fireEvent.click(screen.getByRole('button', { name: /create and edit/i }))
    await waitFor(() =>
      expect(h.post).toHaveBeenCalledWith('/landing', {
        name: 'Spring sale',
        slug: 'spring-sale',
        template: 'lead-gen',
      })
    )
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/admin/template-engine/edit/pg9'))
  })

  it('Branding: loads the site overrides, saves every key, an emptied field clears its override', async () => {
    mockSites([
      {
        id: 's1',
        project_id: 'p1',
        slug: 'spring',
        name: 'Spring sale',
        domain: null,
        pages: [{ id: 'pg1', slug: 'spring', title: 'Spring sale', status: 'DRAFT' }],
      },
    ])
    h.put.mockResolvedValue({ data: { data: { identity: {} } } })
    render(<LandingPagesPage />)
    fireEvent.click(await screen.findByRole('button', { name: /branding/i }))
    const name = (await screen.findByLabelText(/site name/i)) as HTMLInputElement
    await waitFor(() => expect(name.value).toBe('Spring Co'))
    expect(screen.getByText(/custom image set/i)).toBeTruthy() // the logo override
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Big sale' } })
    fireEvent.change(name, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /save branding/i }))
    await waitFor(() =>
      expect(h.put).toHaveBeenCalledWith('/projects/p1/sites/s1/identity', {
        app_name: '',
        app_title: '',
        description: 'Big sale',
        logo_light: 'media/l.png',
        favicon: '',
      })
    )
  })

  it('hides Branding without projects:update', async () => {
    mockSites([{ id: 's1', project_id: 'p1', slug: 'a', name: 'A', domain: null, pages: [] }])
    h.can.mockImplementation((p: string) => p !== 'projects:update')
    render(<LandingPagesPage />)
    await screen.findByText('A')
    expect(screen.queryByRole('button', { name: /branding/i })).toBeNull()
  })
})
