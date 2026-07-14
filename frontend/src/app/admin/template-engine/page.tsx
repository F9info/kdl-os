'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Sun, Moon, Save, RotateCcw } from 'lucide-react'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { ModuleGuard } from '@/components/shared/ModuleGuard'

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

// GET /template-engine/schema?platform= → { success, data: { platform, schema } }
interface TESchemaEnvelope {
  success: boolean
  data: { platform: string; schema: TEPaneRaw[] }
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

const PLATFORMS = [
  { id: 'webapp', label: '🌐 Web App' },
  { id: 'tv', label: '📺 TV' },
  { id: 'android', label: '🤖 Android Native' },
  { id: 'ios', label: '🍎 iOS Native' },
]

const LS_PLATFORM = 'te_platform'
const LS_PANE = 'te_pane'
const LS_THEME = 'te_theme'

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

function ColorControl({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <span className="inline-flex items-center gap-2">
      <input
        type="color"
        value={value.startsWith('#') && value.length <= 9 ? value.slice(0, 7) : '#000000'}
        className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent p-0.5"
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="min-w-[90px] rounded border border-border bg-muted px-2 py-1 font-mono text-xs">{value}</span>
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

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: TEField
  value: string
  onChange: (v: string) => void
}) {
  const t = field.input_type
  if (t === 'color') return <ColorControl value={value} onChange={onChange} />
  if (t === 'number') return <NumberControl value={value} onChange={onChange} options={field.options} />
  if (t === 'slider') return <SliderControl value={value} onChange={onChange} options={field.options} />
  if (t === 'select') return <SelectControl value={value} onChange={onChange} options={field.options} />
  if (t === 'toggle') return <ToggleControl value={value} onChange={onChange} />
  if (t === 'radio') return <RadioControl value={value} onChange={onChange} options={field.options} />
  if (t === 'textarea') return <TextareaControl value={value} onChange={onChange} />
  if (t === 'multiselect') return <MultiSelectControl value={value} onChange={onChange} options={field.options} />
  // text, password, fonts, imglist, file → text input as baseline
  return <TextControl value={value} onChange={onChange} />
}

// ─────────────────────────────────────────────────────────────────────────────
// Device frame previews
// ─────────────────────────────────────────────────────────────────────────────

function PreviewFrame({ platform }: { platform: string }) {
  if (platform === 'tv') {
    return (
      <div className="flex flex-col items-center gap-0">
        <div className="w-[280px] rounded-[8px] border-[7px] border-[#0b0b0c] bg-black shadow-[0_14px_40px_rgba(0,0,0,.5)]">
          <div className="min-h-[158px] bg-[#0d0d0f]" />
        </div>
        <div
          className="h-3.5 w-16 bg-[#0b0b0c]"
          style={{ clipPath: 'polygon(22% 0, 78% 0, 100% 100%, 0 100%)' }}
        />
        <div className="h-1 w-32 rounded-sm bg-[#141416]" />
      </div>
    )
  }
  if (platform === 'android') {
    return (
      <div className="flex flex-col">
        <div className="w-[240px] overflow-hidden rounded-[28px] border-[8px] border-[#0b0b0c] shadow-[0_16px_44px_rgba(0,0,0,.5)]">
          <div className="min-h-[420px] bg-card" />
          <div className="flex justify-around bg-[#0b0b0c] px-10 py-2 text-xs text-[#9a9aa2]">
            <span>◁</span>
            <span>○</span>
            <span>▢</span>
          </div>
        </div>
      </div>
    )
  }
  if (platform === 'ios') {
    return (
      <div className="w-[240px] overflow-hidden rounded-[28px] border-[8px] border-[#0b0b0c] shadow-[0_16px_44px_rgba(0,0,0,.5)]">
        <div className="flex justify-center bg-black py-1.5">
          <span className="h-3 w-20 rounded-full border border-[#232325] bg-[#0b0b0c]" />
        </div>
        <div className="min-h-[420px] bg-card" />
      </div>
    )
  }
  // webapp → browser frame
  return (
    <div className="w-[280px] overflow-hidden rounded-[8px] border border-border shadow-lg">
      <div className="flex items-center gap-1.5 border-b border-border bg-muted px-2 py-1.5">
        <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
        <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
        <span className="h-2 w-2 rounded-full bg-[#28c840]" />
        <span className="ml-1.5 flex-1 rounded bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
          app.kdl.dev
        </span>
      </div>
      <div className="min-h-[220px] bg-card" />
    </div>
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
  const [platform, setPlatformState] = useState(() => lsGet(LS_PLATFORM, 'webapp'))
  const [activePane, setActivePaneState] = useState(() => lsGet(LS_PANE, ''))
  const [theme, setThemeState] = useState<'dark' | 'light'>(() =>
    lsGet(LS_THEME, 'dark') === 'light' ? 'light' : 'dark',
  )
  const [search, setSearch] = useState('')
  // Per-pane active mode/device selectors (sub-tabs within a pane)
  const [paneMode, setPaneMode] = useState<Record<string, string>>({})
  const [paneDevice, setPaneDevice] = useState<Record<string, string>>({})
  // Which sections are open (default: all open)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})

  const setPlatform = (p: string) => {
    setPlatformState(p)
    lsSet(LS_PLATFORM, p)
  }
  const setActivePane = (p: string) => {
    setActivePaneState(p)
    lsSet(LS_PANE, p)
  }
  const setTheme = (t: 'dark' | 'light') => {
    setThemeState(t)
    lsSet(LS_THEME, t)
  }

  // ── API: load schema ──────────────────────────────────────────────────────
  const { data, isLoading, isError } = useQuery<TEPane[]>({
    queryKey: ['template-engine-schema', platform],
    queryFn: () =>
      api
        .get<TESchemaEnvelope>(`/template-engine/schema?platform=${platform}`)
        .then((r) => normalizeSchema(r.data.data.schema)),
    staleTime: 30_000,
  })

  const panes: TEPane[] = data ?? []

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
    // Initialize mode/device defaults for panes
    setPaneMode((prev) => {
      const next = { ...prev }
      panes.forEach((pane) => {
        if (!next[pane.id] && pane.modes?.length) next[pane.id] = pane.modes![0]!.id
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

  const isPlatformDirty = useCallback(() => {
    return panes.some((p) => isDirtyPane(p.id))
  }, [panes, isDirtyPane])

  // ── Mutations ────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async ({ paneId, platform: plat }: { paneId: string; platform: string }) => {
      const pane = panes.find((p) => p.id === paneId)
      if (!pane) throw new Error('Pane not found')
      const local = localValues[vkeyOf(plat, paneId)] ?? {}
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
      setSavedValues((prev) => ({ ...prev, [k]: { ...(localValues[k] ?? {}) } }))
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

  const isSaving = saveMutation.isPending
  const isResetting = resetMutation.isPending

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
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="rounded border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
          aria-label="Toggle preview theme"
        >
          {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* ── Platform bar ─────────────────────────────────────────────────── */}
      <div
        className="flex flex-shrink-0 flex-wrap items-center justify-center gap-1 border-b bg-sidebar px-4 py-2"
        data-testid="platform-bar"
      >
        {PLATFORMS.map((p) => {
          const dirty = p.id === platform && isPlatformDirty()
          return (
            <button
              key={p.id}
              data-testid={`platform-btn-${p.id}`}
              onClick={() => setPlatform(p.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors',
                p.id === platform
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              {p.label}
              {dirty && (
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    p.id === platform ? 'bg-white' : 'bg-amber-400',
                  )}
                />
              )}
            </button>
          )
        })}
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
                      <span className="text-xs text-muted-foreground">Theme</span>
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
                      {group.fields.map((field, fi) => (
                        <div
                          key={field.id}
                          className={cn(
                            'grid grid-cols-[minmax(200px,340px)_1fr] items-center gap-3 px-5 py-3',
                            fi < group.fields.length - 1 ? 'border-b' : '',
                          )}
                          data-testid={`field-row-${field.id}`}
                        >
                          <div>
                            <div className="text-sm font-medium">{field.field_name}</div>
                            {field.alt_text && (
                              <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                                {field.alt_text}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <FieldControl
                              field={field}
                              value={activePaneValues[field.id] ?? field.value}
                              onChange={(v) => handleFieldChange(activePane, field.id, v)}
                            />
                          </div>
                        </div>
                      ))}
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
              {activePaneIsDirty ? 'Unsaved changes' : 'All changes saved'}
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
                onClick={() => saveMutation.mutate({ paneId: activePane, platform })}
                disabled={isSaving || !activePane || !activePaneIsDirty}
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
          <PreviewFrame platform={platform} />
          <div className="text-center text-[11px] text-muted-foreground">
            {activePaneData?.label ?? 'Select a pane'} — updates live as you edit
          </div>
        </aside>
      </div>
    </div>
  )
}
