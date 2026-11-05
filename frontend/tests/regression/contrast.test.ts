import { describe, it, expect } from 'vitest'
import { contrastRatio } from '@/admin/lib/contrast'

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for identical colours', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5)
  })
  it('is symmetric and flags the classic failing grey-on-white pair below 4.5', () => {
    const r = contrastRatio('#999999', '#ffffff')!
    expect(r).toBeCloseTo(contrastRatio('#ffffff', '#999999')!, 5)
    expect(r).toBeLessThan(4.5)
  })
  it('returns null for non 6-digit hex values', () => {
    expect(contrastRatio('#fff', '#000000')).toBeNull()
    expect(contrastRatio('rgba(0,0,0,1)', '#ffffff')).toBeNull()
  })
})
