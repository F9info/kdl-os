'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTemplateEngineRuns } from '@/hooks/useTemplateEngine'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { DAG_STAGES, stageEnumToSlug } from '@/types/template-engine.types'

export default function ProjectRootPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const router = useRouter()
  const { data: runs, isLoading } = useTemplateEngineRuns(projectId)

  useEffect(() => {
    if (isLoading) return
    const run = runs?.[0]
    if (!run) {
      // No run yet — show intake to start
      router.replace(`/admin/template-engine/projects/${projectId}/intake`)
      return
    }

    // Navigate to the first non-done stage or the last completed one
    const firstIncomplete = DAG_STAGES.find((def) => {
      const stageRow = run.stages.find((s) => s.stage === def.stage)
      return !stageRow || (stageRow.status !== 'DONE' && stageRow.status !== 'SKIPPED')
    })

    const slug = firstIncomplete
      ? firstIncomplete.slug
      : stageEnumToSlug(run.stages[run.stages.length - 1]?.stage ?? 'EXPORT')

    router.replace(`/admin/template-engine/projects/${projectId}/${slug}`)
  }, [isLoading, runs, projectId, router])

  return <LoadingSpinner fullPage />
}
