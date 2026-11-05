import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { refreshThemeEngineTokens } from '@/components/providers/ThemeEngineProvider'
import { paneValues, vkeyOf, type TEActiveTheme, type TEPane } from './types'
import type { ThemeEngineState } from './useThemeEngineState'

// Pull a human-readable reason out of a failed mutation. The backend 422 shape
// is { success, message, errors: { fieldErrors, formErrors: string[] } } — the
// formErrors name the exact offending field(s); surface them instead of a
// generic "Could not save" so a bad value is diagnosable from the toast.
function mutationErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data as
    { message?: string; errors?: { formErrors?: unknown } } | undefined
  const formErrors = data?.errors?.formErrors
  if (Array.isArray(formErrors) && formErrors.length) return formErrors.join('; ')
  if (typeof data?.message === 'string' && data.message) return data.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

// The write side of the editor: save / reset / active-theme / take-over mutations
// and the Save handler. Reads and updates the state owned by useThemeEngineState.
export function useThemeEngineActions({
  platform,
  panes,
  activePane,
  activePaneIsDirty,
  activeThemeIsDirty,
  activeThemeLocal,
  setActiveThemeSaved,
  localValuesRef,
  setLocalValues,
  setSavedValues,
}: ThemeEngineState) {
  const qc = useQueryClient()

  // ── Mutations ────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async ({ paneId, platform: plat }: { paneId: string; platform: string }) => {
      const pane = panes.find((p) => p.id === paneId)
      if (!pane) throw new Error('Pane not found')
      const local = localValuesRef.current[vkeyOf(plat, paneId)] ?? {}
      const values = pane.groups.flatMap((g) =>
        g.fields.map((f) => ({ field_id: f.id, value: local[f.id] ?? f.value }))
      )
      return api.post('/theme-engine/values', {
        platform: plat,
        type_id: pane.type_id,
        values,
      })
    },
    onSuccess: (_, { paneId, platform: plat }) => {
      const k = vkeyOf(plat, paneId)
      setSavedValues((prev) => ({ ...prev, [k]: { ...(localValuesRef.current[k] ?? {}) } }))
      void qc.invalidateQueries({ queryKey: ['theme-engine-schema', plat] })
      toast({ title: 'Saved', description: 'Settings saved successfully.' })
    },
    onError: (err) => {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        const body = (err as { response?: { data?: { field?: string; message?: string } } })
          ?.response?.data
        const fieldName = body?.field
        toast({
          title: 'Field locked',
          description: fieldName
            ? `"${fieldName}" is locked by an active Templates run. Use "Take over" to release it.`
            : 'One or more fields are locked by an active Templates run.',
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Save failed',
          description: mutationErrorMessage(err, 'Could not save settings.'),
          variant: 'destructive',
        })
      }
    },
  })

  const activeThemeMutation = useMutation({
    mutationFn: async ({ platform: plat, theme }: { platform: string; theme: TEActiveTheme }) =>
      api.post('/theme-engine/active-theme', { platform: plat, theme }),
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
      return api.post('/theme-engine/reset', { platform: plat, type_id: pane.type_id })
    },
    onSuccess: (_, { paneId, platform: plat }) => {
      const k = vkeyOf(plat, paneId)
      const schemaKey = ['theme-engine-schema', plat]
      // Reload the schema, then re-seed this pane's local + saved values from it. Dropping them and
      // leaving the rebuild to the init effect in useThemeEngineState is not enough: that effect
      // re-runs only when `data` changes, and a pane that was never saved refetches a deep-equal
      // schema (TanStack keeps the same `data` reference), so later edits would go untracked.
      // 'all' + throwOnError: only ever seed from data fetched after the reset, never from a stale
      // cache (inactive platform, failed refetch).
      void qc
        .invalidateQueries({ queryKey: schemaKey, refetchType: 'all' }, { throwOnError: true })
        .then(() => {
          const pane = qc
            .getQueryData<{ panes: TEPane[] }>(schemaKey)
            ?.panes.find((p) => p.id === paneId)
          if (!pane) return
          setLocalValues((prev) => ({ ...prev, [k]: paneValues(pane) }))
          setSavedValues((prev) => ({ ...prev, [k]: paneValues(pane) }))
        })
        .catch(() => {
          // Refetch failed: the schema query already shows "Failed to load schema.".
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

  const takeoverMutation = useMutation({
    mutationFn: async () => api.post('/theme-engine/lock/release', { platform }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['theme-engine-schema', platform] })
      toast({ title: 'Taken over', description: 'You now control these settings.' })
    },
    onError: (err) => {
      toast({
        title: 'Take over failed',
        description: mutationErrorMessage(err, 'Could not release the run lock.'),
        variant: 'destructive',
      })
    },
  })

  const handleSave = async () => {
    try {
      if (activePaneIsDirty) await saveMutation.mutateAsync({ paneId: activePane, platform })
      if (activeThemeIsDirty) {
        await activeThemeMutation.mutateAsync({ platform, theme: activeThemeLocal[platform]! })
      }
      // Let the runtime provider re-fetch compiled tokens so the admin sees
      // the change immediately instead of needing a hard reload.
      refreshThemeEngineTokens()
    } catch {
      // Individual mutations already surface their own error toast.
    }
  }

  const isSaving = saveMutation.isPending || activeThemeMutation.isPending
  const isResetting = resetMutation.isPending

  return { handleSave, isSaving, isResetting, resetMutation, takeoverMutation }
}
