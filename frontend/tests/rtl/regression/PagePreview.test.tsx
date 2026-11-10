import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../utils'
import { PreviewLinkButton, previewUrl } from '@/app/admin/page-builder/PreviewLink'
import PreviewPage from '@/app/(site)/preview/[token]/page'

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), pageRender: vi.fn() }))
vi.mock('@/lib/axios', () => ({ default: { get: h.get, post: h.post, put: vi.fn() } }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn(), useToast: () => ({ toasts: [] }) }))
vi.mock('next/navigation', () => ({
  useParams: () => ({ token: 'tok.en.sig' }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))
vi.mock('@/hooks/useIdentity', () => ({
  useIdentity: () => ({ identity: { app_name: 'Acme' }, isLoading: false }),
}))
vi.mock('@/frontend/rendering/PageRender', () => ({
  PageRender: (props: any) => {
    h.pageRender(props)
    return <div data-testid="page-render">{props.page.title}</div>
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Preview button, direct (landing page editor)', () => {
  it('one click opens the whole page in a new tab, no dialog; the link works for 1 hour', async () => {
    const tab = { location: { href: '' }, close: vi.fn() }
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
    h.post.mockResolvedValue({
      data: { data: { token: 'abc.def.ghi', expires_at: '2026-11-06T10:00:00.000Z' } },
    })
    render(<PreviewLinkButton pageId="pg1" direct />)
    fireEvent.click(screen.getByRole('button', { name: /preview/i }))
    await waitFor(() =>
      expect(tab.location.href).toBe(`${window.location.origin}/preview/abc.def.ghi`)
    )
    expect(openSpy).toHaveBeenCalledWith('', '_blank')
    expect(h.post).toHaveBeenCalledWith('/page-builder/pg1/preview-link', { ttl_hours: 1 })
    expect(screen.queryByText('Preview link')).toBeNull()
    openSpy.mockRestore()
  })

  it('closes the tab when the link cannot be made', async () => {
    const tab = { location: { href: '' }, close: vi.fn() }
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
    h.post.mockRejectedValue(new Error('nope'))
    render(<PreviewLinkButton pageId="pg1" direct />)
    fireEvent.click(screen.getByRole('button', { name: /preview/i }))
    await waitFor(() => expect(tab.close).toHaveBeenCalled())
    openSpy.mockRestore()
  })
})

describe('Preview button + dialog (T6.3)', () => {
  const open = () => {
    render(<PreviewLinkButton pageId="pg1" />)
    fireEvent.click(screen.getByRole('button', { name: /preview/i }))
  }

  it('creates a link for the chosen duration and shows the full URL and expiry', async () => {
    h.post.mockResolvedValue({
      data: { data: { token: 'abc.def.ghi', expires_at: '2026-11-06T10:00:00.000Z' } },
    })
    open()
    fireEvent.change(await screen.findByLabelText(/link works for/i), { target: { value: '168' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create link' }))
    const input = (await screen.findByRole('textbox', { name: 'Preview link' })) as HTMLInputElement
    expect(h.post).toHaveBeenCalledWith('/page-builder/pg1/preview-link', { ttl_hours: 168 })
    expect(input.value).toBe(`${window.location.origin}/preview/abc.def.ghi`)
    expect(screen.getByText(/^Expires /)).toBeTruthy()
    expect(screen.getByRole('link', { name: /open/i }).getAttribute('href')).toBe(input.value)
    expect(screen.getByRole('button', { name: 'Create a new link' })).toBeTruthy()
  })

  it('defaults to 24 hours and copies the link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    h.post.mockResolvedValue({
      data: { data: { token: 't', expires_at: '2026-11-06T10:00:00.000Z' } },
    })
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Create link' }))
    await screen.findByRole('textbox', { name: 'Preview link' })
    expect(h.post).toHaveBeenCalledWith('/page-builder/pg1/preview-link', { ttl_hours: 24 })
    fireEvent.click(screen.getByRole('button', { name: /copy/i }))
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(previewUrl(window.location.origin, 't'))
    )
  })

  it('shows the server error and no link when creating fails', async () => {
    h.post.mockRejectedValue({ response: { data: { message: 'Page not found' } }, message: 'x' })
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Create link' }))
    expect(await screen.findByText(/page not found/i)).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: 'Preview link' })).toBeNull()
  })

  it('warns that the link cannot be switched off early', async () => {
    open()
    expect(await screen.findByText(/cannot be switched off earlier/i)).toBeTruthy()
  })
})

describe('/preview/<token> page (T6.3)', () => {
  const pageBody = (over = {}) => ({
    data: {
      data: {
        page: {
          id: '',
          slug: 's',
          title: 'Spring Sale',
          data: { root: { props: {} }, content: [] },
          status: 'DRAFT',
          updated_at: '',
          project_id: 'p',
          layout: null,
          identity: { app_name: 'Site' },
          ...over,
        },
      },
    },
  })

  it('fetches by the token from the URL and renders the draft under a preview banner', async () => {
    h.get.mockResolvedValue(pageBody())
    render(<PreviewPage />)
    expect(await screen.findByTestId('page-render')).toBeTruthy()
    expect(h.get).toHaveBeenCalledWith('/page-builder/public/preview/tok.en.sig')
    const banner = screen.getByRole('status')
    expect(banner.textContent).toMatch(/not published yet/i)
    expect(banner.textContent).toContain('Spring Sale')
    expect(h.pageRender.mock.calls[0]![0].identity).toEqual({ app_name: 'Acme' })
  })

  it('a published page is still labelled as a preview (it may show newer edits)', async () => {
    h.get.mockResolvedValue(pageBody({ status: 'PUBLISHED' }))
    render(<PreviewPage />)
    await screen.findByTestId('page-render')
    expect(screen.getByRole('status').textContent).not.toMatch(/not published/i)
    expect(screen.getByRole('status').textContent).toMatch(/preview/i)
  })

  it('an invalid or expired token shows a clear message and no page', async () => {
    h.get.mockRejectedValue({ response: { status: 404 } })
    render(<PreviewPage />)
    expect(await screen.findByText(/not valid or has expired/i)).toBeTruthy()
    expect(screen.queryByTestId('page-render')).toBeNull()
  })
})
