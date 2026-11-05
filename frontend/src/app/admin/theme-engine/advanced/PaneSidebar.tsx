'use client'

import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TEPane } from './types'

export function PaneSidebar({
  search,
  setSearch,
  isLoading,
  isError,
  sidebarItems,
  activePane,
  setActivePane,
  isDirtyPane,
}: {
  search: string
  setSearch: (v: string) => void
  isLoading: boolean
  isError: boolean
  sidebarItems: { cap: string | null; panes: TEPane[] }[]
  activePane: string
  setActivePane: (paneId: string) => void
  isDirtyPane: (paneId: string) => boolean
}) {
  return (
    <aside className="flex w-60 flex-shrink-0 flex-col border-r bg-sidebar">
      {/* Search */}
      <div className="flex items-center gap-1.5 border-b border-border/50 px-3 py-2">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search settings…"
          aria-label="Search settings"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          data-testid="sidebar-search"
        />
      </div>
      {/* Pane list */}
      <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {isLoading && <div className="px-3 py-4 text-xs text-muted-foreground">Loading…</div>}
        {isError && (
          <div className="px-3 py-2 text-xs text-destructive">Failed to load schema.</div>
        )}
        {sidebarItems.map(({ cap, panes: groupPanes }, gi) => (
          <div key={gi}>
            {cap && (
              <div className="mt-3 px-3 pb-1 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
                {cap}
              </div>
            )}
            {groupPanes.map((pane) => (
              <button
                key={pane.id}
                data-testid={`pane-btn-${pane.id}`}
                onClick={() => setActivePane(pane.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors',
                  pane.id === activePane
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-secondary'
                )}
              >
                <span
                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-xs shadow-sm"
                  style={{ background: pane.ic ?? '#666' }}
                >
                  {pane.icon}
                </span>
                <span className="flex-1 truncate text-left">{pane.label}</span>
                {isDirtyPane(pane.id) && (
                  <span
                    role="img"
                    aria-label="Has unsaved changes"
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      pane.id === activePane ? 'bg-white' : 'bg-amber-400'
                    )}
                  />
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
