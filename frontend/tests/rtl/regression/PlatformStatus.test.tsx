import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import { PlatformStatus, type PlatformOverview } from '@/app/admin/dashboard/PlatformStatus'
import DashboardPage from '@/app/admin/dashboard/page'

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }))
const granted = vi.hoisted(() => ({ list: [] as string[] }))
vi.mock('@/admin/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: (p: string) => granted.list.includes(p), isLoading: false }),
}))
vi.mock('@/admin/hooks/useModules', () => ({ useModules: () => ({ isEnabled: () => true }) }))
import api from '@/lib/axios'

const overview = (over: Partial<PlatformOverview> = {}): PlatformOverview => ({
  app_type: 'admin-frontend',
  modules: {
    total: 40,
    enabled: 22,
    installed: 3,
    available: 15,
    by_group: [
      { group: 'core', enabled: 10, total: 10 },
      { group: 'cms', enabled: 8, total: 12 },
    ],
  },
  seeders: { total: 9, done: 9, failed: [], last_run_at: '2026-11-14T10:00:00.000Z' },
  website: { enabled: true, landing_pages: 4 },
  ...over,
})
const reply = (o: PlatformOverview) =>
  vi.mocked(api.get).mockResolvedValue({ data: { data: o } } as never)

beforeEach(() => vi.mocked(api.get).mockReset())

describe('PlatformStatus', () => {
  it('shows modules on, the application type, seeders and the website', async () => {
    reply(overview())
    render(<PlatformStatus />)
    expect(await screen.findByText('Admin frontend')).toBeTruthy()
    expect(screen.getByText('22')).toBeTruthy()
    expect(screen.getByText(/of 40 enabled/)).toBeTruthy()
    expect(screen.getByText(/of 9 ran/)).toBeTruthy()
    expect(screen.getByText('4 landing pages')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'View website' }).getAttribute('href')).toBe('/')
    expect(screen.getByRole('link', { name: 'Manage modules' }).getAttribute('href')).toBe(
      '/admin/modules'
    )
    expect(screen.getByText(/Cms/)).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(api.get).toHaveBeenCalledWith('/modules/overview')
  })

  it('calls out a failed seeder with its reason and how to retry', async () => {
    reply(
      overview({
        seeders: {
          total: 9,
          done: 8,
          failed: [{ name: 'credits', error: 'boom', at: '2026-11-14T11:00:00.000Z' }],
          last_run_at: null,
        },
      })
    )
    render(<PlatformStatus />)
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/credits/)
    expect(alert.textContent).toMatch(/boom/)
    expect(alert.textContent).toMatch(/seed\.js --pending/)
    expect(screen.getByText('No run recorded yet')).toBeTruthy()
  })

  it('without the Frontend module there is no website link; no type yet reads "Not chosen"', async () => {
    reply(overview({ app_type: null, website: { enabled: false, landing_pages: 0 } }))
    render(<PlatformStatus />)
    expect(await screen.findByText('Not chosen')).toBeTruthy()
    expect(screen.getByText('Frontend module is not enabled')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'View website' })).toBeNull()
  })

  it('shows nothing (no error box) if the overview cannot be read', async () => {
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/modules/overview'
        ? Promise.reject(new Error('403'))
        : Promise.resolve({ data: { data: {} } })
    )
    render(<PlatformStatus />)
    await waitFor(() => expect(screen.queryByTestId('platform-status')).toBeNull())
  })
})

describe('Dashboard and the platform section', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockResolvedValue({
      data: { data: { users: [], settings: [], pagination: { total: 1 } } },
    } as never)
  })
  it('a role without modules:view does not see it and does not call the overview', async () => {
    granted.list = ['media:view']
    render(<DashboardPage />)
    await screen.findByText('Media Files')
    expect(screen.queryByTestId('platform-status')).toBeNull()
    expect(vi.mocked(api.get).mock.calls.map((c) => c[0])).not.toContain('/modules/overview')
  })
  it('a role with modules:view sees it', async () => {
    granted.list = ['modules:view']
    reply(overview())
    render(<DashboardPage />)
    expect(await screen.findByTestId('platform-status')).toBeTruthy()
  })
})
