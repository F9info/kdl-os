'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { History } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/admin/components/shared/ConfirmDialog'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { LoadingState } from '@/components/ui/loading-state'
import { Button } from '@/components/ui/button'
import {
  listPageVersions,
  restorePageVersion,
  unpublishPage,
  type PageRecord,
  type PageVersionInfo,
} from './store'

/** One line that tells the editor where the page stands. */
export function publishLabel(
  page: Pick<PageRecord, 'status' | 'liveVersion' | 'hasUnpublishedChanges'>
) {
  if (page.status !== 'PUBLISHED') return { text: 'Draft', tone: 'muted' as const }
  const live = `Published${page.liveVersion ? ` v${page.liveVersion}` : ''}`
  return page.hasUnpublishedChanges
    ? { text: `${live} · unpublished changes`, tone: 'warn' as const }
    : { text: live, tone: 'ok' as const }
}

const TONE = {
  muted: 'bg-muted text-muted-foreground',
  ok: 'bg-primary/10 text-primary',
  warn: 'bg-amber-100 text-amber-900',
}

export function PublishStatus({ page }: { page: PageRecord }) {
  const { text, tone } = publishLabel(page)
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${TONE[tone]}`}
      data-testid="publish-status"
    >
      {text}
    </span>
  )
}

/** Versions button + dialog: history of published versions, restore one, or take the page offline. */
export function VersionsButton({ page }: { page: PageRecord }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
      >
        <History size={15} /> Versions
      </button>
      {open && <VersionsDialog page={page} onClose={() => setOpen(false)} />}
    </>
  )
}

function VersionsDialog({ page, onClose }: { page: PageRecord; onClose: () => void }) {
  const qc = useQueryClient()
  const [restoring, setRestoring] = useState<PageVersionInfo | null>(null)
  const [confirmUnpublish, setConfirmUnpublish] = useState(false)
  const { data, isLoading, error } = useQuery({
    queryKey: ['page-versions', page.id],
    queryFn: () => listPageVersions(page.id),
  })

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['page-versions', page.id] })
    void qc.invalidateQueries({ queryKey: ['page-builder-page', page.id] })
  }
  const restore = useMutation({
    mutationFn: (v: PageVersionInfo) => restorePageVersion(page.id, v.id),
    onSuccess: (_r, v) => {
      refresh()
      toast({ title: `Restored v${v.version}`, description: 'It is now live as a new version.' })
      setRestoring(null)
      onClose()
    },
  })
  const unpublish = useMutation({
    mutationFn: () => unpublishPage(page.id),
    onSuccess: () => {
      refresh()
      toast({
        title: 'Page unpublished',
        description: 'Visitors no longer see it. Versions are kept.',
      })
      setConfirmUnpublish(false)
      onClose()
    },
  })

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Versions"
      description="Every publish is saved. Restoring an old version publishes its content as a new version."
    >
      <div className="space-y-4">
        {page.status === 'PUBLISHED' && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setConfirmUnpublish(true)}>
              Unpublish page
            </Button>
          </div>
        )}
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorAlert error={error} />
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground">
            Not published yet. Publish the page to create version 1.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {data.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    v{v.version}
                    {v.is_live && (
                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        Live
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {new Date(v.created_at).toLocaleString()}
                    {v.note ? ` · ${v.note}` : ''}
                  </p>
                </div>
                {!v.is_live && (
                  <Button size="sm" variant="outline" onClick={() => setRestoring(v)}>
                    Restore
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {restore.error ? <ErrorAlert error={restore.error} /> : null}
        {unpublish.error ? <ErrorAlert error={unpublish.error} /> : null}
      </div>
      <ConfirmDialog
        open={restoring !== null}
        onClose={() => setRestoring(null)}
        onConfirm={() => restoring && restore.mutate(restoring)}
        title={`Restore v${restoring?.version ?? ''}?`}
        description="Its content goes live now, as a new version. Unpublished edits in the editor are replaced."
        confirmLabel="Restore"
        variant="warning"
        isLoading={restore.isPending}
      />
      <ConfirmDialog
        open={confirmUnpublish}
        onClose={() => setConfirmUnpublish(false)}
        onConfirm={() => unpublish.mutate()}
        title="Unpublish this page?"
        description="Visitors will get a 404. Your content and all versions are kept; publish again any time."
        confirmLabel="Unpublish"
        variant="warning"
        isLoading={unpublish.isPending}
      />
    </Modal>
  )
}
