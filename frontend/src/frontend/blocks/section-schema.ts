// Section schema metadata (T7.1): for every block ("section"), each field's kind and which editor
// tab it belongs to, written down explicitly instead of guessed from prop names in the editor.
//
// `section-schemas.json` (next to this file) is the committed result. It is GENERATED from the block
// library by tests/rtl/regression/SectionSchemas.test.tsx (run with UPDATE_SECTION_SCHEMAS=1 after
// changing a block's fields) and that same test fails when the file is out of date. The backend reads
// the same file to check pages before they are published (page-builder/validate.js).
import schemas from './section-schemas.json'

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'image'
  | 'link'
  | 'color'
  | 'toggle'
  | 'select'
  | 'number'
  | 'list'
  | 'object'
  | 'slot'
  | 'custom'
export type FieldTab = 'content' | 'style'

export interface SectionField {
  kind: FieldKind
  tab: FieldTab
  /** Kept in the block (saved pages may carry a value) but not shown in the editor panel. */
  hidden?: boolean
  /** Allowed values of a `select` / `toggle`. */
  options?: (string | number | boolean)[]
}
export interface SectionSchema {
  label: string
  fields: Record<string, SectionField>
}
export type SectionSchemas = Record<string, SectionSchema>

// ── The rules the schema is generated from (used ONLY by the generator and as a fallback for a
// block that has no schema entry, such as one registered after the file was generated) ────────────

const STYLE_FIELD_KEYS = new Set(['padding', 'background', 'align', 'variant', 'spacing', 'gap'])

/**
 * Name-based default for the tab of a field: Style (appearance/behaviour, not what it says) when it
 * is one of the exact names above, ends in "Color", starts with "show", or starts with `slider`
 * (carousel knobs) / `typo` (per-element font size/weight/colour). Every pack component names its
 * padding / background / align / variant / colour / visibility fields this way. The editor renders
 * `slider*` and `typo*` fields in their own collapsible groups. `hideOn*` (per-device visibility,
 * added to every block by device-visibility.tsx) is Style too.
 */
export function isStyleField(key: string): boolean {
  return (
    STYLE_FIELD_KEYS.has(key) ||
    /Color$/.test(key) ||
    /^show[A-Z]/.test(key) ||
    /^slider/.test(key) ||
    /^typo/.test(key) ||
    /^hideOn[A-Z]/.test(key)
  )
}

/**
 * Fields kept in a component's `fields` (Puck needs an entry per prop, and a saved page may still
 * carry a value) but hidden from the editor panel, per component: ConstructionHero's
 * variant/primaryColor/secondaryColor are redundant now that the Slider Settings / Typography
 * accordions cover styling.
 */
export const HIDDEN_FIELDS: Record<string, Set<string>> = {
  ConstructionHero: new Set(['variant', 'primaryColor', 'secondaryColor']),
  ConstructionOurBrands: new Set([
    'tab1Label',
    'tab1Groups',
    'tab2Label',
    'tab2Groups',
    'tab3Label',
    'tab3Groups',
  ]),
}

interface PuckFieldLike {
  type?: string
  options?: { value: unknown }[]
}

/** Kind of a Puck field. Text-like fields are told apart by what they are named for. */
export function fieldKind(key: string, field: PuckFieldLike): FieldKind {
  switch (field.type) {
    case 'textarea':
      return 'textarea'
    case 'number':
      return 'number'
    case 'array':
      return 'list'
    case 'object':
      return 'object'
    case 'slot':
      return 'slot'
    case 'radio':
    case 'select': {
      const values = (field.options ?? []).map((o) => o.value)
      return values.length > 0 && values.every((v) => typeof v === 'boolean') ? 'toggle' : 'select'
    }
    default: {
      // 'text' and 'custom' (image / colour pickers are custom fields)
      if (/(image|logo|photo|picture|avatar|icon|src)(url)?$/i.test(key)) return 'image'
      if (/color$/i.test(key)) return 'color'
      if (/(href|link|url)$/i.test(key)) return 'link'
      return field.type === 'custom' ? 'custom' : 'text'
    }
  }
}

/** Builds the schema of every component from a Puck config's `components`. */
export function buildSectionSchemas(
  components: Record<string, { label?: string; fields?: Record<string, PuckFieldLike> }>
): SectionSchemas {
  const out: SectionSchemas = {}
  for (const type of Object.keys(components).sort()) {
    const c = components[type]!
    const fields: Record<string, SectionField> = {}
    for (const key of Object.keys(c.fields ?? {}).sort()) {
      const f = c.fields![key]!
      const entry: SectionField = {
        kind: fieldKind(key, f),
        tab: isStyleField(key) ? 'style' : 'content',
      }
      if (HIDDEN_FIELDS[type]?.has(key)) entry.hidden = true
      if (entry.kind === 'select' || entry.kind === 'toggle') {
        entry.options = (f.options ?? []).map((o) => o.value as string | number | boolean)
      }
      fields[key] = entry
    }
    out[type] = { label: c.label ?? type, fields }
  }
  return out
}

// ── Reading the committed schema ────────────────────────────────────────────────────────────────

export const sectionSchemas = schemas as unknown as SectionSchemas

/** Which editor tab a field is on: the schema says; a block without an entry falls back to the name rule. */
export function fieldTab(type: string, key: string): FieldTab {
  return sectionSchemas[type]?.fields[key]?.tab ?? (isStyleField(key) ? 'style' : 'content')
}

export function isFieldHidden(type: string, key: string): boolean {
  const known = sectionSchemas[type]?.fields[key]
  return known ? !!known.hidden : !!HIDDEN_FIELDS[type]?.has(key)
}
