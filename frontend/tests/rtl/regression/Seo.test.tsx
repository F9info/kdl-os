import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../utils'
import { SeoDialog } from '@/app/admin/page-builder/SeoDialog'
import SeoSettingsPage from '@/app/admin/settings/seo/page'

const h = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn(), can: vi.fn() }))
vi.mock('@/lib/axios', () => ({ default: { get: h.get, put: h.put, post: h.post } }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn(), useToast: () => ({ toasts: [] }) }))
vi.mock('@/admin/hooks/usePermissions', () => ({ usePermissions: () => ({ can: h.can }) }))
vi.mock('@/admin/components/shared/PermissionGuard', () => ({
  PermissionGuard: ({ children }: { children: React.ReactNode }) => children,
}))

beforeEach(() => {
  vi.clearAllMocks()
  h.can.mockReturnValue(true)
  // The API answers with what it saved (defaults for the settings page, the page for the dialog).
  h.put.mockImplementation(async (_url: string, body: object) => ({
    data: { data: { defaults: body } },
  }))
})

describe('SeoDialog (T6.1)', () => {
  const open = (seo: Parameters<typeof SeoDialog>[0]['seo'] = null) =>
    render(<SeoDialog pageId="pg1" pageTitle="About us" seo={seo} onClose={vi.fn()} />)

  it('prefills from the page SEO, shows the page title as placeholder and live counters', async () => {
    open({ title: 'About Acme', description: 'Who we are' })
    const title = (await screen.findByLabelText(/seo title/i)) as HTMLInputElement
    expect(title.value).toBe('About Acme')
    expect(title.placeholder).toBe('About us')
    expect(screen.getByText(/10\/60 recommended/)).toBeTruthy()
    fireEvent.change(title, { target: { value: 'Hello' } })
    expect(screen.getByText(/5\/60 recommended/)).toBeTruthy()
  })

  it('saves all five fields to the page; cleared fields are sent empty', async () => {
    open({ title: 'Old', noindex: false })
    fireEvent.change(await screen.findByLabelText(/seo title/i), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText(/meta description/i), { target: { value: 'Desc' } })
    fireEvent.change(screen.getByLabelText(/canonical/i), { target: { value: 'https://a.test/x' } })
    fireEvent.click(screen.getByLabelText(/hide this page from search engines/i))
    fireEvent.click(screen.getByRole('button', { name: /save seo/i }))
    await waitFor(() =>
      expect(h.put).toHaveBeenCalledWith('/page-builder/pg1', {
        seo: {
          title: '',
          description: 'Desc',
          og_image: '',
          canonical: 'https://a.test/x',
          noindex: true,
        },
      })
    )
  })
})

describe('SEO defaults page (T6.1)', () => {
  beforeEach(() => {
    h.get.mockResolvedValue({
      data: { data: { defaults: { title_template: '%s | Acme', default_og_image: '' } } },
    })
  })

  it('loads and saves the defaults', async () => {
    render(<SeoSettingsPage />)
    const tpl = (await screen.findByLabelText(/title template/i)) as HTMLInputElement
    await waitFor(() => expect(tpl.value).toBe('%s | Acme'))
    fireEvent.change(tpl, { target: { value: '%s - Acme Ltd' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(h.put).toHaveBeenCalledWith('/page-builder/seo/defaults', {
        title_template: '%s - Acme Ltd',
        default_og_image: '',
      })
    )
  })

  it('a template without %s shows an error and cannot be saved', async () => {
    render(<SeoSettingsPage />)
    const tpl = await screen.findByLabelText(/title template/i)
    await waitFor(() => expect((tpl as HTMLInputElement).value).toBe('%s | Acme'))
    fireEvent.change(tpl, { target: { value: 'Acme' } })
    expect(screen.getByText(/must contain %s/i)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('Save is disabled without settings:edit', async () => {
    h.can.mockReturnValue(false)
    render(<SeoSettingsPage />)
    await screen.findByLabelText(/title template/i)
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
