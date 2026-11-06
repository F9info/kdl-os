import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import DashboardPage from '@/app/admin/dashboard/page'

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }))
const granted = vi.hoisted(() => ({ list: [] as string[] }))
vi.mock('@/admin/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: (p: string) => granted.list.includes(p), isLoading: false }),
}))
const enabled = vi.hoisted(() => ({ all: true, off: [] as string[] }))
vi.mock('@/admin/hooks/useModules', () => ({
  useModules: () => ({ isEnabled: (slug: string) => enabled.all && !enabled.off.includes(slug) }),
}))
import api from '@/lib/axios'

const calledUrls = () => vi.mocked(api.get).mock.calls.map((c) => c[0])

describe('Dashboard respects permissions', () => {
  beforeEach(() => {
    enabled.all = true
    enabled.off = []
    vi.mocked(api.get).mockReset()
    vi.mocked(api.get).mockResolvedValue({
      data: { data: { users: [], settings: [], pagination: { total: 7 } } },
    } as never)
  })

  it('with no permissions: no dashboard API calls, no cards, a welcome note', async () => {
    granted.list = []
    render(<DashboardPage />)
    expect(await screen.findByTestId('dashboard-empty')).toBeInTheDocument()
    for (const u of ['/users', '/settings', '/media']) expect(calledUrls()).not.toContain(u)
    expect(screen.queryByText('Total Users')).not.toBeInTheDocument()
    expect(screen.queryByText('Recent Users')).not.toBeInTheDocument()
  })

  it('with only media:view: queries /media only and shows just that card', async () => {
    granted.list = ['media:view']
    render(<DashboardPage />)
    expect(await screen.findByText('Media Files')).toBeInTheDocument()
    await waitFor(() => expect(calledUrls()).toContain('/media'))
    expect(calledUrls()).not.toContain('/users')
    expect(calledUrls()).not.toContain('/settings')
    expect(screen.queryByText('Total Users')).not.toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-empty')).not.toBeInTheDocument()
  })

  it('with everything: all cards and the recent users table, all three APIs called', async () => {
    granted.list = ['users:view', 'settings:view', 'media:view']
    render(<DashboardPage />)
    for (const t of ['Total Users', 'Active Users', 'Settings', 'Media Files', 'Recent Users'])
      expect(await screen.findByText(t)).toBeInTheDocument()
    await waitFor(() =>
      expect(calledUrls()).toEqual(expect.arrayContaining(['/users', '/settings', '/media']))
    )
  })

  const links = () =>
    screen.queryByTestId('quick-actions')
      ? Array.from(screen.getByTestId('quick-actions').querySelectorAll('a')).map(
          (a) => a.textContent
        )
      : []

  const DEVELOPER = [
    'users:view',
    'settings:view',
    'media:view',
    'modules:view',
    'theme-engine:edit',
    'integrations:view',
    'menus:view',
    'page-builder:view',
  ]
  const ADMIN = [
    'users:view',
    'settings:view',
    'media:view',
    'menus:view',
    'page-builder:view',
    'theme-engine:view',
  ]

  it('developer dashboard: Build and Content quick actions', async () => {
    granted.list = DEVELOPER
    render(<DashboardPage />)
    await screen.findByTestId('quick-actions')
    expect(links()).toEqual([
      'Modules',
      'Themes',
      'Integrations',
      'Website',
      'Pages',
      'Sections',
      'Media',
      'Users',
    ])
  })

  it('admin dashboard: Content only, no Build group (view-only theme access is not enough)', async () => {
    granted.list = ADMIN
    render(<DashboardPage />)
    await screen.findByTestId('quick-actions')
    expect(links()).toEqual(['Website', 'Pages', 'Sections', 'Media', 'Users'])
    expect(screen.queryByText('Build')).not.toBeInTheDocument()
  })

  it('hides links whose module is disabled', async () => {
    granted.list = DEVELOPER
    enabled.off = ['page-builder', 'integrations']
    render(<DashboardPage />)
    await screen.findByTestId('quick-actions')
    expect(links()).toEqual(['Modules', 'Themes', 'Website', 'Pages', 'Media', 'Users'])
  })

  it('no permissions: no quick actions at all', async () => {
    granted.list = []
    render(<DashboardPage />)
    await screen.findByTestId('dashboard-empty')
    expect(screen.queryByTestId('quick-actions')).not.toBeInTheDocument()
  })
})
