import { describe, it, expect, vi, beforeEach } from 'vitest'
import { formatDate } from '@/lib/utils'

describe('formatDate regression (KDL-20/KDL-22)', () => {
  it('returns em dash instead of throwing on invalid date', () => {
    expect(formatDate('not-a-date')).toBe('—')
    expect(formatDate('')).toBe('—')
    expect(formatDate(new Date('invalid') as unknown as string)).toBe('—')
  })

  it('formats valid ISO strings', () => {
    const formatted = formatDate('2026-01-15T00:00:00.000Z')
    expect(formatted).not.toBe('—')
    expect(formatted).toMatch(/Jan/)
  })
})
