'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, ExternalLink, Trash2 } from 'lucide-react'
import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { PageHeader } from '@/components/layout/PageHeader'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { listPages, createPage, deletePage, type PageRecord } from './store'

export default function PageBuilderList() {
  const router = useRouter()
  const [pages, setPages] = useState<PageRecord[]>([])
  const [title, setTitle] = useState('')

  const refresh = () => setPages(listPages())
  useEffect(refresh, [])

  const onCreate = () => {
    const name = title.trim() || 'Untitled page'
    const rec = createPage(name)
    router.push(`/admin/page-builder/${rec.id}`)
  }

  return (
    <ModuleGuard slug="page-builder">
      <PageHeader title="Page Builder" />
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
        />
        <Button onClick={onCreate}>
          <Plus size={18} /> New page
        </Button>
      </div>

      {pages.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          No pages yet. Create your first one above.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border">
          {pages.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-accent"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{p.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  /p/{p.slug} · updated {new Date(p.updatedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={`/p/${p.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  title="View"
                  className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <ExternalLink size={17} />
                </a>
                <button
                  onClick={() => router.push(`/admin/page-builder/${p.id}`)}
                  title="Edit"
                  className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Pencil size={17} />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${p.title}"?`)) {
                      deletePage(p.id)
                      refresh()
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
    </ModuleGuard>
  )
}
