// Heading / body font helpers for the Simple Theme view (no React, no I/O).
//
// The typography pane stores one `typo_table` field per device: a JSON array of
// rows { name, size, sizeUnit, family, weight, lineHeight, letterSpacing } —
// "H1 (Title)", "H2" … "H6", "Paragraph", "Body", "List (li)", "Small Text",
// "Navigation". The two quick selects rewrite `family` on the heading rows
// (H1–H6) and on every other row (body) across all of those tables.

export interface FontPick {
  heading?: string
  body?: string
}

export type Row = Record<string, unknown>

const isHeadingRow = (row: Row) =>
  typeof row.name === 'string' && /^h[1-6]\b/i.test(row.name.trim())

function parseRows(value: string | null | undefined): Row[] | null {
  try {
    const rows: unknown = JSON.parse(value ?? '')
    return Array.isArray(rows) ? (rows as Row[]) : null
  } catch {
    return null
  }
}

/** Choice list from a field's `options` (the API sends a JSON string; objects are accepted too). */
export function fontChoices(options: unknown): string[] {
  let parsed: unknown = options
  if (typeof options === 'string') {
    try {
      parsed = JSON.parse(options)
    } catch {
      return []
    }
  }
  const choices = (parsed as { choices?: unknown } | null)?.choices
  return Array.isArray(choices) ? choices.filter((c): c is string => typeof c === 'string') : []
}

/** Heading and body family as the first table that has rows currently says. */
export function currentFonts(tables: (string | null | undefined)[]): FontPick {
  for (const value of tables) {
    const rows = parseRows(value)
    if (!rows?.length) continue
    const family = (row: Row | undefined) =>
      typeof row?.family === 'string' && row.family ? row.family : undefined
    return {
      heading: family(rows.find(isHeadingRow)),
      body: family(rows.find((r) => !isHeadingRow(r))),
    }
  }
  return {}
}

/**
 * `value` with the heading / body family replaced. Returns `value` itself when
 * nothing changes (or when it is not a table), so "did this field change" is a
 * plain string comparison.
 */
export function applyFonts(value: string | null, pick: FontPick): string | null {
  const rows = parseRows(value)
  if (!rows) return value
  let changed = false
  const next = rows.map((row) => {
    const family = isHeadingRow(row) ? pick.heading : pick.body
    if (!family || row.family === family) return row
    changed = true
    return { ...row, family }
  })
  return changed ? JSON.stringify(next) : value
}

/** Individual family names in a (possibly comma-separated) value, e.g. "Poppins, Sora". */
export const familyNames = (list?: string): string[] =>
  (list ?? '')
    .split(',')
    .map((f) => f.trim().replace(/["\\]/g, ''))
    .filter(Boolean)

// Families the operating system supplies: there is no Google stylesheet to add for them.
const OS_FAMILIES = new Set(['sf pro', 'system ui'])

/** Google Fonts stylesheet for `family` (the URL @/lib/load-google-font previews it with). */
export const googleFontUrl = (family: string): string =>
  `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@400;500;600;700&display=swap`

/**
 * The Custom Fonts field (a JSON list of { type, name, src }) with a Google row added for
 * each of `families` it does not list yet. The live site loads only what that list names, so
 * a font that is in the typography table but not in it falls back to a default font there.
 * Returns `value` itself when nothing is added (or it is not a font list), like applyFonts.
 */
export function withGoogleFonts(value: string | null, families: string[]): string | null {
  const rows = parseRows(value?.trim() ? value : '[]')
  if (!rows) return value
  const key = (name: unknown) => `${name ?? ''}`.trim().toLowerCase()
  const listed = new Set(rows.map((r) => key((r as Row | null)?.name)))
  const added = new Map<string, string>()
  for (const family of families) {
    if (!OS_FAMILIES.has(key(family)) && !listed.has(key(family))) added.set(key(family), family)
  }
  if (!added.size) return value
  const google = [...added.values()].map((name) => ({
    type: 'google',
    name,
    src: googleFontUrl(name),
  }))
  return JSON.stringify([...rows, ...google])
}

// Quoted so "Source Sans 3" stays valid CSS; a comma list becomes a fallback stack.
const quoteFamilies = (list: string) =>
  familyNames(list)
    .map((f) => `"${f}"`)
    .join(', ')

/**
 * Rows of the first table that has any, with the picked fonts applied: the
 * typography the site will have once this is published.
 */
export function draftRows(tables: (string | null | undefined)[], pick: FontPick): Row[] {
  for (const value of tables) {
    const rows = parseRows(applyFonts(value ?? null, pick))
    if (rows?.length) return rows
  }
  return []
}

// th-typography.css's `--th-typo-<alias>-family` for a table row name ("H1 (Title)",
// "List (li)", "Navigation" …), keyed by the row name's first word.
const WORD_ALIAS: Record<string, string> = {
  paragraph: 'paragraph',
  body: 'body',
  list: 'list',
  small: 'small',
  navigation: 'nav',
}
const aliasOf = (name: string): string | null => {
  const heading = /^h([1-6])\b/i.exec(name.trim())
  if (heading) return `h${heading[1]}`
  return WORD_ALIAS[name.trim().split(/\s+/)[0]?.toLowerCase() ?? ''] ?? null
}

/**
 * Overrides for the `--th-typo-*-family` aliases th-typography.css maps h1–h6,
 * p, li, small and nav onto, one per table row, so a wrapper element shows these
 * fonts without touching the admin's own typography.
 */
export function fontCssVars(rows: Row[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const row of rows) {
    const alias = typeof row.name === 'string' ? aliasOf(row.name) : null
    const family = typeof row.family === 'string' ? quoteFamilies(row.family) : ''
    if (alias && family) out[`--th-typo-${alias}-family`] = family
  }
  return out
}
