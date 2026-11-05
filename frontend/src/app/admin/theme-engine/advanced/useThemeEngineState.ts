import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import { parseRows as parseFontRows } from '../controls/FontsEditorControl'
import { NAV_GROUPS, LS_PLATFORM, LS_PANE, lsGet, lsSet } from './constants'
import {
  groupTag,
  normalizeSchema,
  paneValues,
  vkeyOf,
  type TEActiveTheme,
  type TEPane,
  type TESchemaEnvelope,
  type ValuesMap,
} from './types'

// Schema query + all editor state: UI prefs, saved/local values, dirty tracking
// and the derived views (visible/filtered groups, sidebar items). The write side
// (save/reset/active-theme/take-over) lives in useThemeEngineActions.
export function useThemeEngineState() {
  // ── UI prefs (localStorage only) ──────────────────────────────────────────
  const [platform, setPlatformState] = useState(() => lsGet(LS_PLATFORM, 'webapp'))
  const [activePane, setActivePaneState] = useState(() => lsGet(LS_PANE, ''))
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

  // ── API: load schema ──────────────────────────────────────────────────────
  const { data, isLoading, isError } = useQuery({
    queryKey: ['theme-engine-schema', platform],
    queryFn: () =>
      api.get<TESchemaEnvelope>(`/theme-engine/schema?platform=${platform}`).then((r) => ({
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
  // ThemeEngineProvider reads via GET /tokens.
  const [activeThemeSaved, setActiveThemeSaved] = useState<Record<string, TEActiveTheme>>({})
  const [activeThemeLocal, setActiveThemeLocal] = useState<Record<string, TEActiveTheme>>({})

  useEffect(() => {
    if (!data) return
    setActiveThemeSaved((prev) =>
      prev[platform] ? prev : { ...prev, [platform]: data.activeTheme }
    )
    setActiveThemeLocal((prev) =>
      prev[platform] ? prev : { ...prev, [platform]: data.activeTheme }
    )
  }, [data, platform])

  const isThemeDirty = useCallback(
    (plat: string) => {
      const saved = activeThemeSaved[plat]
      const local = activeThemeLocal[plat]
      return saved != null && local != null && saved !== local
    },
    [activeThemeSaved, activeThemeLocal]
  )

  // ── Local editable values (never localStorage) ────────────────────────────
  // Keyed by pane.id → { field.id: value }
  const [localValues, setLocalValues] = useState<Record<string, ValuesMap>>({})
  // Saved snapshot (to compute dirty) — refreshed from API on load / after save
  const [savedValues, setSavedValues] = useState<Record<string, ValuesMap>>({})

  // Namespaced by platform — see vkeyOf in ./types.
  const vkey = (paneId: string) => vkeyOf(platform, paneId)

  // When schema loads, initialize or refresh values for panes we haven't touched
  useEffect(() => {
    if (!panes.length) return
    setLocalValues((prev) => {
      const next = { ...prev }
      panes.forEach((pane) => {
        if (!next[vkey(pane.id)]) next[vkey(pane.id)] = paneValues(pane)
      })
      return next
    })
    setSavedValues((prev) => {
      const next = { ...prev }
      panes.forEach((pane) => {
        if (!next[vkey(pane.id)]) next[vkey(pane.id)] = paneValues(pane)
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
    [localValues, savedValues, platform]
  )

  // Read inside mutation callbacks via ref, not the closed-over `localValues`
  // — useMutation's onSuccess otherwise risks acting on the render's snapshot
  // from when the mutation was *defined*, not the latest edits made while the
  // request was in flight (the "Save needs two clicks" report on this pane).
  const localValuesRef = useRef(localValues)
  useEffect(() => {
    localValuesRef.current = localValues
  }, [localValues])

  const hasLockedFields = useMemo(
    () => panes.some((pane) => pane.groups.some((g) => g.fields.some((f) => f.locked_by))),
    [panes]
  )

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
    const fontsField = activePaneData?.groups
      .flatMap((g) => g.fields)
      .find((f) => f.input_type === 'fonts')
    if (!fontsField) return []
    const raw = activePaneValues[fontsField.id] ?? fontsField.value
    return parseFontRows(raw)
      .map((r) => r.name.trim())
      .filter(Boolean)
  }, [activePaneData, activePaneValues])

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
          (f) => f.field_name.toLowerCase().includes(q) || g.name.toLowerCase().includes(q)
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

  return {
    platform,
    setPlatform,
    activePane,
    setActivePane,
    search,
    setSearch,
    paneMode,
    setPaneMode,
    paneDevice,
    setPaneDevice,
    isLoading,
    isError,
    panes,
    activeThemeSaved,
    setActiveThemeSaved,
    activeThemeLocal,
    setActiveThemeLocal,
    activeThemeIsDirty,
    localValuesRef,
    setLocalValues,
    setSavedValues,
    isDirtyPane,
    handleFieldChange,
    hasLockedFields,
    activePaneData,
    activePaneValues,
    activePaneIsDirty,
    customFontNames,
    filteredGroups,
    toggleSection,
    isSectionOpen,
    sidebarItems,
  }
}

export type ThemeEngineState = ReturnType<typeof useThemeEngineState>
