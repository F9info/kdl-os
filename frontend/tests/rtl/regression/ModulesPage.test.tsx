import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../utils'
import ModulesPage from '@/app/admin/modules/page'
import { useAuthStore } from '@/stores/auth.store'
import type { Module } from '@/types/models.types'

vi.mock('@/lib/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import api from '@/lib/axios'

const ALL_PERMISSIONS = ['modules:view', 'modules:add', 'modules:edit', 'modules:delete']

function mockGetBase(overrides?: (url: string) => unknown) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (overrides) {
      const result = overrides(url)
      if (result !== undefined) return Promise.resolve(result) as ReturnType<typeof api.get>
    }
    if (url === '/auth/me/permissions') {
      return Promise.resolve({
        data: { data: { permissions: ALL_PERMISSIONS, roles: ['admin'], bypass: false } },
      }) as ReturnType<typeof api.get>
    }
    if (url === '/modules/enabled') {
      return Promise.resolve({
        data: { data: { modules: [{ slug: 'core', name: 'Core', core: true, nav: [] }] } },
      }) as ReturnType<typeof api.get>
    }
    if (url === '/modules') {
      return Promise.resolve({
        data: { data: { modules: [] } },
      }) as ReturnType<typeof api.get>
    }
    return Promise.resolve({ data: { data: {} } }) as ReturnType<typeof api.get>
  })
}

const pageBuilderConflict = {
  slug: 'page-builder-ui',
  name: 'Page Builder UI',
  status: 'ENABLED' as const,
}
const themeEngineConflict = {
  slug: 'theme-engine-ui',
  name: 'Theme Engine UI',
  status: 'ENABLED' as const,
}

const templateEngineModule: Module = {
  slug: 'template-engine',
  name: 'Template Engine',
  description: 'Brand identity and collateral generator.',
  version: '1.0.0',
  core: false,
  apiPrefix: '/api/template-engine',
  icon: 'Sparkles',
  status: 'AVAILABLE',
  installed_at: null,
  enabled_at: null,
  settings: null,
  conflictsWith: ['page-builder-ui', 'theme-engine-ui'],
  conflicts: [pageBuilderConflict, themeEngineConflict],
}

const pageBuilderModule: Module = {
  slug: 'page-builder-ui',
  name: 'Page Builder UI',
  description: 'Page editor admin surface.',
  version: '1.0.0',
  core: false,
  apiPrefix: '/api/page-builder',
  icon: 'Box',
  status: 'ENABLED',
  installed_at: '2026-01-01T00:00:00.000Z',
  enabled_at: '2026-01-01T00:00:00.000Z',
  settings: null,
  conflictsWith: ['template-engine'],
  conflicts: [],
}

const plainModule: Module = {
  slug: 'analytics',
  name: 'Analytics',
  description: 'Usage analytics.',
  version: '1.0.0',
  core: false,
  apiPrefix: '/api/analytics',
  icon: 'Activity',
  status: 'AVAILABLE',
  installed_at: null,
  enabled_at: null,
  settings: null,
  conflictsWith: [],
  conflicts: [],
}

describe('ModulesPage — conflict hint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ accessToken: 'token', isAuthenticated: true, isLoading: false })
  })

  it('shows conflict hint when module has active conflicts', async () => {
    mockGetBase((url) => {
      if (url === '/modules') {
        return { data: { data: { modules: [templateEngineModule] } } }
      }
    })
    render(<ModulesPage />)
    await waitFor(() => {
      expect(screen.getByText('Template Engine')).toBeInTheDocument()
    })
    expect(
      screen.getByText(/Requires disabling:.*Page Builder UI.*Theme Engine UI/i)
    ).toBeInTheDocument()
  })

  it('does not show conflict hint when conflicts array is empty', async () => {
    mockGetBase((url) => {
      if (url === '/modules') {
        return { data: { data: { modules: [plainModule] } } }
      }
    })
    render(<ModulesPage />)
    await waitFor(() => {
      expect(screen.getByText('Analytics')).toBeInTheDocument()
    })
    expect(screen.queryByText(/Requires disabling/i)).not.toBeInTheDocument()
  })

  it('does not show conflict hint on an ENABLED module (symmetric direction)', async () => {
    const enabledWithConflicts: Module = {
      ...pageBuilderModule,
      conflicts: [{ slug: 'template-engine', name: 'Template Engine', status: 'ENABLED' }],
    }
    mockGetBase((url) => {
      if (url === '/modules') {
        return { data: { data: { modules: [enabledWithConflicts] } } }
      }
    })
    render(<ModulesPage />)
    await waitFor(() => {
      expect(screen.getByText('Page Builder UI')).toBeInTheDocument()
    })
    expect(screen.queryByText(/Requires disabling/i)).not.toBeInTheDocument()
  })
})

describe('ModulesPage — switch dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ accessToken: 'token', isAuthenticated: true, isLoading: false })
  })

  it('opens switch dialog listing all blockers when Install is clicked on a conflicted module', async () => {
    mockGetBase((url) => {
      if (url === '/modules') {
        return { data: { data: { modules: [templateEngineModule] } } }
      }
    })
    render(<ModulesPage />)
    await waitFor(() => {
      expect(screen.getByText('Template Engine')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /^Install$/i }))

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/Switch to Template Engine/i)).toBeInTheDocument()
      expect(screen.getByText('Page Builder UI')).toBeInTheDocument()
      expect(screen.getByText('Theme Engine UI')).toBeInTheDocument()
    })
    expect(screen.getByText(/non-destructive/i)).toBeInTheDocument()
  })

  it('sends resolveConflicts: true when Install & switch is clicked', async () => {
    mockGetBase((url) => {
      if (url === '/modules') {
        return { data: { data: { modules: [templateEngineModule] } } }
      }
    })
    vi.mocked(api.post).mockResolvedValue({ data: { data: {} } } as Awaited<
      ReturnType<typeof api.post>
    >)

    render(<ModulesPage />)
    await waitFor(() => screen.getByRole('button', { name: /install/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Install$/i }))

    await waitFor(() => screen.getByRole('button', { name: /^Install & switch$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Install & switch$/i }))

    await waitFor(() => {
      expect(vi.mocked(api.post)).toHaveBeenCalledWith('/modules/template-engine/install', {
        resolveConflicts: true,
      })
    })
  })

  it('sends nothing when Cancel is clicked in the switch dialog', async () => {
    mockGetBase((url) => {
      if (url === '/modules') {
        return { data: { data: { modules: [templateEngineModule] } } }
      }
    })

    render(<ModulesPage />)
    await waitFor(() => screen.getByRole('button', { name: /install/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Install$/i }))

    await waitFor(() => screen.getByRole('dialog'))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(vi.mocked(api.post)).not.toHaveBeenCalled()
  })

  it('opens switch dialog (Enable & switch) for DISABLED conflicted module', async () => {
    const disabledConflicted: Module = {
      ...templateEngineModule,
      status: 'DISABLED',
      installed_at: '2026-01-01T00:00:00.000Z',
    }
    mockGetBase((url) => {
      if (url === '/modules') {
        return { data: { data: { modules: [disabledConflicted] } } }
      }
    })
    render(<ModulesPage />)
    await waitFor(() => screen.getByRole('button', { name: /enable/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Enable$/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Enable & switch$/i })).toBeInTheDocument()
    })
  })

  it('opens switch dialog symmetric: enabling page-builder-ui when template-engine is ENABLED', async () => {
    const pbWithConflict: Module = {
      ...pageBuilderModule,
      status: 'AVAILABLE',
      enabled_at: null,
      conflicts: [{ slug: 'template-engine', name: 'Template Engine', status: 'ENABLED' }],
    }
    mockGetBase((url) => {
      if (url === '/modules') {
        return { data: { data: { modules: [pbWithConflict] } } }
      }
    })
    render(<ModulesPage />)
    await waitFor(() => screen.getByRole('button', { name: /install/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Install$/i }))

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^Install & switch$/i })).toBeInTheDocument()
    })
  })
})

describe('ModulesPage — 409 MODULE_CONFLICT handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ accessToken: 'token', isAuthenticated: true, isLoading: false })
  })

  it('reopens the switch dialog pre-filled when a 409 MODULE_CONFLICT with details arrives', async () => {
    mockGetBase((url) => {
      if (url === '/modules') {
        return { data: { data: { modules: [plainModule] } } }
      }
    })
    vi.mocked(api.post).mockRejectedValue({
      response: {
        data: {
          code: 'MODULE_CONFLICT',
          message: 'Conflict detected',
          details: {
            conflicts: [{ slug: 'page-builder-ui', name: 'Page Builder UI', status: 'ENABLED' }],
          },
        },
      },
      message: 'Request failed with status code 409',
    })

    render(<ModulesPage />)
    await waitFor(() => screen.getByText('Analytics'))

    // Click Install on the plain module (no pre-existing conflicts → goes to regular confirm)
    fireEvent.click(screen.getByRole('button', { name: /^Install$/i }))
    await waitFor(() => screen.getAllByRole('button', { name: /^Install$/i }))

    // Confirm the regular dialog — get the last button (the confirm action)
    const confirmBtns = screen.getAllByRole('button', { name: /^Install$/i })
    const confirmBtn = confirmBtns[confirmBtns.length - 1]!
    fireEvent.click(confirmBtn)

    // The 409 should open the switch dialog
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Page Builder UI')).toBeInTheDocument()
    })
  })

  it('falls back to error toast when 409 has no details', async () => {
    mockGetBase((url) => {
      if (url === '/modules') {
        return { data: { data: { modules: [plainModule] } } }
      }
    })
    vi.mocked(api.post).mockRejectedValue({
      response: {
        data: {
          message: 'Cannot enable module: conflict detected',
        },
      },
      message: 'Request failed with status code 409',
    })

    render(<ModulesPage />)
    await waitFor(() => screen.getByText('Analytics'))

    fireEvent.click(screen.getByRole('button', { name: /^Install$/i }))
    await waitFor(() => screen.getAllByRole('button', { name: /^install$/i }))

    const confirmBtns = screen.getAllByRole('button', { name: /^Install$/i })
    const confirmBtn = confirmBtns[confirmBtns.length - 1]!
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(screen.getByText('Cannot enable module: conflict detected')).toBeInTheDocument()
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
