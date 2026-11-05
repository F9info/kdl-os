// Pure palette helpers for the Simple Theme view (no React, no I/O).

import { contrastRatio } from '@/admin/lib/contrast'

export const HEX6 = /^#[0-9a-fA-F]{6}$/

// key → [section slug, field slug] under `webapp.branding.<mode>.`
export const QUICK = [
  { key: 'primary', label: 'Main colour', path: 'brand_colors.primary_color' },
  { key: 'secondary', label: 'Second colour', path: 'brand_colors.secondary_color' },
  { key: 'accent', label: 'Accent', path: 'brand_colors.accent_color' },
  { key: 'highlight', label: 'Highlight', path: 'brand_colors.highlight_color' },
  { key: 'background', label: 'Page background', path: 'surfaces.background_color' },
  { key: 'text', label: 'Text', path: 'text_interaction.text_primary' },
] as const
export type QuickKey = (typeof QUICK)[number]['key']
export type Palette = Record<QuickKey, string>

// Publish never changes the button text colour (it is not a branding field), so the
// site keeps pairing the stock white with whatever Main colour is published. Every main
// colour below reads under it (see contrastWarnings), dark mode included.
export const PRESETS: { name: string; light: Palette; dark: Palette }[] = [
  {
    name: 'Ocean',
    light: {
      primary: '#0369a1',
      secondary: '#0891b2',
      accent: '#7c3aed',
      highlight: '#f59e0b',
      background: '#f8fafc',
      text: '#0f172a',
    },
    dark: {
      primary: '#0284c7',
      secondary: '#22d3ee',
      accent: '#a78bfa',
      highlight: '#fbbf24',
      background: '#0b1220',
      text: '#e2e8f0',
    },
  },
  {
    name: 'Forest',
    light: {
      primary: '#15803d',
      secondary: '#65a30d',
      accent: '#ca8a04',
      highlight: '#ea580c',
      background: '#f7fbf7',
      text: '#14281d',
    },
    dark: {
      primary: '#16a34a',
      secondary: '#a3e635',
      accent: '#facc15',
      highlight: '#fb923c',
      background: '#0c1a12',
      text: '#e6f4ea',
    },
  },
  {
    name: 'Sunset',
    light: {
      primary: '#ea580c',
      secondary: '#db2777',
      accent: '#ca8a04',
      highlight: '#7c3aed',
      background: '#fffaf5',
      text: '#2b1409',
    },
    dark: {
      primary: '#ea580c',
      secondary: '#f472b6',
      accent: '#fde047',
      highlight: '#a78bfa',
      background: '#1a0f0a',
      text: '#fdeede',
    },
  },
  {
    name: 'Slate',
    light: {
      primary: '#334155',
      secondary: '#64748b',
      accent: '#2563eb',
      highlight: '#f59e0b',
      background: '#f8fafc',
      text: '#0f172a',
    },
    dark: {
      primary: '#64748b',
      secondary: '#cbd5e1',
      accent: '#60a5fa',
      highlight: '#fbbf24',
      background: '#0f172a',
      text: '#f1f5f9',
    },
  },
]

/** White or near-black, whichever reads better on `hex` (WCAG contrast; white when `hex` is not a 6-digit hex). */
export function readableOn(hex: string): string {
  if (!HEX6.test(hex)) return '#ffffff'
  return contrastRatio('#ffffff', hex)! >= contrastRatio('#111111', hex)! ? '#ffffff' : '#111111'
}

/**
 * Custom properties the Tailwind colour tokens read (see tailwind.config.ts) for the
 * six quick colours. These are exactly the fields Publish writes, so the preview never
 * shows a value the site will not get: every other token comes from what is published
 * (the caller's `baseVars`). Empty colours are left out so the published value shows.
 */
export function paletteToCssVars(p: Palette): Record<string, string> {
  const vars: Record<string, string> = {
    '--branding_brand_colors_primary_color': p.primary,
    '--branding_brand_colors_secondary_color': p.secondary,
    '--branding_brand_colors_accent_color': p.accent,
    '--branding_brand_colors_highlight_color': p.highlight,
    '--branding_surfaces_background_color': p.background,
    '--branding_text_interaction_text_primary': p.text,
  }
  return Object.fromEntries(Object.entries(vars).filter(([, v]) => v))
}

export interface ContrastWarning {
  label: string
  ratio: number
  /** Smallest WCAG contrast the pair should reach. */
  min: number
  /** What the user can do about it, when Simple cannot. */
  fix?: string
}

/**
 * Colour pairs the draft makes hard to read. `buttonLabel` is the primary-button text
 * colour as published: Publish never changes it, so it is checked as it stands.
 * (3:1 for the label: it flags clear failures, not a stock theme that sits just under 4.5.)
 */
export function contrastWarnings(p: Palette, buttonLabel?: string | null): ContrastWarning[] {
  const checks: (Omit<ContrastWarning, 'ratio'> & { ratio: number | null })[] = [
    { label: 'Text on the page background', ratio: contrastRatio(p.text, p.background), min: 4.5 },
    {
      label: 'Main colour against the page background',
      ratio: contrastRatio(p.primary, p.background),
      min: 3,
    },
    {
      label: 'Button text on the main colour',
      ratio: contrastRatio(buttonLabel ?? '', p.primary),
      min: 3,
      fix: 'Pick another main colour, or change the button text colour in Advanced, under Buttons.',
    },
  ]
  return checks.filter((c): c is ContrastWarning => c.ratio !== null && c.ratio < c.min)
}

/**
 * CSS custom property the Theme Engine compiles a branding field to, e.g.
 * `webapp.branding.light.brand_colors.primary_color` →
 * `--branding_brand_colors_primary_color` (mirrors backend `toTokenName`).
 */
export function tokenVar(slug: string): string {
  const parts = slug.split('.')
  const name = [parts[1], ...parts.slice(3)]
    .map((s) => (s ?? '').replace(/[^a-z0-9]/gi, '_').toLowerCase())
    .join('_')
  return `--${name}`
}
