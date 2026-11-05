import { vi } from 'vitest'

export const mockPush = vi.fn()
export const mockReplace = vi.fn()
export const mockRefresh = vi.fn()

export function useRouter() {
  return {
    push: mockPush,
    replace: mockReplace,
    refresh: mockRefresh,
    back: vi.fn(),
    forward: vi.fn(),
  }
}

// Tests can set `mockPathname.value` to simulate being on a given route.
export const mockPathname = { value: '/admin/dashboard' }

export function usePathname() {
  return mockPathname.value
}

export function useSearchParams() {
  return new URLSearchParams()
}
