import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../utils'
import LandingPagesPage from '@/app/admin/landing-pages/page'
import { BrandingDialog } from '@/app/admin/landing-pages/BrandingDialog'

const h = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
  push: vi.fn(),
  can: vi.fn(),
  search: '',
}))

vi.mock('@/lib/axios', () => ({ default: { get: h.get, post: h.post, put: h.put, delete: h.del } }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn(), useToast: () => ({ toasts: [] }) }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: h.push }),
  useSearchParams: () => new URLSearchParams(h.search),
}))
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
  { key: 'event', name: 'Event or webinar', description: 'Agenda and speakers.' },
]

const mockSites = (sites: unknown[]) =>
  h.get.mockImplementation(async (url: string) => ({
    data: {
      data: url.endsWith('/identity')
        ? { identity: { app_name: 'Spring Co', logo_light: 'media/l.png' } }
        : url === '/landing/templates'
          ? { templates }
          : url === '/app-config'
            ? {
                identity: {
                  app_name: 'Project',
                  contact_email: 'info@kdl.com',
                  contact_phone: '7337337778',
                  social_facebook: 'https://facebook.com/kdl',
                },
              }
            : { sites },
    },
  }))

beforeEach(() => {
  vi.clearAllMocks()
  h.search = ''
  h.can.mockReturnValue(true)
})

const SITE = {
  id: 's1',
  project_id: 'p1',
  slug: 'spring',
  name: 'Spring sale',
  domain: null,
  pages: [{ id: 'pg1', slug: 'spring', title: 'Spring sale', status: 'DRAFT' }],
}

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
      '/admin/template-engine/edit/pg1?from=landing'
    )
    expect(screen.queryByRole('link', { name: /^view$/i })).toBeNull() // not published yet
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
    await waitFor(() =>
      expect(h.push).toHaveBeenCalledWith('/admin/template-engine/edit/pg9?from=landing')
    )
  })

  it('shows the starter templates as a gallery (Blank is not one) with a Use button each', async () => {
    mockSites([])
    render(<LandingPagesPage />)
    expect(await screen.findByTestId('template-card-lead-gen')).toBeTruthy()
    expect(screen.getByTestId('template-card-event')).toBeTruthy()
    expect(screen.queryByTestId('template-card-blank')).toBeNull()
    expect(screen.getByTestId('use-template-event')).toBeTruthy()
  })

  it('View template opens the full preview of that template (no page is created)', async () => {
    mockSites([])
    render(<LandingPagesPage />)
    const view = await screen.findByTestId('view-template-event')
    expect(view.getAttribute('href')).toBe('/admin/landing-pages/preview/event')
    expect(view.textContent).toMatch(/view template/i)
    expect(h.post).not.toHaveBeenCalled()
  })

  it('opens the New dialog on the template chosen in the preview (?use=)', async () => {
    mockSites([])
    h.search = 'use=event'
    render(<LandingPagesPage />)
    const name = (await screen.findByLabelText(/^name/i)) as HTMLInputElement
    await waitFor(() => expect(name.value).toBe('Event or webinar'))
    expect((screen.getByLabelText(/event or webinar/i) as HTMLInputElement).checked).toBe(true)
  })

  it('hides the gallery without landing:add', async () => {
    mockSites([])
    h.can.mockReturnValue(false)
    render(<LandingPagesPage />)
    await screen.findByText('No landing pages yet')
    expect(screen.queryByTestId('template-card-lead-gen')).toBeNull()
  })

  it('Use this template opens the dialog with that template chosen and a name filled in', async () => {
    mockSites([])
    h.post.mockResolvedValue({
      data: {
        data: { site: { id: 's1', slug: 'event-or-webinar', name: 'x', pages: [{ id: 'pg5' }] } },
      },
    })
    render(<LandingPagesPage />)
    fireEvent.click(await screen.findByTestId('use-template-event'))
    const name = (await screen.findByLabelText(/^name/i)) as HTMLInputElement
    await waitFor(() => expect(name.value).toBe('Event or webinar'))
    expect((screen.getByLabelText(/^slug/i) as HTMLInputElement).value).toBe('event-or-webinar')
    expect((screen.getByLabelText(/event or webinar/i) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /create and edit/i }))
    await waitFor(() =>
      expect(h.post).toHaveBeenCalledWith('/landing', {
        name: 'Event or webinar',
        slug: 'event-or-webinar',
        template: 'event',
      })
    )
    await waitFor(() =>
      expect(h.push).toHaveBeenCalledWith('/admin/template-engine/edit/pg5?from=landing')
    )
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
    render(<BrandingDialog site={SITE as any} onClose={vi.fn()} />)
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
        logo_dark: '',
        favicon: '',
        contact_email: '',
        contact_email_secondary: '',
        contact_phone: '',
        contact_phone_secondary: '',
        contact_address: '',
        copyright: '',
        social_facebook: '',
        social_x: '',
        social_instagram: '',
        social_linkedin: '',
        social_youtube: '',
      })
    )
  })

  it('Branding also covers the footer details, showing the project Identity values as placeholders', async () => {
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
    render(<BrandingDialog site={SITE as any} onClose={vi.fn()} />)
    const email = (await screen.findByLabelText(/^contact email/i)) as HTMLInputElement
    await waitFor(() => expect(email.placeholder).toBe('info@kdl.com'))
    expect(email.value).toBe('') // empty = use the Identity value
    expect((screen.getByLabelText(/^contact phone/i) as HTMLInputElement).placeholder).toBe(
      '7337337778'
    )
    expect((screen.getByLabelText(/facebook url/i) as HTMLInputElement).placeholder).toBe(
      'https://facebook.com/kdl'
    )
    for (const label of [
      /secondary email/i,
      /secondary phone/i,
      /^address/i,
      /x \(twitter\) url/i,
      /instagram url/i,
      /linkedin url/i,
      /youtube url/i,
      /copyright notice/i,
    ]) {
      expect(screen.getByLabelText(label)).toBeTruthy()
    }
    fireEvent.change(email, { target: { value: 'spring@kdl.com' } })
    fireEvent.change(screen.getByLabelText(/^address/i), { target: { value: 'Hyderabad' } })
    fireEvent.click(screen.getByRole('button', { name: /save branding/i }))
    await waitFor(() =>
      expect(h.put).toHaveBeenCalledWith(
        '/projects/p1/sites/s1/identity',
        expect.objectContaining({
          contact_email: 'spring@kdl.com',
          contact_address: 'Hyderabad',
          contact_phone: '', // untouched: still the Identity value
          social_facebook: '',
        })
      )
    )
  })

  it("Branding shows the project logo it inherits, and the page's own picture when it has one", async () => {
    h.get.mockImplementation(async (url: string) => ({
      data: {
        data: url.endsWith('/identity')
          ? {
              identity: { logo_light: 'media/own.png' },
              resolved: { logo_light: 'https://cdn.test/own.png' },
            }
          : url === '/landing/templates'
            ? { templates }
            : url === '/app-config'
              ? {
                  identity: {
                    app_name: 'Project',
                    logo_light: 'https://cdn.test/project-logo.png',
                    logo_dark: 'https://cdn.test/project-dark.png',
                  },
                }
              : {
                  sites: [
                    { id: 's1', project_id: 'p1', slug: 'a', name: 'A', domain: null, pages: [] },
                  ],
                },
      },
    }))
    render(<BrandingDialog site={SITE as any} onClose={vi.fn()} />)
    // light logo: the page has its own, so its picture shows
    const own = (await screen.findByAltText('logo_light preview')) as HTMLImageElement
    await waitFor(() => expect(own.src).toBe('https://cdn.test/own.png'))
    // dark logo: no override, so the project's picture shows
    const dark = screen.getByAltText('logo_dark preview') as HTMLImageElement
    expect(dark.src).toBe('https://cdn.test/project-dark.png')
    // favicon: the project has none and the page none, so the box says so
    expect(screen.getAllByText('None').length).toBeGreaterThan(0)
  })

  it('the Landing Pages screen has no Branding button: company details live in Identity only', async () => {
    mockSites([{ id: 's1', project_id: 'p1', slug: 'a', name: 'A', domain: null, pages: [] }])
    render(<LandingPagesPage />)
    await screen.findByText('A')
    expect(screen.queryByRole('button', { name: /branding/i })).toBeNull()
  })
})

describe('Deleting a landing page', () => {
  const site = {
    id: 's1',
    project_id: 'p1',
    slug: 'spring',
    name: 'Spring sale',
    domain: null,
    pages: [{ id: 'pg1', slug: 'spring', title: 'Spring sale', status: 'PUBLISHED' }],
  }

  it('asks first, then deletes the page and refreshes the list', async () => {
    mockSites([site])
    h.del.mockResolvedValue({ data: { data: { deleted: true } } })
    render(<LandingPagesPage />)
    fireEvent.click(await screen.findByTestId('delete-landing-spring'))
    expect(await screen.findByText(/delete "spring sale"\?/i)).toBeTruthy()
    expect(screen.getByText(/\/p\/spring stops working/i)).toBeTruthy()
    expect(h.del).not.toHaveBeenCalled() // nothing happens until it is confirmed
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() => expect(h.del).toHaveBeenCalledWith('/landing/s1'))
  })

  it('Cancel leaves the page alone', async () => {
    mockSites([site])
    render(<LandingPagesPage />)
    fireEvent.click(await screen.findByTestId('delete-landing-spring'))
    fireEvent.click(await screen.findByRole('button', { name: /cancel/i }))
    await waitFor(() => expect(screen.queryByText(/delete "spring sale"\?/i)).toBeNull())
    expect(h.del).not.toHaveBeenCalled()
  })

  it('shows no Delete button without landing:delete', async () => {
    mockSites([site])
    h.can.mockImplementation((p: string) => p !== 'landing:delete')
    render(<LandingPagesPage />)
    await screen.findByText('Spring sale')
    expect(screen.queryByTestId('delete-landing-spring')).toBeNull()
  })
})

describe('Template library (T10)', () => {
  it('duplicates a template under a new name', async () => {
    mockSites([])
    h.post.mockResolvedValue({
      data: { data: { template: { key: 'copy-1', name: 'Spring offer' } } },
    })
    render(<LandingPagesPage />)
    fireEvent.click(await screen.findByTestId('duplicate-template-lead-gen'))
    const input = (await screen.findByLabelText(/template name/i)) as HTMLInputElement
    expect(input.value).toBe('Lead generation (copy)')
    fireEvent.change(input, { target: { value: 'Spring offer' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(h.post).toHaveBeenCalledWith('/landing/templates/lead-gen/duplicate', {
        name: 'Spring offer',
      })
    )
  })

  it('renames and deletes a template', async () => {
    mockSites([])
    h.put.mockResolvedValue({ data: { data: { template: {} } } })
    h.del.mockResolvedValue({ data: { data: { deleted: true } } })
    render(<LandingPagesPage />)
    fireEvent.click(await screen.findByTestId('rename-template-event'))
    fireEvent.change(await screen.findByLabelText(/template name/i), {
      target: { value: 'Webinar' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    await waitFor(() =>
      expect(h.put).toHaveBeenCalledWith('/landing/templates/event', { name: 'Webinar' })
    )

    fireEvent.click(await screen.findByTestId('delete-template-event'))
    fireEvent.click(await screen.findByRole('button', { name: /^delete$/i }))
    await waitFor(() => expect(h.del).toHaveBeenCalledWith('/landing/templates/event'))
  })

  it('saves a landing page as a template', async () => {
    mockSites([
      {
        id: 's1',
        slug: 'spring',
        name: 'Spring sale',
        domain: null,
        pages: [{ id: 'pg1', slug: 'spring', title: 'Spring sale', status: 'DRAFT' }],
      },
    ])
    h.post.mockResolvedValue({
      data: { data: { template: { key: 'saved', name: 'Spring sale' } } },
    })
    render(<LandingPagesPage />)
    fireEvent.click(await screen.findByTestId('save-template-spring'))
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(h.post).toHaveBeenCalledWith('/landing/templates', {
        pageId: 'pg1',
        name: 'Spring sale',
      })
    )
  })

  it('without landing:add there is no duplicate or save button; without edit and delete, no rename or delete', async () => {
    mockSites([])
    h.can.mockImplementation((p: string) => p === 'landing:view')
    render(<LandingPagesPage />)
    await screen.findByText('No landing pages yet')
    expect(screen.queryByTestId('duplicate-template-lead-gen')).toBeNull()
    expect(screen.queryByTestId('rename-template-lead-gen')).toBeNull()
    expect(screen.queryByTestId('delete-template-lead-gen')).toBeNull()
  })
})

describe('Finished landing pages (after Save in the editor)', () => {
  const sites = [
    {
      id: 's1',
      slug: 'spring',
      name: 'Spring sale',
      domain: null,
      pages: [{ id: 'pg1', slug: 'spring', title: 'Spring sale', status: 'PUBLISHED' }],
    },
    {
      id: 's2',
      slug: 'draft-one',
      name: 'Draft one',
      domain: null,
      pages: [{ id: 'pg2', slug: 'draft-one', title: 'Draft one', status: 'DRAFT' }],
    },
  ]

  it('shows only saved pages, each with a thumbnail, Preview and Convert; no template gallery', async () => {
    h.search = 'finished=1'
    mockSites(sites)
    render(<LandingPagesPage />)
    expect(await screen.findByText('Spring sale')).toBeTruthy()
    expect(screen.queryByText('Draft one')).toBeNull()
    expect(screen.queryByText('Start from a template')).toBeNull()
    expect(screen.getByTitle('Thumbnail of Spring sale').getAttribute('src')).toBe('/p/spring')
    expect(screen.getByRole('link', { name: /preview/i }).getAttribute('href')).toBe('/p/spring')
    expect(screen.getByTestId('convert-spring')).toBeTruthy()
    expect(screen.getByRole('link', { name: /edit/i }).getAttribute('href')).toBe(
      '/admin/template-engine/edit/pg1?from=landing'
    )
  })

  it('says so when nothing is saved yet', async () => {
    h.search = 'finished=1'
    mockSites([sites[1]])
    render(<LandingPagesPage />)
    expect(await screen.findByTestId('no-finished')).toBeTruthy()
  })

  it('without ?finished the normal screen (gallery and every page) is unchanged', async () => {
    mockSites(sites)
    render(<LandingPagesPage />)
    expect(await screen.findByText('Draft one')).toBeTruthy()
    expect(screen.queryByTestId('finished-list')).toBeNull()
  })
})
