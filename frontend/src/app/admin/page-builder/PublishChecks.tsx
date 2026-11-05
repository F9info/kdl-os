'use client'

import { AlertCircle, AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import type { PageIssue } from './store'

/** Plain-language name for the block an issue points at. */
const blockName = (type: string | null) => (type ? type.replace(/([a-z])([A-Z])/g, '$1 $2') : null)

/**
 * Shown before publishing when the page checks found something. Errors are things that are broken
 * for visitors: fixing them is the default, "Publish anyway" is the author's explicit choice.
 * Warnings are suggestions: they never need an override.
 */
export function PublishChecksDialog({
  issues,
  busy,
  onBack,
  onPublish,
}: {
  issues: PageIssue[]
  busy: boolean
  onBack: () => void
  /** `anyway` is true when there are errors being overridden. */
  onPublish: (anyway: boolean) => void
}) {
  const errors = issues.filter((i) => i.severity === 'error')
  const warnings = issues.filter((i) => i.severity === 'warning')
  const hasErrors = errors.length > 0

  const group = (list: PageIssue[], kind: 'error' | 'warning') =>
    list.length > 0 && (
      <section aria-label={kind === 'error' ? 'Problems' : 'Suggestions'}>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
          {kind === 'error' ? (
            <AlertCircle className="h-4 w-4 text-destructive" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          )}
          {kind === 'error'
            ? `${list.length} ${list.length === 1 ? 'problem' : 'problems'} to fix`
            : `${list.length} ${list.length === 1 ? 'suggestion' : 'suggestions'}`}
        </h3>
        <ul className="space-y-1.5 text-sm">
          {list.map((i, n) => (
            <li key={`${i.code}-${i.block_id ?? ''}-${n}`} className="rounded-md border px-3 py-2">
              {i.message}
              {blockName(i.block_type) && (
                <span className="ml-2 text-xs text-muted-foreground">
                  in {blockName(i.block_type)}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    )

  return (
    <Modal
      open
      onClose={onBack}
      size="lg"
      title={hasErrors ? 'Fix these before publishing?' : 'Ready to publish?'}
      description={
        hasErrors
          ? 'Visitors would hit these problems. Go back to fix them, or publish anyway.'
          : 'Nothing is broken. These suggestions would improve the page.'
      }
    >
      <div className="space-y-4">
        {group(errors, 'error')}
        {group(warnings, 'warning')}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onBack} disabled={busy}>
            Back to editing
          </Button>
          <Button
            variant={hasErrors ? 'destructive' : 'default'}
            onClick={() => onPublish(hasErrors)}
            disabled={busy}
          >
            {busy ? 'Publishing…' : hasErrors ? 'Publish anyway' : 'Publish'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
