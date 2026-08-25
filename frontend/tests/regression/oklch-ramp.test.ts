/**
 * KDL-558 row 2 — client-side port of backend/src/modules/brand-kit/palette.js's
 * ramp math. Mirrors the invariants backend/src/modules/brand-kit/palette.test.js
 * asserts on buildRamp, to confirm the port is faithful.
 */
import { describe, it, expect } from 'vitest'
import { buildRamp, rampFromHex, hexToRgb, rgbToHex, srgbToOklch } from '@/lib/oklch-ramp'

describe('hexToRgb / rgbToHex', () => {
  it('round-trips a 6-digit hex', () => {
    expect(rgbToHex(...hexToRgb('#1a73e8'))).toBe('#1a73e8')
  })

  it('expands a 3-digit hex', () => {
    expect(hexToRgb('#0f0')).toEqual([0, 255, 0])
  })
})

describe('rampFromHex', () => {
  it("the anchor step's ramp value equals the input hex exactly", () => {
    const { ramp, anchorStep } = rampFromHex('#1a73e8')
    expect(ramp[anchorStep]).toBe('#1a73e8')
  })

  it('ramp keys are exactly the 10 canonical steps', () => {
    const { ramp } = rampFromHex('#ec1b34')
    expect(
      Object.keys(ramp)
        .map(Number)
        .sort((a, b) => a - b)
    ).toEqual([50, 100, 200, 300, 400, 500, 600, 700, 800, 900])
  })

  it('every ramp value is a valid 6-digit hex string', () => {
    const { ramp } = rampFromHex('#4caf50')
    for (const hex of Object.values(ramp)) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('lightness is monotonically decreasing from step 50 to step 900', () => {
    const { ramp } = rampFromHex('#8844cc')
    const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]
    const lightnesses = steps.map((s) => srgbToOklch(...hexToRgb(ramp[String(s)]!))[0])
    for (let i = 1; i < lightnesses.length; i++) {
      expect(lightnesses[i]!).toBeLessThanOrEqual(lightnesses[i - 1]! + 1e-6)
    }
  })

  it('is deterministic — same hex in, same ramp out', () => {
    expect(rampFromHex('#ffcd00')).toEqual(rampFromHex('#ffcd00'))
  })
})

describe('buildRamp — matches backend palette.js contract', () => {
  it('accepts an explicit [L, C, H] and brandHex, using brandHex verbatim at the anchor', () => {
    const lch = srgbToOklch(...hexToRgb('#0e6e5c'))
    const { ramp, anchorStep } = buildRamp(lch, '#0e6e5c')
    expect(ramp[anchorStep]).toBe('#0e6e5c')
  })
})
