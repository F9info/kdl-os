'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Settings2 } from 'lucide-react'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Button } from '@/components/ui/button'
import type { SettingField, Type } from '@/types/models.types'
import { FieldControl, type FieldState } from './FieldControl'

// The generic editor for one settings Type's fields (what /admin/settings/view/<slug> shows),
// reusable inside other admin pages. `projectId` switches it to per-project overrides.
export function TypeSettingsForm({ slug, projectId }: { slug: string; projectId?: string | null }) {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['setting-fields-by-type', slug, projectId ?? null],
    queryFn: () =>
      api
        .get(`/setting-fields/by-type/${slug}`, { params: projectId ? { projectId } : undefined })
        .then((r) => r.data.data as { type: Type; fields: SettingField[] }),
  })

  // theme-settings' `logo` field is now managed exclusively by brand-kit's
  // per-project logo upload (template-engine intake) — see uploadLogo() in
  // backend/src/modules/brand-kit/service.js, which writes straight into
  // this same SettingField row via setGlobalLogo(). Hidden here (not
  // deleted) so the admin sidebar's `getValueBySlug('logo')` read keeps
  // working; only the manual-edit UI goes away.
  const fields = useMemo(
    () => (data?.fields ?? []).filter((f) => !(slug === 'theme-settings' && f.slug === 'logo')),
    [data, slug]
  )

  // Local editable state keyed by field id.
  const [form, setForm] = useState<Record<string, FieldState>>({})

  useEffect(() => {
    const next: Record<string, FieldState> = {}
    for (const f of fields) {
      next[f.id] = {
        value: f.value ?? '',
        alt_text: f.alt_text ?? '',
        preview: f.value_url,
        gallery: f.value_urls ?? [],
      }
    }
    setForm(next)
  }, [fields])

  function updateField(id: string, patch: Partial<FieldState>) {
    setForm((prev) => {
      const base: FieldState = prev[id] ?? { value: '', alt_text: '' }
      return { ...prev, [id]: { ...base, ...patch } }
    })
  }

  // Current form value of a field, as it would be saved.
  function fieldValue(f: SettingField): string {
    const state = form[f.id] ?? { value: '', alt_text: '' }
    if (f.input_type === 'multiple-files') {
      const paths = (state.gallery ?? []).map((g) => g.path)
      return paths.length ? JSON.stringify(paths) : ''
    }
    return state.value
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const values = fields
        .filter((f) => f.input_type !== 'heading')
        // Project mode saves overrides: send only what changed, so untouched
        // fields keep inheriting the global value instead of being copied.
        .filter((f) => !projectId || fieldValue(f) !== (f.value ?? ''))
        .map((f) => {
          const state = form[f.id] ?? { value: '', alt_text: '' }
          return { id: f.id, value: fieldValue(f), alt_text: state.alt_text || null }
        })
      return api.post('/setting-fields/values', {
        type_id: data!.type.id,
        values,
        ...(projectId ? { projectId } : {}),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setting-fields-by-type', slug] })
      queryClient.invalidateQueries({ queryKey: ['settings-field-values-public'] })
      // Refresh the sidebar logo in case this type holds the 'logo' field.
      queryClient.invalidateQueries({ queryKey: ['app-logo'] })
      toast({ title: 'Settings saved' })
    },
  })

  return (
    <>
      {isLoading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorAlert error={error} />
      ) : fields.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <Settings2 className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="font-medium">No fields for this type yet.</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Add fields under this type from the Custom Fields page to start configuring it.
          </p>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            saveMutation.mutate()
          }}
          className="max-w-3xl space-y-6"
        >
          <div className="space-y-6 rounded-lg border bg-card p-6">
            {fields.map((field, i) => {
              const prevCategory = i > 0 ? fields[i - 1]?.category?.name : undefined
              const showCategoryHeading = field.category && field.category.name !== prevCategory

              return (
                <div key={field.id}>
                  {showCategoryHeading && (
                    <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                      {field.category!.name}
                    </h3>
                  )}
                  <FieldControl
                    field={field}
                    state={form[field.id] ?? { value: '', alt_text: '' }}
                    onChange={(patch) => updateField(field.id, patch)}
                  />
                </div>
              )
            })}
          </div>

          {saveMutation.error && <ErrorAlert error={saveMutation.error} />}

          <div className="flex justify-end">
            <Button type="submit" disabled={saveMutation.isPending}>
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? 'Saving…' : 'Save settings'}
            </Button>
          </div>
        </form>
      )}
    </>
  )
}
