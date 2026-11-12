'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { usePermissions } from '@/admin/hooks/usePermissions'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { AppTypeCards, ModulePreview, type AppTypeInfo } from '@/components/install/AppTypeCards'

interface Config {
  type: string | null
  types: AppTypeInfo[]
}

function ApplicationContent() {
  const qc = useQueryClient()
  const { can } = usePermissions()
  const [choice, setChoice] = useState<string | null>(null)
  const seeded = useRef(false)
  const canChange = can('settings:edit') && can('modules:add') && can('modules:edit')

  const { data, isLoading, error } = useQuery({
    queryKey: ['install', 'config'],
    queryFn: () => api.get('/install/config').then((r) => r.data.data as Config),
  })
  useEffect(() => {
    if (data && !seeded.current) {
      setChoice(data.type)
      seeded.current = true
    }
  }, [data])

  const apply = useMutation({
    mutationFn: () =>
      api.put('/install/config/app-type', { app_type: choice }, { timeout: 300_000 }),
    onSuccess: () => {
      for (const key of ['install', 'modules-enabled', 'module-graph', 'modules', 'nav'])
        qc.invalidateQueries({ queryKey: [key] })
      toast({
        title: 'Application type updated',
        description: 'Missing modules were added. Nothing was removed.',
      })
    },
  })

  if (isLoading) return <LoadingSpinner />
  if (error || !data) return <ErrorAlert error={error ?? new Error('Could not load')} />
  const selected = data.types.find((t) => t.key === choice)
  const changed = choice !== data.type

  return (
    <div className="max-w-4xl">
      <PageHeader title="Application" />
      <p className="mb-6 text-sm text-muted-foreground">
        What this project is for. Changing it adds any modules the new type needs. It never removes
        a module or deletes content, and your website and users are kept as they are. Company name,
        logo, phone and email are in{' '}
        <Link href="/admin/settings/identity" className="text-primary underline">
          Identity
        </Link>
        .
      </p>
      <AppTypeCards
        types={data.types}
        value={choice}
        onChange={setChoice}
        disabled={!canChange || apply.isPending}
      />
      {selected && (
        <div className="mt-4">
          <ModulePreview type={selected} />
        </div>
      )}
      {apply.error && <ErrorAlert error={apply.error} className="mt-4" />}
      {canChange && (
        <div className="mt-6 flex items-center gap-3">
          <Button onClick={() => apply.mutate()} disabled={!choice || !changed || apply.isPending}>
            {apply.isPending ? 'Applying…' : 'Apply change'}
          </Button>
          {!data.type && (
            <span className="text-sm text-muted-foreground">
              No type is recorded for this install yet.
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default function ApplicationPage() {
  return (
    <PermissionGuard permission="settings:view">
      <ApplicationContent />
    </PermissionGuard>
  )
}
