import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '../../rtl/utils'
import userEvent from '@testing-library/user-event'
import UsersPage from '@/app/admin/users/page'
import { useAuthStore } from '@/stores/auth.store'

vi.mock('@/lib/axios', () => ({
  default: { get: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import api from '@/lib/axios'

const baseUser = {
  id: 'u1',
  name: 'Test User',
  email: 'test@kdl.com',
  is_active: true,
  must_change_password: false,
  created_at: '2026-01-01T00:00:00.000Z',
  status: 'ACTIVE' as const,
  avatar_media_id: null,
  last_login_at: null,
  deleted_at: null,
  updated_at: '2026-01-01T00:00:00.000Z',
  roles: [{ id: 'r1', name: 'User', slug: 'user' }],
}

const mockRoles = [
  {
    id: 'r1',
    name: 'User',
    slug: 'user',
    description: null,
    is_system: true,
    created_at: '',
    updated_at: '',
  },
  {
    id: 'r2',
    name: 'Admin',
    slug: 'admin',
    description: null,
    is_system: true,
    created_at: '',
    updated_at: '',
  },
  {
    id: 'r3',
    name: 'Super Admin',
    slug: 'super-admin',
    description: null,
    is_system: true,
    created_at: '',
    updated_at: '',
  },
]

describe('UsersPage regression — SUPER_ADMIN role option gating (KDL-20 H4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  function setupStore(slug: 'admin' | 'super-admin') {
    const roleMap: Record<string, { id: string; name: string; slug: string }[]> = {
      admin: [{ id: 'r2', name: 'Admin', slug: 'admin' }],
      'super-admin': [{ id: 'r3', name: 'Super Admin', slug: 'super-admin' }],
    }
    useAuthStore.setState({
      user: { ...baseUser, id: 'current', roles: roleMap[slug]! },
      accessToken: 'access-token',
      isAuthenticated: true,
      isLoading: false,
    })
  }

  function mockApis() {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/users') {
        return Promise.resolve({
          data: { data: { users: [baseUser], pagination: { total: 1, pages: 1 } } },
        } as any)
      }
      if (url === '/roles') {
        return Promise.resolve({
          data: { data: { roles: mockRoles } },
        } as any)
      }
      if (url === '/permissions/matrix') {
        return Promise.resolve({
          data: { data: { matrix: [] } },
        } as any)
      }
      if (url === '/auth/me/permissions') {
        return Promise.resolve({
          data: {
            data: {
              permissions: ['users:view', 'users:edit', 'users:create', 'users:delete'],
              roles: ['admin'],
              bypass: false,
            },
          },
        } as any)
      }
      return Promise.resolve({ data: { data: {} } } as any)
    })
  }

  async function openEditDialog(user: ReturnType<typeof userEvent.setup>) {
    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /edit test user/i }))

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  }

  it('hides SUPER_ADMIN role option for non-super admin users', async () => {
    const user = userEvent.setup()
    setupStore('admin')
    mockApis()
    render(<UsersPage />)

    await openEditDialog(user)

    await waitFor(() => {
      const dialog = screen.getByRole('dialog')
      expect(within(dialog).getByText('User')).toBeInTheDocument()
    })

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByText('Super Admin')).not.toBeInTheDocument()
    expect(within(dialog).getByText('User')).toBeInTheDocument()
    expect(within(dialog).getByText('Admin')).toBeInTheDocument()
  })

  it('shows SUPER_ADMIN role option for super admin users', async () => {
    const user = userEvent.setup()
    setupStore('super-admin')
    mockApis()
    render(<UsersPage />)

    await openEditDialog(user)

    await waitFor(() => {
      const dialog = screen.getByRole('dialog')
      expect(within(dialog).getByText('Super Admin')).toBeInTheDocument()
    })
  })
})
