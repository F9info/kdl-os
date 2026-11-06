import { describe, it, expect } from 'vitest'
import { safeHref } from '@/frontend/lib/safe-href'

describe('safeHref', () => {
  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    '  javascript:alert(1)',
    'java\tscript:alert(1)',
    'java\nscript:alert(1)',
    'java script:alert(1)',
    '\u0001javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
  ])('turns %j into a harmless "#"', (url) => {
    expect(safeHref(url)).toBe('#')
  })

  it.each([
    'https://example.com/a?b=c',
    'http://example.com',
    'mailto:hi@example.com',
    'tel:+911234567890',
    '#contact',
    '/p/about',
    '/',
    'about',
    '?x=1',
  ])('keeps %j as it is', (url) => {
    expect(safeHref(url)).toBe(url)
  })

  it('uses the fallback for empty or missing values', () => {
    expect(safeHref('')).toBe('#')
    expect(safeHref('   ')).toBe('#')
    expect(safeHref(undefined)).toBe('#')
    expect(safeHref(null, '/home')).toBe('/home')
  })
})
