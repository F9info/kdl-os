'use client'

// Simple 3-step Theme Engine view: Pick → See → Publish.
// Edits only the handful of brand colours (and the heading / body font) that
// matter most; everything else stays in the Advanced view. Same API as the
// Advanced page (/schema, /values).
//
// The See card shows what the site will have after Publish: the draft for those colours and
// fonts, everything else exactly as published (that includes the primary button's text colour,
// which Publish never changes; a contrast warning covers it).

import { useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, Lock, Palette as PaletteIcon, Sun, Moon, Undo2 } from 'lucide-react'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { loadGoogleFont } from '@/lib/load-google-font'
import { refreshThemeEngineTokens } from '@/components/providers/ThemeEngineProvider'
import {
  applyFonts,
  currentFonts,
  draftRows,
  familyNames,
  fontChoices,
  fontCssVars,
  withGoogleFonts,
  type FontPick,
} from './simple/fonts'
import {
  HEX6,
  PRESETS,
  QUICK,
  contrastWarnings,
  tokenVar,
  type Palette,
  type QuickKey,
} from './simple/palette'
import { ThemePreview } from './simple/ThemePreview'

const PLATFORM = 'webapp'

interface SimpleField {
  id: string
  slug: string
  field_name: string
  input_type?: string
  options?: unknown
  value: string | null
  locked_by?: string | null
  updated_at?: string | null
}
interface SimpleGroup {
  slug: string
  fields: SimpleField[]
}
interface SimplePane {
  id: string
  type_id: string
  groups: SimpleGroup[]
}

interface ThemeVersion {
  id: string
  created_at: string
  field_count: number
}

// GET /brand-kit/:projectId/theme-colors
interface BrandKitColours {
  approved?: boolean
  light?: Partial<Palette>
  dark?: Partial<Palette>
}

type Mode = 'light' | 'dark'
type FontKey = keyof FontPick

const FONT_LABELS: Record<FontKey, string> = { heading: 'Heading font', body: 'Body font' }

const statusOf = (err: unknown) => (err as { response?: { status?: number } })?.response?.status

export function SimpleThemeView() {
  const qc = useQueryClient()
  const [mode, setMode] = useState<Mode>('light')
  // fieldId → edited value (only colour fields the user changed)
  const [edits, setEdits] = useState<Record<string, string>>({})
  // heading / body font the user picked (only what they changed)
  const [fontEdits, setFontEdits] = useState<FontPick>({})
  const [kitNote, setKitNote] = useState<string | null>(null)
  // Publish saves colours first, then fonts; remembers how far it got for the error message.
  const coloursSaved = useRef(false)

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['theme-simple-schema', PLATFORM],
    queryFn: () =>
      api
        .get<{ data: { schema: SimplePane[] } }>(`/theme-engine/schema?platform=${PLATFORM}`)
        .then((r) => {
          const panes = r.data.data.schema
          return {
            branding: panes.find((p) => p.id === 'branding') ?? null,
            typography: panes.find((p) => p.id === 'typography') ?? null,
            // read only: the primary button's text colour, which the preview shows as published
            buttons: panes.find((p) => p.id === 'buttons') ?? null,
          }
        }),
    staleTime: 30_000,
    // Publish writes every field it was loaded with, so never publish from a
    // copy that is older than what Advanced may have saved since: re-read on
    // every mount, and keep Publish off while that read is in flight.
    refetchOnMount: 'always',
  })
  const branding = data?.branding ?? null
  const typography = data?.typography ?? null
  const buttons = data?.buttons ?? null

  const brandingFields = useMemo(
    () => (branding?.groups ?? []).flatMap((g) => g.fields),
    [branding]
  )
  // One typo_table per device; the font selects rewrite the family in all of them.
  const typoFields = useMemo(
    () =>
      (typography?.groups ?? [])
        .flatMap((g) => g.fields)
        .filter((f) => f.input_type === 'typo_table'),
    [typography]
  )
  // The "Custom Fonts" list: the only fonts the live site loads.
  const customFonts = useMemo(
    () => (typography?.groups ?? []).flatMap((g) => g.fields).find((f) => f.input_type === 'fonts'),
    [typography]
  )
  // Text colour of the primary button in this mode: a published token Publish never changes
  // (it is not a branding field), but the site puts it on the main colour.
  const buttonLabel = useMemo(
    () =>
      (buttons?.groups ?? [])
        .flatMap((g) => g.fields)
        .find((f) => f.slug === `${PLATFORM}.buttons.${mode}.primary_button.text_color`),
    [buttons, mode]
  )

  // slug → field, for the current mode only
  const quick = useMemo(() => {
    const out = {} as Record<QuickKey, SimpleField | undefined>
    for (const q of QUICK) {
      out[q.key] = brandingFields.find((f) => f.slug === `${PLATFORM}.branding.${mode}.${q.path}`)
    }
    return out
  }, [brandingFields, mode])

  const valueOf = (k: QuickKey): string => {
    const f = quick[k]
    return f ? (edits[f.id] ?? f.value ?? '') : ''
  }
  const palette = Object.fromEntries(QUICK.map((q) => [q.key, valueOf(q.key)])) as Palette
  // Published value of every other colour in this mode (and of the button text colour), so the
  // preview shows exactly what Publish leaves alone and never borrows the admin panel's own
  // theme for a token the quick colours skip.
  const baseVars = useMemo(
    () =>
      Object.fromEntries(
        [
          ...brandingFields.filter((f) => f.slug.startsWith(`${PLATFORM}.branding.${mode}.`)),
          ...(buttonLabel ? [buttonLabel] : []),
        ]
          .filter((f) => f.value)
          .map((f) => [tokenVar(f.slug), f.value as string])
      ),
    [brandingFields, buttonLabel, mode]
  )

  const current = useMemo(() => currentFonts(typoFields.map((f) => f.value)), [typoFields])
  const choices = useMemo(() => fontChoices(typoFields[0]?.options), [typoFields])
  const fontKeys = (['heading', 'body'] as const).filter((k) => choices.length > 0 && current[k])
  const fontOf = (k: FontKey) => fontEdits[k] ?? current[k] ?? ''
  // What the typography tables will say once published, row by row, for the preview.
  const fontVars = fontCssVars(
    draftRows(
      typoFields.map((f) => f.value),
      fontEdits
    )
  )
  // Typography tables whose text actually changes with the picked fonts.
  const fontValues = typoFields.flatMap((f) => {
    const next = applyFonts(f.value, fontEdits)
    return next !== null && next !== f.value ? [{ field_id: f.id, value: next }] : []
  })
  // A picked family also has to be in Custom Fonts, or the live site never loads it.
  const fontList = customFonts
    ? withGoogleFonts(customFonts.value, Object.values(fontEdits).flatMap(familyNames))
    : null
  const fontListValues =
    customFonts && fontList !== null && fontList !== customFonts.value
      ? [{ field_id: customFonts.id, value: fontList }]
      : []

  const locked = [...QUICK.map((q) => quick[q.key]), ...typoFields].some((f) => f?.locked_by)
  const lastSaved = QUICK.map((q) => quick[q.key]?.updated_at)
    .filter((d): d is string => !!d)
    .sort()
    .pop()
  const lastSavedText = lastSaved
    ? new Date(lastSaved).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : null
  const dirtyColours = Object.keys(edits).length > 0
  const dirty = dirtyColours || fontValues.length > 0

  const setColour = (k: QuickKey, v: string) => {
    const f = quick[k]
    if (f) setEdits((prev) => ({ ...prev, [f.id]: v }))
  }
  // Puts the valid colours of `p` into the draft; returns how many it used.
  const applyPalette = (p: Partial<Palette>): number => {
    const patch: Record<string, string> = {}
    for (const q of QUICK) {
      const f = quick[q.key]
      const v = p[q.key]
      if (f && v && HEX6.test(v)) patch[f.id] = v
    }
    setEdits((prev) => ({ ...prev, ...patch }))
    return Object.keys(patch).length
  }

  // Loads the project's Brand Kit colours for the current mode into the draft.
  // Nothing is saved here: the user previews them and presses Publish (undoable).
  const brandKit = useMutation({
    mutationFn: async () => {
      const projects = await api
        .get<{ data: { id: string; is_default?: boolean }[] }>('/projects')
        .then((r) => r.data.data)
      const project = projects.find((p) => p.is_default) ?? projects[0]
      if (!project) return null
      return api
        .get<{ data: BrandKitColours }>(`/brand-kit/${project.id}/theme-colors`)
        .then((r) => r.data.data)
    },
    onSuccess: (kit) => {
      if (!kit) return setKitNote('No project found yet, so there is no Brand Kit to read.')
      const used = applyPalette(kit[mode] ?? {})
      setKitNote(
        used
          ? `Loaded your Brand Kit colours${kit.approved ? '' : ' (not approved yet)'}. Check the preview, then publish.`
          : `Your Brand Kit has no ${mode} colours to load yet.`
      )
    },
    onError: (err) => {
      const status = statusOf(err)
      setKitNote(
        status === 404 || status === 409
          ? 'Your Brand Kit has no colours yet. Finish its Palette step in Template Engine first.'
          : 'Could not reach your Brand Kit. Try again.'
      )
    },
  })

  // Re-reads everything the view shows; resolves once the fresh values are in.
  const invalidateTheme = () => {
    const reread = Promise.all([
      qc.invalidateQueries({ queryKey: ['theme-simple-schema', PLATFORM] }),
      qc.invalidateQueries({ queryKey: ['theme-engine-schema', PLATFORM] }),
      qc.invalidateQueries({ queryKey: ['theme-simple-versions', PLATFORM] }),
    ])
    refreshThemeEngineTokens()
    return reread
  }

  // Colours and fonts live in two Types, so each is its own POST, one after the other.
  const publish = useMutation({
    mutationFn: async () => {
      if (!branding) throw new Error('Theme not loaded')
      coloursSaved.current = false
      if (dirtyColours) {
        const values = brandingFields.map((f) => ({
          field_id: f.id,
          value: edits[f.id] ?? f.value ?? '',
        }))
        await api.post('/theme-engine/values', {
          platform: PLATFORM,
          type_id: branding.type_id,
          values,
        })
        coloursSaved.current = true
      }
      if (typography && fontValues.length) {
        await api.post('/theme-engine/values', {
          platform: PLATFORM,
          type_id: typography.type_id,
          values: [...fontValues, ...fontListValues],
        })
      }
    },
    onSuccess: async () => {
      // The draft stays on screen until the published values are back: clearing it first
      // would show the old palette in the inputs and the preview until the re-read lands.
      await invalidateTheme()
      setEdits({})
      setFontEdits({})
      toast({ title: 'Published', description: 'Your public website now uses this theme.' })
    },
    onError: async (err) => {
      const status = statusOf(err)
      const coloursWentOut = coloursSaved.current
      toast({
        title:
          status === 409
            ? 'Theme is locked'
            : coloursWentOut
              ? 'Fonts not published'
              : 'Publish failed',
        description:
          status === 409
            ? 'A Template Engine run controls these settings. Use "Take over" first.'
            : coloursWentOut
              ? 'Your colours were published, but the fonts could not be saved. Try Publish again.'
              : 'Could not save the theme. Try again.',
        variant: 'destructive',
      })
      // Even a half-finished publish changed something live (or the lock state changed).
      await invalidateTheme()
      // Colours that already went out are no longer a draft; a failed font save stays one.
      if (coloursWentOut) setEdits({})
    },
  })

  const takeover = useMutation({
    // `locks` (plural) is the only release route the backend registers.
    mutationFn: () => api.post('/theme-engine/locks/release', { platform: PLATFORM }),
    onSuccess: async () => {
      void qc.invalidateQueries({ queryKey: ['theme-engine-schema', PLATFORM] })
      await qc.invalidateQueries({ queryKey: ['theme-simple-schema', PLATFORM] })
      toast({ title: 'Taken over', description: 'You can now edit these colours.' })
    },
    onError: () =>
      toast({
        title: 'Take over failed',
        description: 'Could not release the lock.',
        variant: 'destructive',
      }),
  })

  // History is per Type, so it follows the colours (branding) only.
  const versions = useQuery({
    queryKey: ['theme-simple-versions', PLATFORM, branding?.type_id],
    enabled: !!branding?.type_id,
    queryFn: () =>
      api
        .get<{ data: { versions: ThemeVersion[] } }>('/theme-engine/versions', {
          params: { platform: PLATFORM, type_id: branding!.type_id },
        })
        .then((r) => r.data.data.versions),
  })

  const restore = useMutation({
    mutationFn: (id: string) => api.post(`/theme-engine/versions/${id}/restore`),
    onSuccess: async () => {
      await invalidateTheme()
      setEdits({})
      toast({ title: 'Restored', description: 'The earlier version is live again.' })
    },
    onError: (err) => {
      const status = statusOf(err)
      toast({
        title: status === 409 ? 'Colours are locked' : 'Restore failed',
        description:
          status === 409
            ? 'A Template Engine run controls these colours. Use "Take over" first.'
            : 'Could not restore that version.',
        variant: 'destructive',
      })
    },
  })

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Loading theme…</p>
  if (isError || !branding) {
    return (
      <p className="p-6 text-sm text-destructive">Could not load the theme. Try Advanced view.</p>
    )
  }

  const warnings = contrastWarnings(palette, buttonLabel?.value)

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6" data-testid="simple-theme-view">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Your theme</h1>
        <p className="text-sm text-muted-foreground">
          Pick a look, check the preview, publish. Changes apply to your public website; this admin
          panel keeps its own look.
        </p>
      </header>

      <div
        className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted p-3 text-sm"
        role="status"
        data-testid="theme-source-strip"
      >
        {locked ? (
          <Lock className="h-4 w-4" aria-hidden />
        ) : (
          <Check className="h-4 w-4" aria-hidden />
        )}
        <span className="flex-1 text-foreground">
          {locked
            ? 'Colours are set automatically from your approved Brand Kit by Template Engine, and are locked while it runs.'
            : lastSavedText
              ? `You control these colours. Last published ${lastSavedText}.`
              : 'You control these colours. Nothing published yet, so defaults are in use.'}
        </span>
        {locked && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => takeover.mutate()}
            disabled={takeover.isPending}
          >
            Take over to edit
          </Button>
        )}
      </div>

      {/* Side by side only where the preview still gets a useful width; stacked below that. */}
      <ol className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        {/* 1 · PICK */}
        <li className="min-w-0 space-y-4 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">1 · Pick</h2>

          <div className="flex gap-2" role="group" aria-label="Light or dark">
            {(['light', 'dark'] as const).map((m) => (
              <Button
                key={m}
                size="sm"
                variant={mode === m ? 'default' : 'outline'}
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
              >
                {m === 'light' ? (
                  <Sun className="mr-1 h-4 w-4" />
                ) : (
                  <Moon className="mr-1 h-4 w-4" />
                )}
                {m === 'light' ? 'Light' : 'Dark'}
              </Button>
            ))}
          </div>

          <div>
            <p className="mb-2 text-xs text-muted-foreground">Start from a look</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  disabled={locked}
                  onClick={() => applyPalette(p[mode])}
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-50"
                >
                  <span className="h-3 w-3 rounded-full" style={{ background: p[mode].primary }} />
                  {p.name}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={locked || brandKit.isPending}
              onClick={() => brandKit.mutate()}
            >
              <PaletteIcon className="mr-1 h-4 w-4" />
              Use my Brand Kit colours
            </Button>
            {kitNote && (
              <p
                className="mt-2 text-xs text-muted-foreground"
                role="status"
                data-testid="brand-kit-note"
              >
                {kitNote}
              </p>
            )}
          </div>

          <div className="space-y-3">
            {QUICK.map((q) => {
              const v = valueOf(q.key)
              return (
                <label key={q.key} className="flex items-center gap-3 text-sm text-foreground">
                  <span className="w-32 shrink-0">{q.label}</span>
                  <input
                    type="color"
                    aria-label={q.label}
                    disabled={locked || !quick[q.key]}
                    value={HEX6.test(v) ? v : '#000000'}
                    onChange={(e) => setColour(q.key, e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
                  />
                  <code className="text-xs text-muted-foreground">{v || '—'}</code>
                </label>
              )
            })}
          </div>

          {fontKeys.length > 0 && (
            <div className="space-y-3">
              {fontKeys.map((k) => {
                // Keep a font the table already uses even if it is not in the list.
                const options = Array.from(new Set([...choices, fontOf(k)]))
                return (
                  <label key={k} className="flex items-center gap-3 text-sm text-foreground">
                    <span className="w-32 shrink-0">{FONT_LABELS[k]}</span>
                    <select
                      aria-label={FONT_LABELS[k]}
                      disabled={locked}
                      value={fontOf(k)}
                      onChange={(e) => {
                        // so the preview can show the family for real instead of falling back
                        familyNames(e.target.value).forEach(loadGoogleFont)
                        setFontEdits((prev) => ({ ...prev, [k]: e.target.value }))
                      }}
                      className="min-w-0 flex-1 rounded border border-border bg-muted px-2 py-1 text-sm"
                    >
                      {options.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                )
              })}
            </div>
          )}
        </li>

        {/* 2 · SEE */}
        <li className="min-w-0 space-y-3 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">2 · See</h2>
          <ThemePreview palette={palette} mode={mode} baseVars={baseVars} fontVars={fontVars} />
        </li>
      </ol>

      {warnings.length > 0 && (
        <div
          className="flex gap-3 rounded-md border border-border bg-muted p-3 text-sm text-foreground"
          role="alert"
          data-testid="contrast-warning"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <ul className="space-y-1">
            {warnings.map((w) => (
              <li key={w.label}>
                <strong>{w.label}</strong> is hard to read (contrast {w.ratio.toFixed(1)}:1, aim for{' '}
                {w.min}:1 or more).{w.fix ? ` ${w.fix}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 3 · PUBLISH */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">3 · Publish</h2>
          <p className="text-xs text-muted-foreground">
            {dirty ? 'You have unpublished changes.' : 'Everything is published.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!dirty}
            onClick={() => {
              setEdits({})
              setFontEdits({})
            }}
          >
            Discard
          </Button>
          {/* Not while the theme is being re-read: Publish writes every field it holds, so a
              stale copy would overwrite what Advanced saved in the meantime. */}
          <Button
            disabled={!dirty || locked || publish.isPending || isFetching}
            onClick={() => publish.mutate()}
          >
            {publish.isPending ? 'Publishing…' : 'Publish theme'}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4" data-testid="theme-history">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Colour history</h2>
            <p className="text-xs text-muted-foreground">
              Colours only. Font changes are not kept in this list.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!versions.data?.length || locked || restore.isPending}
            onClick={() => restore.mutate(versions.data![0]!.id)}
          >
            <Undo2 className="mr-1 h-4 w-4" />
            Undo last colour change
          </Button>
        </div>
        {versions.data?.length ? (
          <ul className="mt-3 divide-y divide-border text-sm">
            {versions.data.slice(0, 5).map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-foreground">
                  Before the change on{' '}
                  {new Date(v.created_at).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={locked || restore.isPending}
                  onClick={() => restore.mutate(v.id)}
                >
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            No earlier versions yet. Each colour change (an undo too) saves the previous colours
            here so you can go back.
          </p>
        )}
      </section>
    </div>
  )
}
