'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import { PageHeader } from '@/components/layout/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import type { SettingField, Type } from '@/types/models.types'
import { TypeSettingsForm } from '../../_components/TypeSettingsForm'

export default function TypeSettingsPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug
  // `?projectId=` switches this screen to per-project overrides of the global
  // values (e.g. a different Vision/Mission per project).
  const projectId = useSearchParams().get('projectId')

  // Same key as TypeSettingsForm's query — one request, used here only for the title.
  const { data } = useQuery({
    queryKey: ['setting-fields-by-type', slug, projectId],
    queryFn: () =>
      api
        .get(`/setting-fields/by-type/${slug}`, { params: projectId ? { projectId } : undefined })
        .then((r) => r.data.data as { type: Type; fields: SettingField[] }),
  })

  return (
    <PermissionGuard permission="setting-fields:view">
      <div>
        <PageHeader
          title={data?.type?.name ?? 'Settings'}
          breadcrumbs={[{ label: 'Settings' }, { label: data?.type?.name ?? 'Settings' }]}
        />

        {projectId && (
          <p className="mb-4 max-w-3xl rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Editing values for <strong>this project only</strong>. Fields you change here override
            the global value for this project; clear a field to inherit the global value again.
          </p>
        )}

        <TypeSettingsForm slug={slug} projectId={projectId} />
      </div>
    </PermissionGuard>
  )
}
