import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { safeHref } from '@/frontend/lib/safe-href'

describe('payments page proof link', () => {
  it('never renders a raw API-supplied url', () => {
    const src = readFileSync('src/app/admin/membership/payments/page.tsx', 'utf8')
    expect(src).toContain('href={safeHref(p.proof_url)}')
    expect(src).not.toMatch(/href=\{p\.proof_url\}/)
  })
  it('neutralises javascript: proof urls', () => {
    expect(safeHref('javascript:alert(1)')).toBe('#')
    expect(safeHref('https://x.test/p.png')).toBe('https://x.test/p.png')
  })
})
