import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const launchMutate = vi.fn()
let report: Record<string, unknown> = {}
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
vi.mock('@/admin/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: () => true, isLoading: false }),
}))
vi.mock('@/admin/hooks/useProjects', () => ({
  useProjects: () => ({ data: [{ id: 'p1', name: 'Acme' }] }),
  useLaunchCheck: () => ({ data: report, isLoading: false, error: null }),
  useLaunch: () => ({ mutate: launchMutate, isPending: false, error: null }),
}))
vi.mock('@/stores/project.store', () => ({
  useProjectStore: (sel: (s: { activeProjectId: string }) => unknown) =>
    sel({ activeProjectId: 'p1' }),
  resolveActiveProject: (list: { id: string }[], id: string) => list.find((p) => p.id === id),
}))
vi.mock('@/admin/components/layout/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}))
vi.mock('@/app/admin/page-builder/store', () => ({
  listPages: async () => [
    { id: 'a', title: 'Home', status: 'PUBLISHED' },
    { id: 'b', title: 'About', status: 'DRAFT' },
  ],
  createPreviewLink: async (id: string) => ({ token: `tok-${id}`, expires_at: '' }),
}))

import LaunchPage from '@/app/admin/projects/launch/page'
import PreviewPage from '@/app/admin/projects/preview/page'

const page = (o = {}) => ({
  id: 'a',
  slug: 'home',
  title: 'Home',
  status: 'DRAFT',
  errors: 0,
  warnings: 0,
  can_publish: true,
  issues: [],
  ...o,
})

describe('project Launch page (T13)', () => {
  it('ready: launching asks to confirm, then publishes without force', async () => {
    report = { ready: true, pages: [page()], launch: null }
    render(<LaunchPage />)
    fireEvent.click(screen.getByTestId('launch-button'))
    fireEvent.click(await screen.findByRole('button', { name: 'Launch' }))
    await waitFor(() =>
      expect(launchMutate).toHaveBeenCalledWith({ id: 'p1', force: false }, expect.anything())
    )
  })

  it('not ready: Launch is disabled, the problem is listed, and "Launch anyway" forces', () => {
    launchMutate.mockClear()
    report = {
      ready: false,
      pages: [page({ can_publish: false, issues: [{ message: 'Image missing' }] })],
      launch: null,
    }
    render(<LaunchPage />)
    expect(screen.getByTestId('launch-button')).toBeDisabled()
    expect(screen.getByText('Image missing')).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Launch anyway/))
    expect(launchMutate).toHaveBeenCalledWith({ id: 'p1', force: true }, expect.anything())
  })

  it('nothing pending: says so and shows the last launch', () => {
    report = { ready: true, pages: [], launch: { at: '2026-11-09T00:00:00Z', published: 3 } }
    render(<LaunchPage />)
    expect(screen.getByTestId('nothing-to-launch')).toBeInTheDocument()
    expect(screen.getByTestId('last-launch')).toHaveTextContent('3 pages published')
  })
})

describe('project Preview page (T13)', () => {
  it('frames the signed preview link at the chosen device width and walks the pages', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <PreviewPage />
      </QueryClientProvider>
    )
    const frame = await screen.findByTestId('preview-frame')
    await waitFor(() => expect(frame).toHaveAttribute('src', '/preview/tok-a'))
    expect(frame).toHaveStyle({ width: '1280px' })
    fireEvent.click(screen.getByText('Mobile'))
    expect(screen.getByTestId('preview-frame')).toHaveStyle({ width: '390px' })
    fireEvent.click(screen.getByLabelText('Next page'))
    await waitFor(() =>
      expect(screen.getByTestId('preview-frame')).toHaveAttribute('src', '/preview/tok-b')
    )
  })
})
