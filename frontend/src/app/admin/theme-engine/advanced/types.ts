// ─────────────────────────────────────────────────────────────────────────────
// API types — shape returned by GET /theme-engine/schema?platform=
// ─────────────────────────────────────────────────────────────────────────────

export interface TEFieldOptions {
  choices?: string[]
  min?: number
  max?: number
  step?: number
  unit?: string
}

export interface TEField {
  id: string
  slug: string
  field_name: string
  input_type: string
  options: TEFieldOptions | null
  alt_text: string | null
  value: string
  default_value: string
  sort: number
  locked_by?: string | null
}

export interface TEGroup {
  id: string
  name: string
  slug: string
  fields: TEField[]
}

export interface TEPane {
  id: string // semantic id (e.g. "branding") — used only for UI/localStorage keys
  type_id: string // Type cuid — the value /values and /reset require
  label: string
  icon: string
  ic?: string // optional accent colour for the sidebar chip (not sent by the API)
  modes: { id: string; label: string }[] | null
  devices: { id: string; label: string }[] | null
  groups: TEGroup[]
}

// Raw wire shapes: the API serializes `field.options` as a JSON *string* (or
// null) and can emit null for `value`/`default_value`. These differ from the
// normalized `TEField` above, which every control downstream relies on.
type TEFieldRaw = Omit<TEField, 'options' | 'value' | 'default_value'> & {
  options: string | null
  value: string | null
  default_value: string | null
  locked_by?: string | null
}
type TEGroupRaw = Omit<TEGroup, 'fields'> & { fields: TEFieldRaw[] }
type TEPaneRaw = Omit<TEPane, 'groups'> & { groups: TEGroupRaw[] }

export type TEActiveTheme = 'dark' | 'light' | 'system'

// GET /theme-engine/schema?platform= → { success, data: { platform, schema, activeTheme } }
export interface TESchemaEnvelope {
  success: boolean
  data: { platform: string; schema: TEPaneRaw[]; activeTheme: TEActiveTheme }
}

// The API sends `options` as a JSON string; controls read it as an object.
// Parse defensively — a malformed/empty string degrades to `null`, never throws.
function parseFieldOptions(raw: string | null): TEFieldOptions | null {
  if (raw == null) return null
  if (typeof raw === 'object') return raw as TEFieldOptions // defensive: already parsed
  const s = String(raw).trim()
  if (!s) return null
  try {
    const parsed = JSON.parse(s)
    return parsed && typeof parsed === 'object' ? (parsed as TEFieldOptions) : null
  } catch {
    return null
  }
}

// Normalize the raw wire schema into the shape the UI relies on: parsed
// `options`, and non-null string `value`/`default_value` (backend may null them).
export function normalizeSchema(schema: TEPaneRaw[]): TEPane[] {
  return schema.map((pane) => ({
    ...pane,
    groups: pane.groups.map((group) => ({
      ...group,
      fields: group.fields.map((field) => ({
        ...field,
        options: parseFieldOptions(field.options),
        value: field.value ?? '',
        default_value: field.default_value ?? '',
      })),
    })),
  }))
}

// A group is theme/device-scoped when its slug's final segment matches one of
// the pane's mode or device ids (e.g. `webapp.branding.brand_colors.dark`).
// Otherwise it is a plain, always-visible section. The API does not emit a
// separate `tag`; it is derived here from the slug + the pane's mode/device sets.
export function groupTag(pane: TEPane, group: TEGroup): string | null {
  const last = group.slug.split('.').pop() ?? ''
  const isMode = pane.modes?.some((m) => m.id === last)
  const isDevice = pane.devices?.some((d) => d.id === last)
  return isMode || isDevice ? last : null
}

export type ValuesMap = Record<string, string> // fieldId → current value

// fieldId → value for every field in a pane: the editor's starting snapshot for both the local
// and the saved values (on schema load, and again after a Reset).
export function paneValues(pane: TEPane): ValuesMap {
  const m: ValuesMap = {}
  pane.groups.forEach((g) => g.fields.forEach((f) => (m[f.id] = f.value)))
  return m
}

// Value maps are namespaced by platform: pane ids repeat across platforms
// (branding/buttons/… exist on all 4). Keying by pane id alone let one
// platform's unsaved edits bleed into another — the other platform's same-id
// pane showed dirty and Save posted mismatched field_ids → 422 (KDL-190 C-1).
export const vkeyOf = (plat: string, paneId: string) => `${plat}:${paneId}`
