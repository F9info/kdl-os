'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import {
  useAssignLayout,
  useLayoutLibrary,
  useLayoutPages,
  type LayoutPresetRecord,
} from '@/admin/hooks/useLayoutLibrary'

/** Which pages show this layout. A page with none assigned shows the project's default of that kind. */
export function AssignPagesDialog({
  projectId,
  layout,
  open,
  onClose,
}: {
  projectId: string
  layout: LayoutPresetRecord | null
  open: boolean
  onClose: () => void
}) {
  const { data: pages, isLoading } = useLayoutPages(projectId, open)
  const { data: layouts } = useLayoutLibrary(projectId)
  const assign = useAssignLayout(projectId)
  if (!layout) return null
  const field = layout.kind === 'HEADER' ? 'header_layout_id' : 'footer_layout_id'
  const nameOf = (id: string | null) => layouts?.find((l) => l.id === id)?.name
  const kindLabel = layout.kind === 'HEADER' ? 'header' : 'footer'

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pages using “{layout.name}”</DialogTitle>
          <DialogDescription>
            Choose the pages that show this {kindLabel}. Other pages keep their own layout, or the
            default {kindLabel}.
            {layout.status !== 'PUBLISHED' &&
              ' This layout is a draft, so visitors still see the default until you publish it.'}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <LoadingSpinner />
        ) : (pages ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            This project has no pages yet.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {(pages ?? []).map((page) => {
              const current = page[field]
              const here = current === layout.id
              return (
                <li key={page.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{page.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      /{page.slug} · {page.status === 'PUBLISHED' ? 'Published' : 'Draft'} ·{' '}
                      {here
                        ? 'uses this layout'
                        : current
                          ? `uses “${nameOf(current) ?? 'another layout'}”`
                          : `default ${kindLabel}`}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={here ? 'default' : 'outline'}
                    aria-pressed={here}
                    disabled={assign.isPending}
                    onClick={() =>
                      assign.mutate({
                        pageId: page.id,
                        kind: layout.kind,
                        layoutId: here ? null : layout.id,
                      })
                    }
                  >
                    {here ? 'Assigned' : 'Assign'}
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
        <div className="flex justify-end">
          <Badge variant="outline">
            {layout.pages} page{layout.pages === 1 ? '' : 's'} assigned
          </Badge>
        </div>
      </DialogContent>
    </Dialog>
  )
}
