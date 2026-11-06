import { describe, it, expect, afterEach } from 'vitest'
import { applyResolvedTheme } from '@/components/providers/ThemeEngineProvider'

// The OS being dark must not put a light Active Theme into dark mode: the `dark` class (Tailwind
// `dark:` + `.dark` CSS) and `data-theme` come from the same resolved theme.
function setOsScheme(scheme: 'dark' | 'light') {
  window.matchMedia = ((q: string) => ({
    matches: q.includes('prefers-color-scheme: light') ? scheme === 'light' : false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}

describe('applyResolvedTheme', () => {
  afterEach(() => {
    document.documentElement.className = ''
    document.documentElement.removeAttribute('data-theme')
  })

  it('a light Active Theme clears a dark class left by a dark OS', () => {
    setOsScheme('dark')
    document.documentElement.classList.add('dark')
    applyResolvedTheme('light')
    const root = document.documentElement
    expect(root.dataset.theme).toBe('light')
    expect(root.classList.contains('dark')).toBe(false)
    expect(root.classList.contains('light')).toBe(true)
  })

  it('a dark Active Theme sets the dark class whatever the OS says', () => {
    setOsScheme('light')
    applyResolvedTheme('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('"system" follows the OS in both attribute and class', () => {
    setOsScheme('dark')
    applyResolvedTheme('system')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    setOsScheme('light')
    applyResolvedTheme('system')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
