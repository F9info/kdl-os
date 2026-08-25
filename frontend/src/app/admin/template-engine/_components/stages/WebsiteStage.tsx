'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowRight, Globe, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAdvanceStage, useRetryStage, useSkipStage } from '@/hooks/useTemplateEngine'
import { StageShell } from './StageShell'
import type { TemplateEngineRun } from '@/types/template-engine.types'

// Mirrors the design prototype's "Brands" grid (a card per brand surface —
// web app, admin app, visiting card, letterhead, t-shirt, ID card). Only
// "Web app" is wired up so far — per explicit instruction, ship one card's
// flow before adding the rest (roadmap row 4a; the other cards are rows 4b/4c,
// not yet spec'd). Unimplemented cards are intentionally omitted rather than
// shown disabled — nothing to click through to yet.
const BRAND_CARDS = [{ key: 'webapp', name: 'Web app' }] as const

export function WebsiteStage({ run }: { run: TemplateEngineRun }) {
  const stage = run.stages.find((s) => s.stage === 'WEBSITE')
  const advance = useAdvanceStage(run.id, run.projectId)
  const retry = useRetryStage(run.id, run.projectId)
  const skip = useSkipStage(run.id, run.projectId)
  const [openBrand, setOpenBrand] = useState<(typeof BRAND_CARDS)[number]['key'] | null>(null)

  const outputRef = stage?.outputRef as { pageIds?: Record<string, string> } | null | undefined

  const pageCount = outputRef?.pageIds ? Object.keys(outputRef.pageIds).length : 0

  return (
    <StageShell
      title="Website Assembly"
      description="Seed website pages from Puck component packs filtered by industry, using the approved brand kit as slot defaults. Pages are created in the page-builder engine."
      stage={stage ?? null}
      hideRunButton={openBrand === null}
      onRun={
        stage?.status === 'FAILED' ? () => retry.mutate('WEBSITE') : () => advance.mutate('WEBSITE')
      }
      onSkip={() => skip.mutate('WEBSITE')}
      isRunning={advance.isPending || retry.isPending}
    >
      {openBrand === null ? (
        <div className="space-y-3">
          <div>
            <h3 className="text-base font-semibold">Brands</h3>
            <p className="text-sm text-muted-foreground">
              Your brand surfaces. Click a card to open it.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {BRAND_CARDS.map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={() => setOpenBrand(b.key)}
                className="rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent"
              >
                <div className="text-sm font-semibold">{b.name}</div>
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  Open <ArrowRight className="h-3 w-3" />
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpenBrand(null)}
            className="gap-1.5 px-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Brands
          </Button>

          {pageCount > 0 ? (
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Globe className="h-4 w-4 text-primary" />
                {pageCount} page{pageCount !== 1 ? 's' : ''} assembled
              </div>
              <p className="text-xs text-muted-foreground">
                Pages are live in the page-builder engine. Direct editing is disabled while Studio
                is active — use the page-builder screen to preview.
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
      )}
    </StageShell>
  )
}
