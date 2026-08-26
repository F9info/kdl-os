'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, ExternalLink, Trash2, LayoutTemplate } from 'lucide-react'
import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from '@/hooks/use-toast'
import { listPages, createPage, deletePage } from './store'

export default function PageBuilderList() {
  const router = useRouter()
  const qc = useQueryClient()
  const [title, setTitle] = useState('')

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
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['page-builder-pages'] }),
    onError: () =>
      toast({ title: 'Error', description: 'Could not delete page.', variant: 'destructive' }),
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
                  <a
                    href={`/p/${p.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    title="View"
                    className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <ExternalLink size={17} />
                  </a>
                  <button
                    onClick={() => router.push(`/admin/page-builder/${p.id}`)}
                    title="Edit"
                    className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Pencil size={17} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${p.title}"?`)) {
                        deleteMutation.mutate(p.id)
                      }
                    }}
                    title="Delete"
                    className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ModuleGuard>
  )
}
