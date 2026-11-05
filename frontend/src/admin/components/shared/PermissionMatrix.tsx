'use client'

import { cn } from '@/lib/utils'
import type { PermissionModuleMatrix } from '@/types/models.types'

interface PermissionMatrixProps {
  matrix: PermissionModuleMatrix[]
  value: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}

function moduleActionEntries(module: PermissionModuleMatrix): [string, string][] {
  return Object.entries(module.actions).filter((e): e is [string, string] => !!e[1])
}

function getRowIds(module: PermissionModuleMatrix): string[] {
  return moduleActionEntries(module).map(([, id]) => id)
}

function getAllIds(matrix: PermissionModuleMatrix[]): string[] {
  return matrix.flatMap(getRowIds)
}

function formatAction(action: string): string {
  return action.replace(/[-_]/g, ' ')
}

export function PermissionMatrix({ matrix, value, onChange, disabled }: PermissionMatrixProps) {
  const selected = new Set(value)

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    onChange(Array.from(next))
  }

  function toggleRow(module: PermissionModuleMatrix) {
    const rowIds = getRowIds(module)
    const allChecked = rowIds.every((id) => selected.has(id))
    const next = new Set(selected)
    if (allChecked) {
      rowIds.forEach((id) => next.delete(id))
    } else {
      rowIds.forEach((id) => next.add(id))
    }
    onChange(Array.from(next))
  }

  function toggleAll() {
    const allIds = getAllIds(matrix)
    const allChecked = allIds.every((id) => selected.has(id))
    onChange(allChecked ? [] : allIds)
  }

  if (!matrix.length) {
    return <p className="text-sm text-muted-foreground py-4">No permission modules defined.</p>
  }

  const allIds = getAllIds(matrix)
  const allChecked = allIds.length > 0 && allIds.every((id) => selected.has(id))
  const someChecked = allIds.some((id) => selected.has(id)) && !allChecked

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-medium px-1">
        <input
          type="checkbox"
          checked={allChecked}
          ref={(el) => {
            if (el) el.indeterminate = someChecked
          }}
          onChange={toggleAll}
          disabled={disabled}
          className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
          aria-label="Select all permissions"
        />
        Select all
      </label>

      <div className="space-y-2">
        {matrix.map((module) => {
          const actionEntries = moduleActionEntries(module)
          const rowIds = actionEntries.map(([, id]) => id)
          const rowAllChecked = rowIds.length > 0 && rowIds.every((id) => selected.has(id))
          const rowSomeChecked = rowIds.some((id) => selected.has(id)) && !rowAllChecked

          return (
            <div key={module.id} className="rounded-md border overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/50 border-b">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rowAllChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = rowSomeChecked
                    }}
                    onChange={() => toggleRow(module)}
                    disabled={disabled}
                    className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                    aria-label={`Select all permissions for ${module.label}`}
                  />
                  <span className="font-medium">{module.label}</span>
                  {module.is_system && (
                    <span className="text-xs text-muted-foreground">(system)</span>
                  )}
                </label>
                <span className="text-xs text-muted-foreground shrink-0">
                  {rowIds.filter((id) => selected.has(id)).length}/{rowIds.length}
                </span>
              </div>
              <div
                className={cn(
                  'flex flex-wrap gap-x-4 gap-y-2 px-3 py-2',
                  !rowIds.length && 'hidden'
                )}
              >
                {actionEntries.map(([action, id]) => (
                  <label
                    key={action}
                    className="flex items-center gap-1.5 text-sm cursor-pointer select-none capitalize"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(id)}
                      onChange={() => toggle(id)}
                      disabled={disabled}
                      className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                      aria-label={`${module.label} ${action}`}
                    />
                    {formatAction(action)}
                  </label>
                ))}
                {!rowIds.length && (
                  <span className="text-sm text-muted-foreground">No permissions defined.</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
