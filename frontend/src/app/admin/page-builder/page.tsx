'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, ExternalLink, Trash2, LayoutTemplate } from 'lucide-react'
import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from '@/hooks/use-toast'
import { listPages, createPage, deletePage } from './store'

export default function PageBuilderList() {
  const router = useRouter()
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ['page-builder-pages'],
    queryFn: listPages,
  })

  const createMutation = useMutation({
    mutationFn: (name: string) => createPage(name),
    onSuccess: (rec) => {
      void qc.invalidateQueries({ queryKey: ['page-builder-pages'] })
      router.push(`/admin/page-builder/${rec.id}`)
    },
    onError: () =>
      toast({ title: 'Error', description: 'Could not create page.', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: deletePage,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['page-builder-pages'] })
      setDeleteTarget(null)
    },
    onError: () => {
      toast({ title: 'Error', description: 'Could not delete page.', variant: 'destructive' })
      setDeleteTarget(null)
    },
  })

  const onCreate = () => {
    const name = title.trim() || 'Untitled page'
    setTitle('')
    createMutation.mutate(name)
  }

  return (
    <ModuleGuard slug="page-builder">
      <div className="max-w-5xl mx-auto">
        <PageHeader
          title="Page Builder"
          action={
            <div className="flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5 text-muted-foreground" />
            </div>
          }
        />
        <p className="text-muted-foreground mb-6">
          Drag-and-drop, fully responsive pages powered by Puck. Author once, preview mobile /
          tablet / desktop, publish to a public URL.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 mb-8">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onCreate()}
            placeholder="New page title…"
            className="flex-1"
            disabled={createMutation.isPending}
          />
          <Button onClick={onCreate} className="gap-2" disabled={createMutation.isPending}>
            <Plus size={18} /> {createMutation.isPending ? 'Creating…' : 'New page'}
          </Button>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
            Loading pages…
          </div>
        ) : pages.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
            No pages yet. Create your first one above.
          </div>
        ) : (
          <ul className="divide-y rounded-xl border">
            {pages.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    /p/{p.slug} · {p.status.toLowerCase()} · updated{' '}
                    {new Date(p.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" asChild aria-label={`View ${p.title}`}>
                    <a href={`/p/${p.slug}`} target="_blank" rel="noreferrer" title="View">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push(`/admin/page-builder/${p.id}`)}
                    aria-label={`Edit ${p.title}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget({ id: p.id, title: p.title })}
                    aria-label={`Delete ${p.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <ConfirmDialog
          open={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
          title="Delete page?"
          description={deleteTarget ? `This will permanently delete "${deleteTarget.title}".` : ''}
          isLoading={deleteMutation.isPending}
        />
      </div>
    </ModuleGuard>
  )
}
