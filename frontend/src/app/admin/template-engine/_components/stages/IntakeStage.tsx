'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import api from '@/lib/axios'
import { useAdvanceStage, useBrandKit, useRetryStage } from '@/hooks/useTemplateEngine'
import { StageShell } from './StageShell'
import { Button } from '@/components/ui/button'
import type { SettingField, Type } from '@/types/models.types'
import { DAG_STAGES, type TemplateEngineRun } from '@/types/template-engine.types'

// Logo + contact details are edited under CMS → Company Details; this stage
// only checks they exist before letting the run move on.
export function IntakeStage({ run }: { run: TemplateEngineRun }) {
  const router = useRouter()
  const stage = run.stages.find((s) => s.stage === 'INTAKE')
  const advance = useAdvanceStage(run.id, run.projectId)
  const retry = useRetryStage(run.id, run.projectId)
  const { data: brandKit } = useBrandKit(run.projectId)

  const { data } = useQuery({
    queryKey: ['setting-fields-by-type', 'brand-profile'],
    queryFn: () =>
      api
        .get('/setting-fields/by-type/brand-profile')
        .then((r) => r.data.data as { type: Type; fields: SettingField[] }),
  })

  const hasLogo = !!brandKit?.logo_media_id
  const hasCompany = !!data?.fields
    .find((f) => f.slug === 'brand-profile-company-name')
    ?.value?.trim()
  const ready = hasLogo && hasCompany
  const isBusy = advance.isPending || retry.isPending

  function handleNext() {
    if (stage?.status === 'FAILED') {
      retry.mutate('INTAKE') // resets FAILED -> PENDING; user clicks Next again to actually advance
      return
    }
    advance.mutate('INTAKE', {
      onSuccess: () => {
        const next = DAG_STAGES[DAG_STAGES.findIndex((s) => s.stage === 'INTAKE') + 1]
        if (next) router.push(`/admin/template-engine/projects/${run.projectId}/${next.slug}`)
      },
    })
  }

  const Row = ({ ok, label }: { ok: boolean; label: string }) => (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
      ) : (
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      )}
      {label}
    </div>
  )

  return (
    <StageShell
      title="Overview"
      description="Your logo and contact details are managed under CMS → Company Details."
      stage={stage ?? null}
      hideRunButton
    >
      <div className="rounded-lg border bg-card px-6 py-6 space-y-4">
        <Row ok={hasLogo} label="Logo uploaded" />
        <Row ok={hasCompany} label="Company name entered" />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href="/admin/website-details">Edit Company Details</Link>
          </Button>
          <Button size="sm" onClick={handleNext} disabled={!ready || isBusy}>
            {isBusy ? 'Saving…' : 'Next'}
          </Button>
        </div>
      </div>
    </StageShell>
  )
}
