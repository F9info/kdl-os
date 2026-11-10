// Colour sets for the Landing blocks. Each block takes a `palette` choice, so one change recolours a
// whole section. `hero` is the big background; `strong` is the accent that still reads on white
// (headline highlights on a light hero use `accent`, everything on white uses `strong`).
export interface Palette {
  label: string
  /** Hero background (any CSS background value). */
  hero: string
  /** True when the hero is dark enough for white text. */
  dark: boolean
  ink: string
  body: string
  /** Highlight colour on the hero. */
  accent: string
  /** Accent for use on white or soft backgrounds. */
  strong: string
  pill: string
  button: string
  buttonText: string
  soft: string
  /** Gradient for the rings and glow behind pictures. */
  ring: string
  /** Gradient for the call-to-action band. */
  band: string
  /** Footer background, and the accent colour used on it. */
  footer: string
  footerAccent: string
}

export const PALETTES = {
  sunset: {
    label: 'Sunset (pink, orange, lime)',
    hero: 'linear-gradient(120deg,#fff1f0 0%,#ffe2cf 40%,#fff3b8 75%,#eaf8b8 100%)',
    dark: false,
    ink: '#1b1035',
    body: '#5b5170',
    accent: '#ff4f5e',
    strong: '#e8344a',
    pill: '#ff7a3d',
    button: '#2563eb',
    buttonText: '#ffffff',
    soft: '#fff4ee',
    ring: 'linear-gradient(135deg,#ff9a9e,#fecf8e,#f9f586)',
    band: 'linear-gradient(120deg,#ff7a3d,#ff4f8b)',
    footer: '#1b1035',
    footerAccent: '#ff8a5c',
  },
  ocean: {
    label: 'Ocean (sky, indigo, lilac)',
    hero: 'linear-gradient(120deg,#e0f2fe 0%,#e0e7ff 50%,#fae8ff 100%)',
    dark: false,
    ink: '#0f1b3d',
    body: '#506085',
    accent: '#4f46e5',
    strong: '#4f46e5',
    pill: '#0ea5e9',
    button: '#4f46e5',
    buttonText: '#ffffff',
    soft: '#eef4ff',
    ring: 'linear-gradient(135deg,#7dd3fc,#a5b4fc,#f0abfc)',
    band: 'linear-gradient(120deg,#0ea5e9,#6366f1)',
    footer: '#0f1b3d',
    footerAccent: '#7dd3fc',
  },
  violet: {
    label: 'Midnight violet (dark)',
    hero: 'radial-gradient(900px 500px at 85% 10%,rgba(168,85,247,.55),transparent 60%),radial-gradient(700px 400px at 0% 100%,rgba(236,72,153,.35),transparent 60%),linear-gradient(160deg,#0b0620 0%,#1a0b3d 60%,#2b0f5e 100%)',
    dark: true,
    ink: '#ffffff',
    body: '#cdc6e6',
    accent: '#f0abfc',
    strong: '#9333ea',
    pill: '#a855f7',
    button: 'linear-gradient(120deg,#a855f7,#ec4899)',
    buttonText: '#ffffff',
    soft: '#f6f0ff',
    ring: 'linear-gradient(135deg,#a855f7,#ec4899,#f59e0b)',
    band: 'linear-gradient(120deg,#6d28d9,#db2777)',
    footer: '#0b0620',
    footerAccent: '#f0abfc',
  },
  aurora: {
    label: 'Aurora (mint, aqua, periwinkle)',
    hero: 'linear-gradient(130deg,#d9fbe9 0%,#cdf4ff 50%,#e4e1ff 100%)',
    dark: false,
    ink: '#0b2b2e',
    body: '#476466',
    accent: '#0d9488',
    strong: '#0d9488',
    pill: '#0d9488',
    button: '#0f766e',
    buttonText: '#ffffff',
    soft: '#ecfdf9',
    ring: 'linear-gradient(135deg,#6ee7b7,#67e8f9,#a5b4fc)',
    band: 'linear-gradient(120deg,#0d9488,#2563eb)',
    footer: '#0b2b2e',
    footerAccent: '#5eead4',
  },
  blaze: {
    label: 'Blaze (orange to magenta)',
    hero: 'linear-gradient(135deg,#ff7a1a 0%,#ff3d6e 55%,#b5179e 100%)',
    dark: true,
    ink: '#ffffff',
    body: 'rgba(255,255,255,.9)',
    accent: '#fff3b0',
    strong: '#e11d48',
    pill: 'rgba(255,255,255,.24)',
    button: '#ffffff',
    buttonText: '#c2185b',
    soft: '#fff1f4',
    ring: 'linear-gradient(135deg,#ffd166,#ff8fab,#c77dff)',
    band: 'linear-gradient(120deg,#ff7a1a,#ff3d6e)',
    footer: '#2a0a2e',
    footerAccent: '#ffd166',
  },
  // Built from Application Identity: BrandScope (index.tsx) sets --lp-1 (primary) and --lp-2 (secondary) on every
  // Landing block, so this set follows Settings > Identity. The fallbacks are the Identity defaults.
  brand: {
    label: 'Your brand colours (from Identity)',
    hero: 'linear-gradient(135deg,var(--lp-1,#2c52a3) 0%,var(--lp-2,#132b60) 100%)',
    dark: true,
    ink: '#ffffff',
    body: 'rgba(255,255,255,.9)',
    accent: 'color-mix(in srgb,var(--lp-1,#2c52a3) 35%,#ffffff)',
    strong: 'var(--lp-1,#2c52a3)',
    pill: 'rgba(255,255,255,.22)',
    button: '#ffffff',
    buttonText: 'var(--lp-1,#2c52a3)',
    soft: 'color-mix(in srgb,var(--lp-1,#2c52a3) 8%,#ffffff)',
    ring: 'linear-gradient(135deg,var(--lp-1,#2c52a3),var(--lp-2,#132b60))',
    band: 'linear-gradient(120deg,var(--lp-1,#2c52a3),var(--lp-2,#132b60))',
    footer: 'color-mix(in srgb,var(--lp-2,#132b60) 88%,#000000)',
    footerAccent: 'color-mix(in srgb,var(--lp-1,#2c52a3) 40%,#ffffff)',
  },
} satisfies Record<string, Palette>

export type PaletteKey = keyof typeof PALETTES

export const paletteOf = (key: string | undefined): Palette =>
  PALETTES[(key as PaletteKey) in PALETTES ? (key as PaletteKey) : 'sunset']

export const PALETTE_OPTIONS = (Object.keys(PALETTES) as PaletteKey[]).map((k) => ({
  label: PALETTES[k].label,
  value: k,
}))
