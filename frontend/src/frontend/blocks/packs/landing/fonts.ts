// Headline and body font pairings for the Landing blocks. The fonts themselves are loaded once in
// app/layout.tsx (next/font, self-hosted) and exposed as CSS variables; these strings use them.
export interface FontPair {
  label: string
  display: string
  body: string
  /** Lobster only has a regular weight; the others look best bold. */
  weight: number
  tracking: string
}

export const FONT_PAIRS = {
  lobster: {
    label: 'Lobster + Poppins (playful script)',
    display: "var(--font-lobster), 'Lobster', cursive",
    body: 'var(--font-poppins), system-ui, sans-serif',
    weight: 400,
    tracking: '0',
  },
  fraunces: {
    label: 'Fraunces + Poppins (warm serif)',
    display: 'var(--font-fraunces), Georgia, serif',
    body: 'var(--font-poppins), system-ui, sans-serif',
    weight: 700,
    tracking: '-0.01em',
  },
  playfair: {
    label: 'Playfair Display + Poppins (elegant serif)',
    display: 'var(--font-playfair), Georgia, serif',
    body: 'var(--font-poppins), system-ui, sans-serif',
    weight: 700,
    tracking: '-0.01em',
  },
  bricolage: {
    label: 'Bricolage Grotesque + Poppins (modern bold)',
    display: 'var(--font-bricolage), system-ui, sans-serif',
    body: 'var(--font-poppins), system-ui, sans-serif',
    weight: 800,
    tracking: '-0.025em',
  },
} satisfies Record<string, FontPair>

export type FontKey = keyof typeof FONT_PAIRS

export const fontOf = (key: string | undefined): FontPair =>
  FONT_PAIRS[(key as FontKey) in FONT_PAIRS ? (key as FontKey) : 'bricolage']

export const FONT_OPTIONS = (Object.keys(FONT_PAIRS) as FontKey[]).map((k) => ({
  label: FONT_PAIRS[k].label,
  value: k,
}))
