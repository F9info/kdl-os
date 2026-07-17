import { describe, it, expect, vi, beforeEach } from 'vitest'

const storage: Record<string, string> = {}

const localStorageMock = {
  getItem: vi.fn((key: string) => storage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    storage[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete storage[key]
  }),
  clear: vi.fn(() => {
    for (const key of Object.keys(storage)) delete storage[key]
  }),
} as unknown as Storage

describe('auth store regression — no token in localStorage (KDL-20 C1/C2)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock)
    for (const key of Object.keys(storage)) delete storage[key]
    vi.clearAllMocks()
  })

  it('does not persist accessToken to localStorage', async () => {
    const { useAuthStore } = await import('@/stores/auth.store')

    const partialize = useAuthStore.persist.getOptions().partialize as unknown as (
      state: Record<string, unknown>
    ) => Record<string, unknown>
    const persisted = partialize({
      user: {
        id: 'u1',
        email: 'u@kdl.com',
        name: 'User',
        role: 'USER',
        is_active: true,
        created_at: '2026-01-01',
      },
      accessToken: 'secret-access-token',
      isAuthenticated: true,
      isLoading: false,
    })

    expect(persisted).toHaveProperty('user')
    expect(persisted.user).toMatchObject({ id: 'u1' })
    expect(persisted).toHaveProperty('isAuthenticated', true)
    expect(persisted).not.toHaveProperty('accessToken')
  })
})
