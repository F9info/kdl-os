import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../utils'
import StaticWebsitePage from '@/app/admin/static-website/page'

const h = vi.hoisted(() => ({
  order: [] as string[],
  prepare: vi.fn(),
  start: vi.fn(),
  download: vi.fn(),
  status: { data: undefined as undefined | Record<string, unknown> },
  startPending: false,
  preparing: false,
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('projectId=proj-1'),
}))
vi.mock('@/admin/components/shared/ModuleGuard', () => ({
  ModuleGuard: ({ children }: any) => children,
}))
vi.mock('@/admin/components/shared/PermissionGuard', () => ({
  PermissionGuard: ({ children }: any) => children,
}))
vi.mock('@/admin/hooks/useTemplateEngine', () => ({
  useCreateSite: () => ({
    mutateAsync: h.prepare,
    isPending: h.preparing,
    data: undefined,
  }),
  useStaticBuild: () => ({
    status: h.status,
    start: { mutate: h.start, isPending: h.startPending },
    download: h.download,
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  h.order.length = 0
  h.status.data = undefined
  h.startPending = false
  h.preparing = false
  h.prepare.mockImplementation(async () => {
    h.order.push('prepare')
    return { slug: 'demo', pages: 5 }
  })
  h.start.mockImplementation(() => h.order.push('build'))
})

describe('Convert to Static Website', () => {
  it('one click prepares the latest content, then builds, in that order', async () => {
    render(<StaticWebsitePage />)
    fireEvent.click(screen.getByTestId('convert-static'))
    await waitFor(() => expect(h.start).toHaveBeenCalledWith({ apiBase: '', siteUrl: '' }))
    expect(h.order).toEqual(['prepare', 'build'])
  })

  it('passes the optional Web app address to the build', async () => {
    render(<StaticWebsitePage />)
    fireEvent.change(screen.getByLabelText(/web app address/i), {
      target: { value: 'https://app.example.com' },
    })
    fireEvent.click(screen.getByTestId('convert-static'))
    await waitFor(() =>
      expect(h.start).toHaveBeenCalledWith({ apiBase: 'https://app.example.com', siteUrl: '' })
    )
  })

  it('a bad address is rejected on the spot: nothing is prepared or built', async () => {
    render(<StaticWebsitePage />)
    fireEvent.change(screen.getByLabelText(/web app address/i), { target: { value: 'not a url' } })
    fireEvent.click(screen.getByTestId('convert-static'))
    expect(await screen.findByRole('alert')).toHaveTextContent(/full address/i)
    expect(h.prepare).not.toHaveBeenCalled()
    expect(h.start).not.toHaveBeenCalled()
  })

  it('a javascript: or ftp: address is not accepted either', async () => {
    render(<StaticWebsitePage />)
    for (const bad of ['javascript:alert(1)', 'ftp://host/x']) {
      fireEvent.change(screen.getByLabelText(/web app address/i), { target: { value: bad } })
      fireEvent.click(screen.getByTestId('convert-static'))
      expect(await screen.findByRole('alert')).toBeTruthy()
    }
    expect(h.start).not.toHaveBeenCalled()
  })

  it('if preparing fails, the build is not started', async () => {
    h.prepare.mockRejectedValue(new Error('boom'))
    render(<StaticWebsitePage />)
    fireEvent.click(screen.getByTestId('convert-static'))
    await waitFor(() => expect(h.prepare).toHaveBeenCalled())
    expect(h.start).not.toHaveBeenCalled()
  })

  it('while a build runs the button is off and says so', () => {
    h.status.data = { state: 'running', log: '' }
    render(<StaticWebsitePage />)
    const button = screen.getByTestId('convert-static')
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent(/converting/i)
  })

  it('when finished: shows the folder, offers the zip, and the button becomes "Convert again"', () => {
    h.status.data = { state: 'done', log: '', slug: 'demo', folder: 'frontend/projects/demo/out' }
    render(<StaticWebsitePage />)
    expect(screen.getByTestId('static-folder')).toHaveTextContent('frontend/projects/demo/out')
    expect(screen.getByTestId('convert-static')).toHaveTextContent(/convert again/i)
    fireEvent.click(screen.getByTestId('download-static'))
    expect(h.download).toHaveBeenCalled()
  })

  it('converting again (still preparing) hides the previous result and its zip', () => {
    h.status.data = { state: 'done', log: '', slug: 'demo', folder: 'frontend/projects/demo/out' }
    h.preparing = true
    render(<StaticWebsitePage />)
    expect(screen.queryByTestId('static-result')).toBeNull()
    expect(screen.queryByTestId('download-static')).toBeNull()
    expect(screen.getByTestId('convert-static')).toBeDisabled()
    expect(screen.getByTestId('static-state')).toHaveTextContent('running')
  })

  it('while the build runs, the old "done" is not shown and the old zip is not offered', () => {
    h.status.data = { state: 'running', log: '', folder: 'frontend/projects/demo/out' }
    render(<StaticWebsitePage />)
    expect(screen.queryByTestId('static-result')).toBeNull()
    expect(screen.queryByTestId('download-static')).toBeNull()
    expect(screen.getByTestId('static-state')).toHaveTextContent('running')
  })

  it('before any conversion there is no result and no download', () => {
    render(<StaticWebsitePage />)
    expect(screen.queryByTestId('static-result')).toBeNull()
    expect(screen.queryByTestId('download-static')).toBeNull()
    expect(screen.getByTestId('convert-static')).toHaveTextContent('Convert to Static Website')
  })

  it('a failed build shows the technical log open', () => {
    h.status.data = { state: 'failed', log: 'npm ERR! something broke' }
    render(<StaticWebsitePage />)
    expect(screen.getByText(/conversion failed/i)).toBeTruthy()
    expect(screen.getByTestId('static-log')).toHaveTextContent('something broke')
  })

  it('links back to the Web app and says the Web app is not changed', () => {
    render(<StaticWebsitePage />)
    expect(screen.getByRole('link', { name: /back to web app/i })).toHaveAttribute(
      'href',
      '/admin/template-engine/projects/proj-1/website'
    )
    expect(screen.getAllByText(/web app/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/exactly as before/i)).toBeTruthy()
  })
})
