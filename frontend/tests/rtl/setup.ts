import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class IntersectionObserverMock implements IntersectionObserver {
  constructor(
    public callback: IntersectionObserverCallback,
    public options?: IntersectionObserverInit
  ) {}
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
  root: Element | null = null
  rootMargin = ''
  thresholds: number[] = []
}

;(
  globalThis as unknown as typeof globalThis & { IntersectionObserver: typeof IntersectionObserver }
).IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo

  Element.prototype.setPointerCapture =
    vi.fn() as unknown as typeof Element.prototype.setPointerCapture
  Element.prototype.releasePointerCapture =
    vi.fn() as unknown as typeof Element.prototype.releasePointerCapture
  Element.prototype.hasPointerCapture = vi.fn(
    () => false
  ) as unknown as typeof Element.prototype.hasPointerCapture
  Element.prototype.scrollIntoView = vi.fn() as unknown as typeof Element.prototype.scrollIntoView
}

vi.mock('next/navigation', () => import('../__mocks__/next-navigation'))
vi.mock('next/link', () => import('../__mocks__/next-link'))
