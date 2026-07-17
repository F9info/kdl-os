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
  key: vi.fn(() => null),
  length: 0,
}

describe('auth store regression — zustand rehydration resets isLoading (KDL-20 H2)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    for (const key of Object.keys(storage)) delete storage[key]
    vi.stubGlobal('localStorage', localStorageMock)
  })

  it('leaves isLoading true when persisted state is authenticated', async () => {
    storage['kdl-auth'] = JSON.stringify({
      state: {
        user: { id: 'u1', email: 'admin@kdl.com', name: 'Admin', role: 'ADMIN' },
        isAuthenticated: true,
      },
      version: 0,
    })

    const { useAuthStore } = await import('@/stores/auth.store')

    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(useAuthStore.getState().isLoading).toBe(true)
  })

  it('sets isLoading false when persisted state is not authenticated', async () => {
    storage['kdl-auth'] = JSON.stringify({
      state: { user: null, isAuthenticated: false },
      version: 0,
    })

    const { useAuthStore } = await import('@/stores/auth.store')

    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(useAuthStore.getState().isLoading).toBe(false)
  })
})
