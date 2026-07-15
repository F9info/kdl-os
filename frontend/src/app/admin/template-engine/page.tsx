'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Save, RotateCcw } from 'lucide-react'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { refreshTemplateEngineTokens } from '@/components/providers/TemplateEngineThemeProvider'
import { DeviceShell } from './previews/DeviceShell'
import { DefaultShellPreview } from './previews/ThemeDevicePreviews'
import { DEVICE_PANE_PREVIEWS } from './previews/registry'
import { COMPONENT_PANE_PREVIEWS } from './previews/componentRegistry'
import { BrandingFileControl } from './controls/BrandingFileControl'
import { FontsEditorControl, parseRows as parseFontRows } from './controls/FontsEditorControl'
import { ImageClassesEditorControl } from './controls/ImageClassesEditorControl'
import { TypographyTableControl } from './controls/TypographyTableControl'

// ─────────────────────────────────────────────────────────────────────────────
// API types — shape returned by GET /template-engine/schema?platform=
// ─────────────────────────────────────────────────────────────────────────────

interface TEFieldOptions {
  choices?: string[]
  min?: number
  max?: number
  step?: number
  unit?: string
}

interface TEField {
  id: string
  slug: string
  field_name: string
  input_type: string
  options: TEFieldOptions | null
  alt_text: string | null
  value: string
  default_value: string
  sort: number
}

interface TEGroup {
  id: string
  name: string
  slug: string
  fields: TEField[]
}

interface TEPane {
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
}
type TEGroupRaw = Omit<TEGroup, 'fields'> & { fields: TEFieldRaw[] }
type TEPaneRaw = Omit<TEPane, 'groups'> & { groups: TEGroupRaw[] }

type TEActiveTheme = 'dark' | 'light' | 'system'

// GET /template-engine/schema?platform= → { success, data: { platform, schema, activeTheme } }
interface TESchemaEnvelope {
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
function normalizeSchema(schema: TEPaneRaw[]): TEPane[] {
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
function groupTag(pane: TEPane, group: TEGroup): string | null {
  const last = group.slug.split('.').pop() ?? ''
  const isMode = pane.modes?.some((m) => m.id === last)
  const isDevice = pane.devices?.some((d) => d.id === last)
  return isMode || isDevice ? last : null
}

type ValuesMap = Record<string, string> // fieldId → current value

// ─────────────────────────────────────────────────────────────────────────────
// Nav groups (sidebar categories for native platforms)
// ─────────────────────────────────────────────────────────────────────────────

const NAV_GROUPS: Record<string, [string, string[]][]> = {
  tv: [
    ['Foundations', ['branding', 'typography', 'layout', 'dimensions']],
    ['Navigation', ['navigation', 'search']],
    ['Core Components', ['buttons', 'controls', 'forms', 'lists', 'cards', 'tables', 'surfaces', 'icons']],
    ['Media & Playback', ['details', 'playback', 'images']],
    ['Patterns', ['popup', 'progress', 'recommendations', 'alerts', 'emptystates', 'onboarding']],
    ['Advanced', ['accessibility', 'motion', 'gestures', 'assets', 'customcomponents', 'tokens', 'guidelines']],
    ['TV OS Style Guides', ['androidtv', 'leanback', 'tvos', 'firetv', 'roku', 'tizen', 'webos']],
  ],
  android: [
    ['Design Tokens', ['branding', 'typography', 'tokens']],
    ['Layout', ['layout']],
    ['Navigation', ['appbar', 'tabs', 'bottomnav', 'navigation']],
    ['Inputs & Forms', ['forms']],
    ['Buttons', ['buttons', 'fab']],
    ['Data Display', ['cards', 'tables', 'chips']],
    ['Feedback', ['popup', 'alerts', 'emptystates']],
    ['Onboarding', ['onboarding']],
    ['Media & Assets', ['images', 'assets']],
  ],
  ios: [
    ['Design Tokens', ['branding', 'typography', 'tokens']],
    ['Layout', ['layout']],
    ['Navigation', ['navigation', 'tabbar', 'sidemenu']],
    ['Buttons', ['buttons']],
    ['Forms & Controls', ['forms']],
    ['Data Display', ['cards', 'tables', 'collections']],
    ['Feedback', ['popup', 'alerts', 'emptystates']],
    ['Onboarding', ['onboarding']],
    ['Media & Assets', ['images', 'assets']],
  ],
}

// Landing screen shown before the editor — step 1 (top-level platform) and
// step 2 (sub-section within it) of the three-step flow.
const LANDING_PLATFORMS = [
  { id: 'webapp', icon: '🌐', label: 'Webapp' },
  { id: 'tv', icon: '📺', label: 'TV' },
  { id: 'android', icon: '🤖', label: 'Android Native' },
  { id: 'ios', icon: '🍎', label: 'iOS Native' },
]

// Sub-cards per top-level platform. `platformId` is the real backend platform
// this sub-section edits — a UI grouping only for now, no new data per sub
// (e.g. Webapp's Frontend and Landing Page both edit the 'webapp' platform
// until a dedicated Landing Page platform is actually requested). TV/Android/
// iOS have one sub each today since there's no real split yet — more to come
// per user direction, one at a time.
const LANDING_SUBTABS: Record<string, { key: string; platformId: string; icon: string; label: string }[]> = {
  webapp: [
    { key: 'webapp-frontend', platformId: 'webapp', icon: '🖥️', label: 'Frontend' },
    { key: 'webapp-admin', platformId: 'webapp_admin', icon: '🛠️', label: 'Admin' },
    { key: 'webapp-landing', platformId: 'webapp', icon: '📄', label: 'Landing Page' },
  ],
  tv: [{ key: 'tv-app', platformId: 'tv', icon: '📺', label: 'TV App' }],
  android: [{ key: 'android-app', platformId: 'android', icon: '🤖', label: 'Android App' }],
  ios: [{ key: 'ios-app', platformId: 'ios', icon: '🍎', label: 'iOS App' }],
}

const LS_PLATFORM = 'te_platform'
const LS_PANE = 'te_pane'
const LS_TOP_PLATFORM = 'te_top_platform'
const LS_SUB_LABEL = 'te_sub_label'
const LS_ENTERED = 'te_entered'

function lsGet(key: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  return localStorage.getItem(key) ?? fallback
}
function lsSet(key: string, val: string) {
  if (typeof window !== 'undefined') localStorage.setItem(key, val)
}

// Pull a human-readable reason out of a failed mutation. The backend 422 shape
// is { success, message, errors: { fieldErrors, formErrors: string[] } } — the
// formErrors name the exact offending field(s); surface them instead of a
// generic "Could not save" so a bad value is diagnosable from the toast.
function mutationErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data as
    | { message?: string; errors?: { formErrors?: unknown } }
    | undefined
  const formErrors = data?.errors?.formErrors
  if (Array.isArray(formErrors) && formErrors.length) return formErrors.join('; ')
  if (typeof data?.message === 'string' && data.message) return data.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

// ─────────────────────────────────────────────────────────────────────────────
// Field controls
// ─────────────────────────────────────────────────────────────────────────────

// Mirrors the backend's hex acceptance (service.js validateFieldValue): 3/4,
// 6 or 8 hex digits. rgb()/rgba() values are left untouched (edited via the
// swatch, which only emits hex) — the text field only ever needs to validate
// what a human can type.
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

function ColorControl({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])

  const commit = (raw: string) => {
    const trimmed = raw.trim()
    const withHash = trimmed && !trimmed.startsWith('#') ? `#${trimmed}` : trimmed
    if (HEX_COLOR_RE.test(withHash)) {
      onChange(withHash)
    } else {
      setText(value) // invalid — revert to last committed value
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <input
        type="color"
        value={value.startsWith('#') && value.length <= 9 ? value.slice(0, 7) : '#000000'}
        className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent p-0.5"
        onChange={(e) => onChange(e.target.value)}
      />
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        spellCheck={false}
        className="min-w-[90px] rounded border border-border bg-muted px-2 py-1 font-mono text-xs"
        data-testid="color-hex-input"
      />
    </span>
  )
}

function NumberControl({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: TEFieldOptions | null
}) {
  // Backend validates `number` fields with `Number(value)` — a unit suffix
  // ("40px") becomes NaN and 422s the whole pane save. So a number field always
  // posts the bare number; the unit (e.g. px) is display-only metadata. Any unit
  // conversion / scaling is applied once at seed time, not here.
  const unit = options?.unit
  const num = String(value).match(/^-?[\d.]+/)?.[0] ?? value
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        value={num}
        step="any"
        className="w-24 rounded border border-border bg-muted px-2 py-1 text-sm"
        onChange={(e) => onChange(e.target.value)}
      />
      {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
    </span>
  )
}

function SliderControl({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: TEFieldOptions | null
}) {
  const min = options?.min ?? 0
  const max = options?.max ?? 100
  const step = options?.step ?? (max - min <= 6 ? 1 : max - min < 10 ? 0.1 : 1)
  const unit = options?.unit ?? ''
  const num = parseFloat(value) || 0
  return (
    <span className="inline-flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={num}
        className="w-32 accent-primary"
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="w-14 text-right text-xs text-muted-foreground">
        {value}
        {unit}
      </span>
    </span>
  )
}

function SelectControl({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: TEFieldOptions | null
}) {
  const choices = options?.choices ?? []
  return (
    <select
      value={value}
      className="min-w-[160px] rounded border border-border bg-muted px-2 py-1.5 text-sm"
      onChange={(e) => onChange(e.target.value)}
    >
      {choices.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  )
}

function ToggleControl({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const checked = value === 'true'
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        checked={checked}
        className="sr-only"
        onChange={(e) => onChange(String(e.target.checked))}
      />
      <div
        className={cn(
          'h-6 w-11 rounded-full border-2 transition-colors',
          checked ? 'border-primary bg-primary' : 'border-border bg-muted',
        )}
      >
        <div
          className={cn(
            'h-4 w-4 translate-y-[1px] rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[21px]' : 'translate-x-[1px]',
          )}
        />
      </div>
    </label>
  )
}

function RadioControl({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: TEFieldOptions | null
}) {
  const choices = options?.choices ?? []
  return (
    <span className="inline-flex flex-wrap gap-2">
      {choices.map((c) => (
        <label key={c} className="inline-flex cursor-pointer items-center gap-1 text-sm">
          <input
            type="radio"
            checked={value === c}
            onChange={() => onChange(c)}
            className="accent-primary"
          />
          {c}
        </label>
      ))}
    </span>
  )
}

function TextControl({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      className="min-w-[200px] rounded border border-border bg-muted px-2 py-1.5 text-sm"
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function TextareaControl({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      value={value}
      rows={3}
      className="min-h-[72px] w-full rounded border border-border bg-muted px-2 py-1.5 font-mono text-sm"
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function MultiSelectControl({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: TEFieldOptions | null
}) {
  let cur: string[] = []
  try {
    cur = JSON.parse(value)
  } catch {}
  const choices = options?.choices ?? []
  const toggle = (c: string) => {
    const s = new Set(cur)
    s.has(c) ? s.delete(c) : s.add(c)
    onChange(JSON.stringify([...s]))
  }
  return (
    <span className="inline-flex flex-wrap gap-1">
      {choices.map((c) => (
        <button
          key={c}
          onClick={() => toggle(c)}
          className={cn(
            'rounded-full border px-3 py-0.5 text-xs transition-colors',
            cur.includes(c)
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-muted text-muted-foreground hover:border-primary',
          )}
        >
          {c}
        </button>
      ))}
    </span>
  )
}

// Select fields that let the user pick a font family (Heading/Body/Navigation/Button
// Font) all share the backend's static FONTS list baked into `options.choices` at
// seed time — they never see fonts added later via the sibling "Custom Fonts"
// repeater. Every such field is named "*Font*" and is the only select convention
// that is (Font Weight/Size fields use different field names) — see FieldControl.
const isFontFamilySelect = (field: TEField) => field.input_type === 'select' && /font/i.test(field.field_name)

function FieldControl({
  field,
  value,
  onChange,
  customFontNames,
}: {
  field: TEField
  value: string
  onChange: (v: string) => void
  customFontNames: string[]
}) {
  const t = field.input_type
  if (t === 'color') return <ColorControl value={value} onChange={onChange} />
  if (t === 'number') return <NumberControl value={value} onChange={onChange} options={field.options} />
  if (t === 'slider') return <SliderControl value={value} onChange={onChange} options={field.options} />
  if (t === 'select') {
    const choices = field.options?.choices ?? []
    const options =
      isFontFamilySelect(field) && customFontNames.length
        ? { ...field.options, choices: [...choices, ...customFontNames.filter((n) => !choices.includes(n))] }
        : field.options
    return <SelectControl value={value} onChange={onChange} options={options} />
  }
  if (t === 'toggle') return <ToggleControl value={value} onChange={onChange} />
  if (t === 'radio') return <RadioControl value={value} onChange={onChange} options={field.options} />
  if (t === 'textarea') return <TextareaControl value={value} onChange={onChange} />
  if (t === 'multiselect') return <MultiSelectControl value={value} onChange={onChange} options={field.options} />
  if (t === 'file') return <BrandingFileControl value={value} onChange={onChange} />
  if (t === 'fonts') return <FontsEditorControl value={value} onChange={onChange} />
  if (t === 'imglist') return <ImageClassesEditorControl value={value} onChange={onChange} />
  if (t === 'typo_table') {
    const choices = [...(field.options?.choices ?? []), ...customFontNames]
    return <TypographyTableControl value={value} onChange={onChange} choices={choices} />
  }
  // text, password → text input as baseline
  return <TextControl value={value} onChange={onChange} />
}

// ─────────────────────────────────────────────────────────────────────────────
// Device frame previews
// ─────────────────────────────────────────────────────────────────────────────

function PreviewFrame({
  platform,
  pane,
  values,
}: {
  platform: string
  pane: TEPane | undefined
  values: Record<string, string>
}) {
  const renderer = pane ? { ...DEVICE_PANE_PREVIEWS, ...COMPONENT_PANE_PREVIEWS }[pane.id] : undefined
  return (
    <DeviceShell platform={platform}>
      {renderer && pane ? renderer({ pane, values }) : <DefaultShellPreview platform={platform} />}
    </DeviceShell>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page component
// ─────────────────────────────────────────────────────────────────────────────

export default function TemplateEnginePage() {
  return (
    <ModuleGuard slug="template-engine">
      <TemplateEngineInner />
    </ModuleGuard>
  )
}

function TemplateEngineInner() {
  const qc = useQueryClient()

  // ── UI prefs (localStorage only) ──────────────────────────────────────────
  // Three-step flow, persisted like everything else here — a refresh must land
  // back where you were, not reset to step 1: 1) pick a top-level platform
  // card, 2) pick a sub-section card within it, 3) the existing full editor
  // for whichever platform that sub-section edits.
  const [topPlatform, setTopPlatformState] = useState<string | null>(() => lsGet(LS_TOP_PLATFORM, '') || null)
  const [subLabel, setSubLabelState] = useState<string | null>(() => lsGet(LS_SUB_LABEL, '') || null)
  const [entered, setEnteredState] = useState(() => lsGet(LS_ENTERED, '') === 'true')
  const [platform, setPlatformState] = useState(() => lsGet(LS_PLATFORM, 'webapp'))
  const [activePane, setActivePaneState] = useState(() => lsGet(LS_PANE, ''))
  const [search, setSearch] = useState('')
  // Per-pane active mode/device selectors (sub-tabs within a pane)
  const [paneMode, setPaneMode] = useState<Record<string, string>>({})
  const [paneDevice, setPaneDevice] = useState<Record<string, string>>({})
  // Which sections are open (default: all open)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})

  const setTopPlatform = (p: string | null) => {
    setTopPlatformState(p)
    lsSet(LS_TOP_PLATFORM, p ?? '')
  }
  const setSubLabel = (s: string | null) => {
    setSubLabelState(s)
    lsSet(LS_SUB_LABEL, s ?? '')
  }
  const setEntered = (v: boolean) => {
    setEnteredState(v)
    lsSet(LS_ENTERED, String(v))
  }
  const setPlatform = (p: string) => {
    setPlatformState(p)
    lsSet(LS_PLATFORM, p)
  }
  const setActivePane = (p: string) => {
    setActivePaneState(p)
    lsSet(LS_PANE, p)
  }

  // ── API: load schema ──────────────────────────────────────────────────────
  const { data, isLoading, isError } = useQuery({
    queryKey: ['template-engine-schema', platform],
    queryFn: () =>
      api.get<TESchemaEnvelope>(`/template-engine/schema?platform=${platform}`).then((r) => ({
        panes: normalizeSchema(r.data.data.schema),
        activeTheme: r.data.data.activeTheme,
      })),
    staleTime: 30_000,
  })

  const panes: TEPane[] = data?.panes ?? []

  // ── Active/Default Theme (per platform: dark | light | system) ───────────
  // Distinct from `paneMode` above: paneMode only picks which theme's *field
  // values* are being edited in the current pane. This is the platform-wide
  // "the running app should render in ___" setting the runtime
  // TemplateEngineThemeProvider reads via GET /tokens.
  const [activeThemeSaved, setActiveThemeSaved] = useState<Record<string, TEActiveTheme>>({})
  const [activeThemeLocal, setActiveThemeLocal] = useState<Record<string, TEActiveTheme>>({})

  useEffect(() => {
    if (!data) return
    setActiveThemeSaved((prev) => (prev[platform] ? prev : { ...prev, [platform]: data.activeTheme }))
    setActiveThemeLocal((prev) => (prev[platform] ? prev : { ...prev, [platform]: data.activeTheme }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, platform])

  const isThemeDirty = useCallback(
    (plat: string) => {
      const saved = activeThemeSaved[plat]
      const local = activeThemeLocal[plat]
      return saved != null && local != null && saved !== local
    },
    [activeThemeSaved, activeThemeLocal],
  )

  // ── Local editable values (never localStorage) ────────────────────────────
  // Keyed by pane.id → { field.id: value }
  const [localValues, setLocalValues] = useState<Record<string, ValuesMap>>({})
  // Saved snapshot (to compute dirty) — refreshed from API on load / after save
  const [savedValues, setSavedValues] = useState<Record<string, ValuesMap>>({})

  // Value maps are namespaced by platform: pane ids repeat across platforms
  // (branding/buttons/… exist on all 4). Keying by pane id alone let one
  // platform's unsaved edits bleed into another — the other platform's same-id
  // pane showed dirty and Save posted mismatched field_ids → 422 (KDL-190 C-1).
  const vkeyOf = (plat: string, paneId: string) => `${plat}:${paneId}`
  const vkey = (paneId: string) => vkeyOf(platform, paneId)

  // When schema loads, initialize or refresh values for panes we haven't touched
  useEffect(() => {
    if (!panes.length) return
    setLocalValues((prev) => {
      const next = { ...prev }
      panes.forEach((pane) => {
        if (!next[vkey(pane.id)]) {
          const m: ValuesMap = {}
          pane.groups.forEach((g) => g.fields.forEach((f) => (m[f.id] = f.value)))
          next[vkey(pane.id)] = m
        }
      })
      return next
    })
    setSavedValues((prev) => {
      const next = { ...prev }
      panes.forEach((pane) => {
        if (!next[vkey(pane.id)]) {
          const m: ValuesMap = {}
          pane.groups.forEach((g) => g.fields.forEach((f) => (m[f.id] = f.value)))
          next[vkey(pane.id)] = m
        }
      })
      return next
    })
    // Initialize mode/device defaults for panes. Default to the saved Active
    // Theme (KDL-198 Problem 2) rather than always the first mode — otherwise
    // a Dark-first `modes` array makes the editor reset to Dark on every
    // reload regardless of which theme is actually active.
    const resolvedSystemMode =
      typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark'
    const savedActiveTheme = data?.activeTheme ?? 'system'
    const preferredMode = savedActiveTheme === 'system' ? resolvedSystemMode : savedActiveTheme
    setPaneMode((prev) => {
      const next = { ...prev }
      panes.forEach((pane) => {
        if (!next[pane.id] && pane.modes?.length) {
          const hasPreferred = pane.modes!.some((m) => m.id === preferredMode)
          next[pane.id] = hasPreferred ? preferredMode : pane.modes![0]!.id
        }
      })
      return next
    })
    setPaneDevice((prev) => {
      const next = { ...prev }
      panes.forEach((pane) => {
        if (!next[pane.id] && pane.devices?.length) next[pane.id] = pane.devices![0]!.id
      })
      return next
    })
    // Set default active pane if none selected or pane not available on this platform
    setActivePaneState((prev) => {
      if (panes.some((p) => p.id === prev)) return prev
      const first = panes[0]?.id ?? ''
      lsSet(LS_PANE, first)
      return first
    })
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dirty tracking ────────────────────────────────────────────────────────
  const isDirtyPane = useCallback(
    (paneId: string) => {
      const local = localValues[vkey(paneId)]
      const saved = savedValues[vkey(paneId)]
      if (!local || !saved) return false
      return JSON.stringify(local) !== JSON.stringify(saved)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [localValues, savedValues, platform],
  )

  // Read inside mutation callbacks via ref, not the closed-over `localValues`
  // — useMutation's onSuccess otherwise risks acting on the render's snapshot
  // from when the mutation was *defined*, not the latest edits made while the
  // request was in flight (the "Save needs two clicks" report on this pane).
  const localValuesRef = useRef(localValues)
  useEffect(() => {
    localValuesRef.current = localValues
  }, [localValues])

  // ── Mutations ────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async ({ paneId, platform: plat }: { paneId: string; platform: string }) => {
      const pane = panes.find((p) => p.id === paneId)
      if (!pane) throw new Error('Pane not found')
      const local = localValuesRef.current[vkeyOf(plat, paneId)] ?? {}
      const values = pane.groups.flatMap((g) =>
        g.fields.map((f) => ({ field_id: f.id, value: local[f.id] ?? f.value })),
      )
      return api.post('/template-engine/values', {
        platform: plat,
        type_id: pane.type_id,
        values,
      })
    },
    onSuccess: (_, { paneId, platform: plat }) => {
      const k = vkeyOf(plat, paneId)
      setSavedValues((prev) => ({ ...prev, [k]: { ...(localValuesRef.current[k] ?? {}) } }))
      void qc.invalidateQueries({ queryKey: ['template-engine-schema', plat] })
      toast({ title: 'Saved', description: 'Settings saved successfully.' })
    },
    onError: (err) => {
      toast({
        title: 'Save failed',
        description: mutationErrorMessage(err, 'Could not save settings.'),
        variant: 'destructive',
      })
    },
  })

  const activeThemeMutation = useMutation({
    mutationFn: async ({ platform: plat, theme }: { platform: string; theme: TEActiveTheme }) =>
      api.post('/template-engine/active-theme', { platform: plat, theme }),
    onSuccess: (_, { platform: plat, theme }) => {
      setActiveThemeSaved((prev) => ({ ...prev, [plat]: theme }))
      toast({ title: 'Saved', description: 'Active theme updated.' })
    },
    onError: (err) => {
      toast({
        title: 'Save failed',
        description: mutationErrorMessage(err, 'Could not save the active theme.'),
        variant: 'destructive',
      })
    },
  })

  const resetMutation = useMutation({
    mutationFn: async ({ paneId, platform: plat }: { paneId: string; platform: string }) => {
      const pane = panes.find((p) => p.id === paneId)
      if (!pane) throw new Error('Pane not found')
      // Reset keys off the Type cuid; without it the backend Zod schema 400s on a
      // missing type_id. Fail early with a clear message instead.
      if (!pane.type_id) throw new Error('This section has no Type and cannot be reset.')
      return api.post('/template-engine/reset', { platform: plat, type_id: pane.type_id })
    },
    onSuccess: (_, { paneId, platform: plat }) => {
      const k = vkeyOf(plat, paneId)
      // After reset, invalidate to reload defaults
      void qc.invalidateQueries({ queryKey: ['template-engine-schema', plat] }).then(() => {
        // Clear local and saved so the effect re-initializes from fresh API data
        setLocalValues((prev) => {
          const next = { ...prev }
          delete next[k]
          return next
        })
        setSavedValues((prev) => {
          const next = { ...prev }
          delete next[k]
          return next
        })
      })
      toast({ title: 'Reset', description: 'Settings reset to defaults.' })
    },
    onError: (err) => {
      toast({
        title: 'Reset failed',
        description: mutationErrorMessage(err, 'Could not reset settings.'),
        variant: 'destructive',
      })
    },
  })

  const handleFieldChange = (paneId: string, fieldId: string, value: string) => {
    const k = vkey(paneId)
    setLocalValues((prev) => ({
      ...prev,
      [k]: { ...(prev[k] ?? {}), [fieldId]: value },
    }))
  }

  // ── Active pane data ──────────────────────────────────────────────────────
  const activePaneData = panes.find((p) => p.id === activePane)
  const activePaneValues = localValues[vkey(activePane)] ?? {}
  const activePaneIsDirty = isDirtyPane(activePane)
  const activeThemeIsDirty = isThemeDirty(platform)

  // Names from the pane's "Custom Fonts" repeater (if any), live-edited value
  // included — these get appended to every Font Family select's choices below.
  const customFontNames = useMemo(() => {
    const fontsField = activePaneData?.groups.flatMap((g) => g.fields).find((f) => f.input_type === 'fonts')
    if (!fontsField) return []
    const raw = activePaneValues[fontsField.id] ?? fontsField.value
    return parseFontRows(raw)
      .map((r) => r.name.trim())
      .filter(Boolean)
  }, [activePaneData, activePaneValues])

  const handleSave = async () => {
    try {
      if (activePaneIsDirty) await saveMutation.mutateAsync({ paneId: activePane, platform })
      if (activeThemeIsDirty) {
        await activeThemeMutation.mutateAsync({ platform, theme: activeThemeLocal[platform]! })
      }
      // Let the runtime provider re-fetch compiled tokens so the admin sees
      // the change immediately instead of needing a hard reload.
      refreshTemplateEngineTokens()
    } catch {
      // Individual mutations already surface their own error toast.
    }
  }

  // Visible groups (filtered by active mode/device)
  const visibleGroups = useMemo(() => {
    if (!activePaneData) return []
    const activeMode = paneMode[activePane]
    const activeDevice = paneDevice[activePane]
    return activePaneData.groups.filter((g) => {
      const tag = groupTag(activePaneData, g)
      if (!tag) return true
      const isMode = activePaneData.modes?.some((m) => m.id === tag)
      if (isMode) return tag === activeMode
      return tag === activeDevice
    })
  }, [activePaneData, activePane, paneMode, paneDevice])

  // Search filter
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return visibleGroups
    const q = search.trim().toLowerCase()
    return visibleGroups
      .map((g) => ({
        ...g,
        fields: g.fields.filter(
          (f) => f.field_name.toLowerCase().includes(q) || g.name.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.fields.length > 0)
  }, [visibleGroups, search])

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }))
  }
  const isSectionOpen = (key: string) => openSections[key] ?? true

  // ── Sidebar groups ────────────────────────────────────────────────────────
  const sidebarItems = useMemo(() => {
    const groups = NAV_GROUPS[platform]
    if (!groups) return [{ cap: null as string | null, panes }]
    const done = new Set<string>()
    const result: { cap: string | null; panes: TEPane[] }[] = []
    for (const [cap, ids] of groups) {
      // Panes are matched by their semantic id (the API sends `id: "branding"`
      // etc.); it is exactly what NAV_GROUPS is keyed on. The API does not send a
      // pane-level slug, so never match on one.
      const ps = ids.map((id) => panes.find((p) => p.id === id)).filter(Boolean) as TEPane[]
      if (!ps.length) continue
      ps.forEach((p) => done.add(p.id))
      result.push({ cap, panes: ps })
    }
    const ungrouped = panes.filter((p) => !done.has(p.id))
    if (ungrouped.length) result.push({ cap: null, panes: ungrouped })
    return result
  }, [panes, platform])

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  const isSaving = saveMutation.isPending || activeThemeMutation.isPending
  const isResetting = resetMutation.isPending

  if (!topPlatform) {
    return (
      <div
        className="-m-6 flex flex-col items-center justify-center gap-10 bg-muted/30"
        data-testid="template-engine-landing"
        style={{ height: 'calc(100dvh - 4rem)' }}
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold">Template Engine</h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose a platform to configure</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {LANDING_PLATFORMS.map((p) => (
            <button
              key={p.id}
              data-testid={`landing-card-${p.id}`}
              onClick={() => setTopPlatform(p.id)}
              className="flex w-40 flex-col items-center gap-2 rounded-xl border border-border bg-card p-6 text-center transition-colors hover:border-primary hover:bg-secondary"
            >
              <span className="text-4xl">{p.icon}</span>
              <span className="text-sm font-semibold">{p.label}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (!entered) {
    const subtabs = LANDING_SUBTABS[topPlatform] ?? []
    return (
      <div
        className="-m-6 flex flex-col items-center justify-center gap-10 bg-muted/30"
        data-testid="template-engine-sublanding"
        style={{ height: 'calc(100dvh - 4rem)' }}
      >
        <div className="text-center">
          <button
            data-testid="landing-back"
            onClick={() => setTopPlatform(null)}
            className="mb-3 text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold">
            {LANDING_PLATFORMS.find((p) => p.id === topPlatform)?.label}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose a section to configure</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {subtabs.map((s) => (
            <button
              key={s.key}
              data-testid={`landing-subcard-${s.key}`}
              onClick={() => {
                setPlatform(s.platformId)
                setSubLabel(s.label)
                setEntered(true)
              }}
              className="flex w-40 flex-col items-center gap-2 rounded-xl border border-border bg-card p-6 text-center transition-colors hover:border-primary hover:bg-secondary"
            >
              <span className="text-4xl">{s.icon}</span>
              <span className="text-sm font-semibold">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className="-m-6 flex flex-col overflow-hidden bg-muted/30"
      data-testid="template-engine-page"
      style={{ height: 'calc(100dvh - 4rem)' }}
    >
      {/* ── Title bar ────────────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center gap-2 border-b bg-sidebar px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="flex-1 text-center text-sm font-semibold text-muted-foreground">
          Application Settings — Template Engine
        </span>
      </div>

      {/* ── Breadcrumb — back out of the 3-step platform/section flow ───────── */}
      <div
        className="flex flex-shrink-0 items-center gap-1.5 border-b bg-sidebar px-4 py-2 text-sm"
        data-testid="breadcrumb"
      >
        <button
          data-testid="breadcrumb-root"
          onClick={() => {
            setTopPlatform(null)
            setEntered(false)
          }}
          className="text-muted-foreground hover:text-foreground"
        >
          Template Engine
        </button>
        <span className="text-muted-foreground">/</span>
        <button
          data-testid="breadcrumb-platform"
          onClick={() => setEntered(false)}
          className="text-muted-foreground hover:text-foreground"
        >
          {LANDING_PLATFORMS.find((p) => p.id === topPlatform)?.label ?? topPlatform}
        </button>
        {subLabel && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium text-foreground">{subLabel}</span>
          </>
        )}
      </div>

      {/* ── Active theme bar ─────────────────────────────────────────────── */}
      {/* Platform-wide "the running app should render in ___" — distinct from
          the per-pane Dark/Light mode tabs below, which only pick which
          theme's field values are being edited. Read by the runtime
          TemplateEngineThemeProvider via GET /tokens. */}
      <div
        className="flex flex-shrink-0 items-center justify-center gap-2 border-b bg-sidebar px-4 py-1.5"
        data-testid="active-theme-bar"
      >
        <span className="text-xs text-muted-foreground">Active Theme</span>
        <div className="flex gap-1">
          {(['dark', 'light', 'system'] as const).map((t) => {
            const current = activeThemeLocal[platform] ?? activeThemeSaved[platform] ?? 'system'
            return (
              <button
                key={t}
                data-testid={`active-theme-btn-${t}`}
                onClick={() => setActiveThemeLocal((prev) => ({ ...prev, [platform]: t }))}
                className={cn(
                  'rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                  current === t
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-secondary',
                )}
              >
                {t}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className="flex w-60 flex-shrink-0 flex-col border-r bg-sidebar">
          {/* Search */}
          <div className="flex items-center gap-1.5 border-b border-border/50 px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search settings…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              data-testid="sidebar-search"
            />
          </div>
          {/* Pane list */}
          <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin">
            {isLoading && (
              <div className="px-3 py-4 text-xs text-muted-foreground">Loading…</div>
            )}
            {isError && (
              <div className="px-3 py-2 text-xs text-destructive">Failed to load schema.</div>
            )}
            {sidebarItems.map(({ cap, panes: groupPanes }, gi) => (
              <div key={gi}>
                {cap && (
                  <div className="mt-3 px-3 pb-1 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
                    {cap}
                  </div>
                )}
                {groupPanes.map((pane) => (
                  <button
                    key={pane.id}
                    data-testid={`pane-btn-${pane.id}`}
                    onClick={() => setActivePane(pane.id)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors',
                      pane.id === activePane
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-secondary',
                    )}
                  >
                    <span
                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-xs shadow-sm"
                      style={{ background: pane.ic ?? '#666' }}
                    >
                      {pane.icon}
                    </span>
                    <span className="flex-1 truncate text-left">{pane.label}</span>
                    {isDirtyPane(pane.id) && (
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          pane.id === activePane ? 'bg-white' : 'bg-amber-400',
                        )}
                      />
                    )}
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Pane header */}
          {activePaneData && (
            <div className="flex-shrink-0 border-b bg-background px-7 py-4">
              <h1 className="text-2xl font-bold tracking-tight">{activePaneData.label}</h1>
              {activePaneData.groups[0] && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {activePaneData.groups.length} sections
                </p>
              )}

              {/* Device/Mode sub-tabs */}
              {(activePaneData.devices || activePaneData.modes) && (
                <div className="mt-3 flex flex-wrap gap-4">
                  {activePaneData.devices && activePaneData.devices.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Device</span>
                      <div className="flex gap-1">
                        {activePaneData.devices.map((d) => (
                          <button
                            key={d.id}
                            data-testid={`device-tab-${d.id}`}
                            onClick={() => setPaneDevice((prev) => ({ ...prev, [activePane]: d.id }))}
                            className={cn(
                              'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                              (paneDevice[activePane] ?? activePaneData.devices![0]!.id) === d.id
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:bg-secondary',
                            )}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {activePaneData.modes && activePaneData.modes.length > 0 && (
                    <div className="flex items-center gap-2">
                      {/* Distinct from the "Active Theme" bar above (KDL-199 Problem
                          2): this only picks which theme's *field values* are being
                          edited here, not the app's live theme. */}
                      <span className="text-xs text-muted-foreground">Editing values for</span>
                      <div className="flex gap-1">
                        {activePaneData.modes.map((m) => (
                          <button
                            key={m.id}
                            data-testid={`mode-tab-${m.id}`}
                            onClick={() => setPaneMode((prev) => ({ ...prev, [activePane]: m.id }))}
                            className={cn(
                              'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                              (paneMode[activePane] ?? activePaneData.modes![0]!.id) === m.id
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:bg-secondary',
                            )}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Sections */}
          <div className="flex-1 overflow-y-auto px-8 pb-8 pt-2 scrollbar-thin">
            {!activePaneData && !isLoading && (
              <div className="mt-12 text-center text-sm text-muted-foreground">
                Select a pane from the sidebar.
              </div>
            )}
            {filteredGroups.length === 0 && search && (
              <div className="mt-8 text-center text-sm text-muted-foreground">
                No settings match your search in this pane.
              </div>
            )}
            {filteredGroups.map((group) => {
              const sectionKey = `${activePane}-${group.id}`
              const tag = activePaneData ? groupTag(activePaneData, group) : null
              return (
                <div key={group.id} className="mt-5">
                  <button
                    className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground"
                    onClick={() => toggleSection(sectionKey)}
                  >
                    <span
                      className={cn(
                        'text-[9px] transition-transform',
                        isSectionOpen(sectionKey) ? 'rotate-90' : '',
                      )}
                    >
                      ▶
                    </span>
                    {group.name}
                    {tag && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] normal-case text-muted-foreground">
                        {tag}
                      </span>
                    )}
                  </button>
                  {isSectionOpen(sectionKey) && (
                    <div className="overflow-hidden rounded-lg border bg-card">
                      {group.fields.map((field, fi) => {
                        // The Typography Scale table is self-labeling (column
                        // headers + row names) — the generic field_name/alt_text
                        // label column would just repeat the group name above it.
                        const isTable = field.input_type === 'typo_table'
                        return (
                          <div
                            key={field.id}
                            className={cn(
                              isTable ? 'p-3' : 'grid grid-cols-[minmax(200px,340px)_1fr] items-center gap-3 px-5 py-3',
                              fi < group.fields.length - 1 ? 'border-b' : '',
                            )}
                            data-testid={`field-row-${field.id}`}
                          >
                            {!isTable && (
                              <div>
                                <div className="text-sm font-medium">{field.field_name}</div>
                                {field.alt_text && (
                                  <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                                    {field.alt_text}
                                  </div>
                                )}
                              </div>
                            )}
                            <div className={isTable ? '' : 'flex flex-wrap items-center justify-end gap-2'}>
                              <FieldControl
                                field={field}
                                value={activePaneValues[field.id] ?? field.value}
                                onChange={(v) => handleFieldChange(activePane, field.id, v)}
                                customFontNames={customFontNames}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div
            className="flex flex-shrink-0 items-center justify-between border-t bg-sidebar px-7 py-3"
            data-testid="footer"
          >
            <span className="text-xs text-muted-foreground">
              {activePaneIsDirty || activeThemeIsDirty ? 'Unsaved changes' : 'All changes saved'}
            </span>
            <div className="flex gap-2">
              <button
                data-testid="btn-reset"
                onClick={() => resetMutation.mutate({ paneId: activePane, platform })}
                disabled={isResetting || !activePane}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
              <button
                data-testid="btn-save"
                onClick={handleSave}
                disabled={isSaving || !activePane || (!activePaneIsDirty && !activeThemeIsDirty)}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>

        {/* Right preview panel */}
        <aside className="hidden w-80 flex-shrink-0 flex-col items-center gap-4 overflow-y-auto border-l bg-sidebar px-4 py-5 xl:flex scrollbar-thin">
          <div className="self-start text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Live Preview
          </div>
          <PreviewFrame platform={platform} pane={activePaneData} values={activePaneValues} />
          <div className="text-center text-[11px] text-muted-foreground">
            {activePaneData?.label ?? 'Select a pane'} — updates live as you edit
          </div>
        </aside>
      </div>
    </div>
  )
}
