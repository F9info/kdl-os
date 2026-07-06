'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Settings2 } from 'lucide-react'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/layout/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Button } from '@/components/ui/button'
import type { SettingField, Type } from '@/types/models.types'
import { FieldControl, type FieldState } from '../../_components/FieldControl'

export default function TypeSettingsPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['setting-fields-by-type', slug],
    queryFn: () =>
      api
        .get(`/setting-fields/by-type/${slug}`)
        .then((r) => r.data.data as { type: Type; fields: SettingField[] }),
  })

  const fields = useMemo(() => data?.fields ?? [], [data])

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

  const saveMutation = useMutation({
    mutationFn: () => {
      const values = fields
        .filter((f) => f.input_type !== 'heading')
        .map((f) => {
          const state = form[f.id] ?? { value: '', alt_text: '' }
          let value = state.value
          if (f.input_type === 'multiple-files') {
            const paths = (state.gallery ?? []).map((g) => g.path)
            value = paths.length ? JSON.stringify(paths) : ''
          }
          return { id: f.id, value, alt_text: state.alt_text || null }
        })
      return api.post('/setting-fields/values', { type_id: data!.type.id, values })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setting-fields-by-type', slug] })
      // Refresh the sidebar logo in case this type holds the 'logo' field.
      queryClient.invalidateQueries({ queryKey: ['app-logo'] })
      toast({ title: 'Settings saved' })
    },
  })

  return (
    <PermissionGuard permission="setting-fields.view">
    <div>
      <PageHeader
        title={data?.type?.name ?? 'Settings'}
        breadcrumbs={[{ label: 'Application Settings' }, { label: data?.type?.name ?? 'Settings' }]}
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorAlert error={error} />
      ) : fields.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <Settings2 className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="font-medium">No fields for this type yet.</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Add fields under this type from the Fields page to start configuring it.
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
            {fields.map((field) => (
              <FieldControl
                key={field.id}
                field={field}
                state={form[field.id] ?? { value: '', alt_text: '' }}
                onChange={(patch) => updateField(field.id, patch)}
              />
            ))}
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
    </div>
    </PermissionGuard>
  )
}
