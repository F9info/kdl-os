'use client'

import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FieldControl } from './field-controls'
import { groupTag, type TEGroup, type TEPane, type ValuesMap } from './types'

export function FieldSections({
  activePaneData,
  activePane,
  activePaneValues,
  filteredGroups,
  search,
  isLoading,
  isSectionOpen,
  toggleSection,
  handleFieldChange,
  customFontNames,
}: {
  activePaneData: TEPane | undefined
  activePane: string
  activePaneValues: ValuesMap
  filteredGroups: TEGroup[]
  search: string
  isLoading: boolean
  isSectionOpen: (key: string) => boolean
  toggleSection: (key: string) => void
  handleFieldChange: (paneId: string, fieldId: string, value: string) => void
  customFontNames: string[]
}) {
  return (
    <div className="flex-1 overflow-y-auto px-8 pb-8 pt-2 scrollbar-thin">
      {!activePaneData && !isLoading && (
        <div className="mt-12 text-center text-sm text-muted-foreground">
          Select a pane from the sidebar.
        </div>
      )}
      {filteredGroups.length === 0 && search && (
        <div className="mt-8 text-center text-sm text-muted-foreground">
          No settings match your search in this pane.
        </div>
      )}
      {filteredGroups.map((group) => {
        const sectionKey = `${activePane}-${group.id}`
        const tag = activePaneData ? groupTag(activePaneData, group) : null
        return (
          <div key={group.id} className="mt-5">
            <button
              className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground"
              aria-expanded={isSectionOpen(sectionKey)}
              onClick={() => toggleSection(sectionKey)}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'text-[9px] transition-transform',
                  isSectionOpen(sectionKey) ? 'rotate-90' : ''
                )}
              >
                ▶
              </span>
              {group.name}
              {tag && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] normal-case text-muted-foreground">
                  {tag}
                </span>
              )}
            </button>
            {isSectionOpen(sectionKey) && (
              <div className="overflow-hidden rounded-lg border bg-card">
                {group.fields.map((field, fi) => {
                  // The Typography Scale table is self-labeling (column
                  // headers + row names) — the generic field_name/alt_text
                  // label column would just repeat the group name above it.
                  const isTable = field.input_type === 'typo_table'
                  const isFieldLocked = Boolean(field.locked_by)
                  return (
                    <div
                      key={field.id}
                      className={cn(
                        isTable
                          ? 'p-3'
                          : 'grid grid-cols-[minmax(200px,340px)_1fr] items-center gap-3 px-5 py-3',
                        fi < group.fields.length - 1 ? 'border-b' : '',
                        isFieldLocked ? 'opacity-60' : ''
                      )}
                      data-testid={`field-row-${field.id}`}
                    >
                      {!isTable && (
                        <div className="flex items-center gap-1.5">
                          <div>
                            <div className="text-sm font-medium">{field.field_name}</div>
                            {field.alt_text && (
                              <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                                {field.alt_text}
                              </div>
                            )}
                          </div>
                          {isFieldLocked && (
                            <span
                              title={`Locked by ${field.locked_by}`}
                              className="shrink-0 text-amber-500"
                              aria-label={`Locked by ${field.locked_by}`}
                            >
                              <Lock className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>
                      )}
                      <div
                        className={cn(
                          isTable ? '' : 'flex flex-wrap items-center justify-end gap-2',
                          isFieldLocked ? 'pointer-events-none' : ''
                        )}
                      >
                        <FieldControl
                          field={field}
                          value={activePaneValues[field.id] ?? field.value}
                          onChange={(v) => handleFieldChange(activePane, field.id, v)}
                          customFontNames={customFontNames}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
