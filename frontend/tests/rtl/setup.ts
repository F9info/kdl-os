import '@testing-library/jest-dom/vitest'
import { vi, beforeEach } from 'vitest'

// Node.js 26 defines globalThis.localStorage as an accessor returning undefined
// (no --localstorage-file). The property is configurable, so we replace the
// descriptor with a working in-memory implementation before jsdom or any test
// code accesses it. Without this, Zustand persist middleware throws
// "Cannot read properties of undefined (reading 'setItem')".
{
  const _desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  if (_desc?.get) {
    const _store: Record<string, string> = {}
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: {
        getItem: (key: string) =>
          Object.prototype.hasOwnProperty.call(_store, key) ? _store[key] : null,
        setItem: (key: string, value: string) => {
          _store[key] = String(value)
        },
        removeItem: (key: string) => {
          delete _store[key]
        },
        clear: () => {
          for (const k of Object.keys(_store)) delete _store[k]
        },
        key: (n: number) => Object.keys(_store)[n] ?? null,
        get length() {
          return Object.keys(_store).length
        },
      },
    })
  }
}

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

// Clear localStorage before each test so components that persist UI state
// (e.g. WebsiteStage) always start from their defaults.
beforeEach(() => {
  localStorage.clear()
})
