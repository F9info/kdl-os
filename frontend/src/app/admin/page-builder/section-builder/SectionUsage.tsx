'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { toast } from '@/hooks/use-toast'
import { Modal } from '@/components/shared/Modal'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { LoadingState } from '@/components/ui/loading-state'
import { Button } from '@/components/ui/button'
import {
  getSectionUsage,
  updateSectionPages,
  type CustomBlockRecord,
} from '@/frontend/blocks/packs/composer/custom-blocks-store'

/** Where a saved section is used, and one click to bring the pages that are behind up to date. */
export function SectionUsageDialog({
  block,
  projectId,
  onClose,
}: {
  block: CustomBlockRecord
  projectId: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const key = ['section-usage', block.id] as const
  const { data, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => getSectionUsage(block.id, projectId),
  })
  const update = useMutation({
    mutationFn: () => updateSectionPages(block.id, projectId),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: key })
      toast({
        title: `Updated ${r.updated.length} ${r.updated.length === 1 ? 'page' : 'pages'}`,
        description: r.needsPublish
          ? `${r.needsPublish} published ${r.needsPublish === 1 ? 'page needs' : 'pages need'} to be published again to go live.`
          : undefined,
      })
    },
  })
  const behind = data?.pages.reduce((n, p) => n + p.outdated, 0) ?? 0

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Pages using “${block.name}”`}
      description={`Saved section version ${data?.version ?? block.version}. Pages keep the version they were made from until you update them.`}
    >
      <div className="space-y-4">
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorAlert error={error} />
        ) : !data?.pages.length ? (
          <p className="text-sm text-muted-foreground">No page uses this section yet.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {data.pages.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <Link
                    href={`/admin/template-engine/edit/${p.id}`}
                    className="font-medium text-primary underline"
                  >
                    {p.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {p.status === 'PUBLISHED' ? 'Published' : 'Draft'} · {p.blocks}{' '}
                    {p.blocks === 1 ? 'use' : 'uses'}
                    {p.detached ? ` · ${p.detached} customised on the page` : ''}
                  </p>
                </div>
                <span
                  className={
                    p.outdated
                      ? 'rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900'
                      : 'rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary'
                  }
                >
                  {p.outdated ? `${p.outdated} behind` : 'Up to date'}
                </span>
              </li>
            ))}
          </ul>
        )}
        {update.error ? <ErrorAlert error={update.error} /> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => update.mutate()} disabled={behind === 0 || update.isPending}>
            {update.isPending
              ? 'Updating…'
              : behind
                ? `Update ${behind} ${behind === 1 ? 'use' : 'uses'}`
                : 'Everything is up to date'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
