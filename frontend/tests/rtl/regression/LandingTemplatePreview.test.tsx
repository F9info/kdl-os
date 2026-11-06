import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '../utils'
import TemplatePreviewPage from '@/app/admin/landing-pages/preview/[key]/page'

const h = vi.hoisted(() => ({
  get: vi.fn(),
  push: vi.fn(),
  can: vi.fn(),
  rendered: vi.fn(),
}))

vi.mock('@/lib/axios', () => ({ default: { get: h.get } }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: h.push }),
  useParams: () => ({ key: 'lead-gen' }),
}))
vi.mock('@/admin/hooks/usePermissions', () => ({ usePermissions: () => ({ can: h.can }) }))
vi.mock('@/admin/components/shared/ModuleGuard', () => ({
  ModuleGuard: ({ children }: any) => children,
}))
vi.mock('@/admin/components/shared/PermissionGuard', () => ({
  PermissionGuard: ({ children }: any) => children,
}))
// The real renderer is covered elsewhere; here only what the page hands to it matters.
vi.mock('@puckeditor/core', () => ({
  Render: (props: unknown) => {
    h.rendered(props)
    return <div data-testid="render" />
  },
}))

const data = { root: { props: { title: 'Lead generation' } }, content: [], zones: {} }

beforeEach(() => {
  vi.clearAllMocks()
  h.can.mockReturnValue(true)
  h.get.mockResolvedValue({ data: { data: { name: 'Lead generation', data } } })
})

describe('Template preview (View template)', () => {
  it('loads the template and renders it in preview mode, with a way back', async () => {
    render(<TemplatePreviewPage />)
    expect(await screen.findByTestId('render')).toBeTruthy()
    expect(h.get).toHaveBeenCalledWith('/landing/templates/lead-gen/preview')
    expect(h.rendered.mock.calls[0]![0]).toMatchObject({
      data,
      metadata: { pageTitle: 'Lead generation', preview: true },
    })
    expect(screen.getByText('Lead generation')).toBeTruthy()
    expect(screen.getByText(/nothing is created/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: /back to templates/i }).getAttribute('href')).toBe(
      '/admin/landing-pages'
    )
  })

  it('Use this template returns to the list with that template chosen', async () => {
    render(<TemplatePreviewPage />)
    fireEvent.click(await screen.findByRole('button', { name: /use this template/i }))
    expect(h.push).toHaveBeenCalledWith('/admin/landing-pages?use=lead-gen')
  })

  it('hides "Use this template" without landing:add, but still shows the preview', async () => {
    h.can.mockReturnValue(false)
    render(<TemplatePreviewPage />)
    expect(await screen.findByTestId('render')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /use this template/i })).toBeNull()
  })

  it('shows an error for an unknown template', async () => {
    h.get.mockRejectedValue(new Error('Unknown template'))
    render(<TemplatePreviewPage />)
    expect(await screen.findByText(/unknown template/i)).toBeTruthy()
  })
})
