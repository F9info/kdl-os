// WCAG 2.x contrast ratio between two #rrggbb colours (null if either is not 6-digit hex).
const HEX6 = /^#[0-9a-fA-F]{6}$/

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

export function contrastRatio(a: string, b: string): number | null {
  if (!HEX6.test(a) || !HEX6.test(b)) return null
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}
