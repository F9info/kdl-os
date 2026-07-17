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
