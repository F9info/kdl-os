'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, ExternalLink, Trash2, LayoutTemplate } from 'lucide-react'
import { ModuleGuard } from '@/components/shared/ModuleGuard'
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
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-1">
          <LayoutTemplate className="text-blue-600" />
          <h1 className="text-2xl font-semibold">Page Builder</h1>
        </div>
        <p className="text-slate-500 mb-6">
          Drag-and-drop, fully responsive pages powered by Puck. Author once, preview mobile /
          tablet / desktop, publish to a public URL.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 mb-8">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onCreate()}
            placeholder="New page title…"
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={onCreate}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-white font-medium hover:bg-blue-700"
          >
            <Plus size={18} /> New page
          </button>
        </div>

        {pages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
            No pages yet. Create your first one above.
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200">
            {pages.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.title}</p>
                  <p className="text-xs text-slate-400 truncate">
                    /p/{p.slug} · updated {new Date(p.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={`/p/${p.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    title="View"
                    className="rounded-md p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                  >
                    <ExternalLink size={17} />
                  </a>
                  <button
                    onClick={() => router.push(`/admin/page-builder/${p.id}`)}
                    title="Edit"
                    className="rounded-md p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
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
                    className="rounded-md p-2 text-slate-500 hover:bg-red-100 hover:text-red-600"
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
