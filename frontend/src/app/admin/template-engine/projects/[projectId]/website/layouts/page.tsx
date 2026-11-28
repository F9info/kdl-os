'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, Copy, Eye, LayoutTemplate, Pencil, Plus, Star, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import {
  useLayoutActions,
  useLayoutLibrary,
  type LayoutKind,
  type LayoutPresetRecord,
} from '@/admin/hooks/useLayoutLibrary'
import { LayoutPreview } from '@/admin/components/layouts/LayoutPreview'
import { LayoutEditorDialog } from '@/admin/components/layouts/LayoutEditorDialog'
import { AssignPagesDialog } from '@/admin/components/layouts/AssignPagesDialog'
import { DevicePreview, layoutPreviewSrc } from '@/admin/components/layouts/DevicePreview'

const SECTIONS: { kind: LayoutKind; title: string; description: string}[] = [
  { kind: 'HEADER', title: 'Header layouts', description: 'Logo, navigation and call to action at the top of a page.' },
  { kind: 'FOOTER', title: 'Footer layouts', description: 'Links, contact details and legal text at the bottom of a page.' },
  { kind: 'TOP_HEADER', title: 'Top header layouts', description: 'The thin bar above the header (contact details, social links).' },
]

export default function LayoutLibraryPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { data: layouts, isLoading, error } = useLayoutLibrary(projectId)
  const actions = useLayoutActions(projectId)
  const [editing, setEditing] = useState<{ kind: LayoutKind; layout: LayoutPresetRecord | null } | null>(null)
  const [assigning, setAssigning] = useState<LayoutPresetRecord | null>(null)
  const [previewing, setPreviewing] = useState<LayoutPresetRecord | null>(null)
  const [deleting, setDeleting] = useState<LayoutPresetRecord | null>(null)
  const [needsForce, setNeedsForce] = useState(false)

  const backHref = `/admin/template-engine/projects/${projectId}/website?view=layouts`
  const confirmDelete = (force: boolean) => {
    if (!deleting) return
    actions.remove.mutate(
      { id: deleting.id, force },
      {
        onSuccess: () => {
          setDeleting(null)
          setNeedsForce(false)
        },
        onError: (err) => {
          if ((err as { response?: { status?: number } })?.response?.status === 409 && !force && deleting.pages > 0) setNeedsForce(true)
        },
      }
    )
  }

  if (isLoading) return <LoadingSpinner fullPage />
  if (error) return <div className="p-6"><ErrorAlert error={error} /></div>

  return (
    <div className="w-full space-y-8 p-6">
      <div className="space-y-2">
        <Button type="button" variant="ghost" size="sm" asChild className="gap-1.5 px-2">
          <a href={backHref}><ArrowLeft className="h-3.5 w-3.5" />Back to Layouts</a>
        </Button>
        <h2 className="text-lg font-semibold">Layout library</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Create several headers and footers, choose a default for the whole website and give individual pages their own.
          A page without its own layout shows the default. Only published layouts appear on the live site.
        </p>
      </div>

      {SECTIONS.map(({ kind, title, description, }) => {
        const items = (layouts ?? []).filter((l) => l.kind === kind)
        if (kind === 'TOP_HEADER' && items.length === 0) return null
        return (
          <section key={kind} className="space-y-3" aria-labelledby={`sec-${kind}`}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 id={`sec-${kind}`} className="text-base font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
              <Button type="button" size="sm" className="gap-1.5" onClick={() => setEditing({ kind, layout: null })}>
                <Plus className="h-3.5 w-3.5" />
                New {kind === 'HEADER' ? 'header' : kind === 'FOOTER' ? 'footer' : 'top header'}
              </Button>
            </div>

            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
                <LayoutTemplate className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No {kind === 'HEADER' ? 'header' : 'footer'} layouts yet.</p>
                <Button type="button" size="sm" variant="outline" onClick={() => setEditing({ kind, layout: null })}>Create the first one</Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {items.map((l) => (
                  <article key={l.id} className="flex flex-col overflow-hidden rounded-lg border bg-card">
                    <div className="max-h-56 overflow-hidden border-b">
                      <LayoutPreview projectId={projectId} kind={l.kind} variant={l.variant} config={l.config} fitWidth={1280} />
                    </div>
                    <div className="flex flex-1 flex-col gap-3 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="min-w-0 truncate text-sm font-semibold">{l.name}</h4>
                        {l.is_default && <Badge className="gap-1"><Star className="h-3 w-3" />Default</Badge>}
                        <Badge variant={l.status === 'PUBLISHED' ? 'secondary' : 'outline'}>{l.status === 'PUBLISHED' ? 'Published' : 'Draft'}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {l.is_default ? 'Shown on every page without its own layout' : 'Shown only on the pages you assign'}
                        {' · '}
                        {l.pages} page{l.pages === 1 ? '' : 's'} assigned
                      </p>
                      <div className="mt-auto flex flex-wrap gap-1.5">
                        <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => setEditing({ kind, layout: l })}><Pencil className="h-3.5 w-3.5" />Edit</Button>
                        <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => setPreviewing(l)}><Eye className="h-3.5 w-3.5" />Preview</Button>
                        <Button type="button" size="sm" variant="outline" className="gap-1" disabled={actions.duplicate.isPending} onClick={() => actions.duplicate.mutate(l.id)}><Copy className="h-3.5 w-3.5" />Duplicate</Button>
                        <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => setAssigning(l)}><Users className="h-3.5 w-3.5" />Pages</Button>
                        {!l.is_default && (
                          <>
                            {l.status === 'PUBLISHED' ? (
                              <>
                                <Button type="button" size="sm" variant="outline" disabled={actions.makeDefault.isPending} onClick={() => actions.makeDefault.mutate(l.id)}>Make default</Button>
                                <Button type="button" size="sm" variant="ghost" disabled={actions.update.isPending} onClick={() => actions.update.mutate({ id: l.id, status: 'DRAFT' })}>Unpublish</Button>
                              </>
                            ) : (
                              <Button type="button" size="sm" variant="outline" disabled={actions.update.isPending} onClick={() => actions.update.mutate({ id: l.id, status: 'PUBLISHED' })}>Publish</Button>
                            )}
                            <Button type="button" size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => { setNeedsForce(false); setDeleting(l) }}><Trash2 className="h-3.5 w-3.5" />Delete</Button>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )
      })}

      <LayoutEditorDialog projectId={projectId} kind={editing?.kind ?? 'HEADER'} layout={editing?.layout} open={editing !== null} onClose={() => setEditing(null)} />
      <AssignPagesDialog projectId={projectId} layout={assigning} open={assigning !== null} onClose={() => setAssigning(null)} />

      <Dialog open={previewing !== null} onOpenChange={(o) => !o && setPreviewing(null)}>
        <DialogContent className="max-h-[92vh] w-[96vw] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewing?.name}</DialogTitle>
            <DialogDescription>How this layout looks on a desktop, a tablet and a phone.</DialogDescription>
          </DialogHeader>
          {previewing && (
            <DevicePreview src={layoutPreviewSrc({ projectId, kind: previewing.kind, variant: previewing.variant, config: previewing.config })} height={previewing.kind === 'FOOTER' ? 640 : 240} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(o) => { if (!o) { setDeleting(null); setNeedsForce(false) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{deleting?.name}”?</DialogTitle>
            <DialogDescription>
              {needsForce
                ? `${deleting?.pages} page${deleting?.pages === 1 ? ' uses' : 's use'} this layout. They will show the default layout instead.`
                : 'This layout will be removed. This cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setDeleting(null); setNeedsForce(false) }}>Cancel</Button>
            <Button type="button" variant="destructive" disabled={actions.remove.isPending} onClick={() => confirmDelete(needsForce)}>
              {needsForce ? 'Delete anyway' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
