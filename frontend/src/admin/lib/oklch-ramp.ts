// Client-side port of backend/src/modules/brand-kit/palette.js's ramp math
// (KDL-558 row 2 — editable Palette stage). Ported verbatim so a user editing
// a base hex regenerates the exact same 10-step OKLCH ramp shape the backend
// extraction produces — same sRGB<->OKLab<->OKLCH math, same gamut-mapping by
// chroma reduction at constant L+H (never per-channel clamp, which would
// shift hues), same bell-curve chroma profile. Pure functions, no I/O.

const linearize = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))

const delinearize = (c: number) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055

const linearToOklab = (r: number, g: number, b: number): [number, number, number] => {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
  const lp = Math.cbrt(l)
  const mp = Math.cbrt(m)
  const sp = Math.cbrt(s)
  return [
    0.2104542553 * lp + 0.793617785 * mp - 0.0040720468 * sp,
    1.9779984951 * lp - 2.428592205 * mp + 0.4505937099 * sp,
    0.0259040371 * lp + 0.7827717662 * mp - 0.808675766 * sp,
  ]
}

const oklabToLinear = (L: number, a: number, b: number): [number, number, number] => {
  const lp = L + 0.3963377774 * a + 0.2158037573 * b
  const mp = L - 0.1055613458 * a - 0.0638541728 * b
  const sp = L - 0.0894841775 * a - 1.291485548 * b
  return [
    4.0767416621 * lp ** 3 - 3.3077115913 * mp ** 3 + 0.2309699292 * sp ** 3,
    -1.2684380046 * lp ** 3 + 2.6097574011 * mp ** 3 - 0.3413193965 * sp ** 3,
    -0.0041960863 * lp ** 3 - 0.7034186147 * mp ** 3 + 1.707614701 * sp ** 3,
  ]
}

export const oklabToOklch = (L: number, a: number, b: number): [number, number, number] => {
  const C = Math.sqrt(a * a + b * b)
  const H = (Math.atan2(b, a) * 180) / Math.PI
  return [L, C, H < 0 ? H + 360 : H]
}

const oklchToOklab = (L: number, C: number, H: number): [number, number, number] => {
  const hRad = (H * Math.PI) / 180
  return [L, C * Math.cos(hRad), C * Math.sin(hRad)]
}

export const srgbToOklch = (r: number, g: number, b: number): [number, number, number] => {
  const [L, a, ob] = linearToOklab(linearize(r / 255), linearize(g / 255), linearize(b / 255))
  return oklabToOklch(L, a, ob)
}

const oklchToSrgb255 = (L: number, C: number, H: number): [number, number, number] => {
  const [la, a, b] = oklchToOklab(L, C, H)
  const [lr, lg, lb] = oklabToLinear(la, a, b)
  return [
    Math.round(Math.min(255, Math.max(0, delinearize(lr) * 255))),
    Math.round(Math.min(255, Math.max(0, delinearize(lg) * 255))),
    Math.round(Math.min(255, Math.max(0, delinearize(lb) * 255))),
  ]
}

const isInGamut = (lr: number, lg: number, lb: number) =>
  lr >= 0 && lr <= 1 && lg >= 0 && lg <= 1 && lb >= 0 && lb <= 1

const oklchToGamutSrgb = (L: number, C: number, H: number): [number, number, number] => {
  const [la, a, b] = oklchToOklab(L, C, H)
  const [lr, lg, lb] = oklabToLinear(la, a, b)
  if (isInGamut(lr, lg, lb)) return oklchToSrgb255(L, C, H)

  let lo = 0
  let hi = C
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2
    const [lla, aa, bb] = oklchToOklab(L, mid, H)
    const [llr, llg, llb] = oklabToLinear(lla, aa, bb)
    if (isInGamut(llr, llg, llb)) lo = mid
    else hi = mid
  }
  return oklchToSrgb255(L, (lo + hi) / 2, H)
}

export const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '')
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16
  )
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export const rgbToHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')

const RAMP_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const
const RAMP_L = [0.97, 0.93, 0.85, 0.76, 0.66, 0.57, 0.48, 0.39, 0.31, 0.23]

const chromaBell = (idx: number, peakIdx: number) => {
  const half = (RAMP_L.length - 1) / 2
  const dist = Math.abs(idx - peakIdx) / half
  return 0.25 + 0.75 * Math.max(0, 1 - dist)
}

export interface BuiltRamp {
  ramp: Record<string, string>
  anchorStep: string
}

// lch: the [L, C, H] OKLCH triple for brandHex (pass srgbToOklch(...hexToRgb(brandHex)) when
// regenerating from a freshly-edited hex — L is re-derived from brandHex regardless).
export function buildRamp(lch: [number, number, number], brandHex: string): BuiltRamp {
  const [, brandC, brandH] = lch
  const [brandR, brandG, brandB] = hexToRgb(brandHex)
  const brandL = srgbToOklch(brandR, brandG, brandB)[0]

  let anchorIdx = 0
  let minLDiff = Infinity
  for (let i = 0; i < RAMP_L.length; i++) {
    const d = Math.abs(RAMP_L[i]! - brandL)
    if (d < minLDiff) {
      minLDiff = d
      anchorIdx = i
    }
  }

  const result: Record<string, string> = {}
  for (let i = 0; i < RAMP_STEPS.length; i++) {
    const step = RAMP_STEPS[i]!
    if (i === anchorIdx) {
      result[step] = brandHex
    } else {
      const L = RAMP_L[i]!
      const C = brandC * chromaBell(i, anchorIdx)
      const [r, g, b] = oklchToGamutSrgb(L, C, brandH)
      result[step] = rgbToHex(r, g, b)
    }
  }

  return { ramp: result, anchorStep: String(RAMP_STEPS[anchorIdx]!) }
}

// Convenience: regenerate a full ramp straight from a hex (the common case —
// a user typed or picked a new base color and there's no prior OKLCH triple
// worth reusing, since buildRamp re-derives L from brandHex anyway and reuses
// only the C/H from the passed lch).
export function rampFromHex(hex: string): BuiltRamp {
  const lch = srgbToOklch(...hexToRgb(hex))
  return buildRamp(lch, hex)
}
