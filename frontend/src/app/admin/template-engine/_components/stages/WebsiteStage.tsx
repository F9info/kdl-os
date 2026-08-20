'use client'

import { Globe, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAdvanceStage } from '@/hooks/useTemplateEngine'
import { StageShell } from './StageShell'
import type { TemplateEngineRun } from '@/types/template-engine.types'

export function WebsiteStage({ run }: { run: TemplateEngineRun }) {
  const stage = run.stages.find((s) => s.stage === 'WEBSITE')
  const advance = useAdvanceStage(run.id, run.projectId)

  const outputRef = stage?.outputRef as { pageIds?: Record<string, string> } | null | undefined

  const pageCount = outputRef?.pageIds ? Object.keys(outputRef.pageIds).length : 0

  return (
    <StageShell
      title="Website Assembly"
      description="Seed website pages from Puck component packs filtered by industry, using the approved brand kit as slot defaults. Pages are created in the page-builder engine."
      stage={stage ?? null}
      onRun={() => advance.mutate('WEBSITE')}
      isRunning={advance.isPending}
    >
      <div className="space-y-3">
        {pageCount > 0 ? (
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Globe className="h-4 w-4 text-primary" />
              {pageCount} page{pageCount !== 1 ? 's' : ''} assembled
            </div>
            <p className="text-xs text-muted-foreground">
              Pages are live in the page-builder engine. Direct editing is disabled while Studio is
              active — use the page-builder screen to preview.
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href="/admin/page-builder" target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                Preview in page builder
              </a>
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            <Globe className="h-4 w-4 shrink-0" />
            <span>
              No pages assembled yet. Requires brand approval (stage 4) and the relevant component
              pack for your industry.
            </span>
          </div>
        )}
      </div>
    </StageShell>
  )
}
