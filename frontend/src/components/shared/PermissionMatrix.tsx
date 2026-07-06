'use client'

import { cn } from '@/lib/utils'
import type { PermissionModuleMatrix } from '@/types/models.types'

const ACTIONS = ['view', 'add', 'edit', 'delete', 'publish'] as const
type Action = (typeof ACTIONS)[number]

interface PermissionMatrixProps {
  matrix: PermissionModuleMatrix[]
  value: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}

function getAllIds(matrix: PermissionModuleMatrix[]): string[] {
  return matrix.flatMap((m) =>
    ACTIONS.map((a) => m.actions[a]).filter((id): id is string => !!id)
  )
}

function getColumnIds(matrix: PermissionModuleMatrix[], action: Action): string[] {
  return matrix.map((m) => m.actions[action]).filter((id): id is string => !!id)
}

function getRowIds(module: PermissionModuleMatrix): string[] {
  return ACTIONS.map((a) => module.actions[a]).filter((id): id is string => !!id)
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

  function toggleColumn(action: Action) {
    const colIds = getColumnIds(matrix, action)
    const allChecked = colIds.every((id) => selected.has(id))
    const next = new Set(selected)
    if (allChecked) {
      colIds.forEach((id) => next.delete(id))
    } else {
      colIds.forEach((id) => next.add(id))
    }
    onChange(Array.from(next))
  }

  function toggleAll() {
    const allIds = getAllIds(matrix)
    const allChecked = allIds.every((id) => selected.has(id))
    onChange(allChecked ? [] : allIds)
  }

  if (!matrix.length) {
    return (
      <p className="text-sm text-muted-foreground py-4">No permission modules defined.</p>
    )
  }

  const allIds = getAllIds(matrix)
  const allChecked = allIds.length > 0 && allIds.every((id) => selected.has(id))
  const someChecked = allIds.some((id) => selected.has(id)) && !allChecked

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-3 py-2 font-medium min-w-[140px]">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => { if (el) el.indeterminate = someChecked }}
                  onChange={toggleAll}
                  disabled={disabled}
                  className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                  aria-label="Select all permissions"
                />
                Module
              </label>
            </th>
            {ACTIONS.map((action) => {
              const colIds = getColumnIds(matrix, action)
              const colAllChecked = colIds.length > 0 && colIds.every((id) => selected.has(id))
              const colSomeChecked = colIds.some((id) => selected.has(id)) && !colAllChecked
              return (
                <th key={action} className="px-3 py-2 font-medium capitalize text-center">
                  <label className="flex flex-col items-center gap-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={colAllChecked}
                      ref={(el) => { if (el) el.indeterminate = colSomeChecked }}
                      onChange={() => toggleColumn(action)}
                      disabled={disabled}
                      className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                      aria-label={`Select all ${action}`}
                    />
                    <span>{action}</span>
                  </label>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {matrix.map((module, i) => {
            const rowIds = getRowIds(module)
            const rowAllChecked = rowIds.length > 0 && rowIds.every((id) => selected.has(id))
            const rowSomeChecked = rowIds.some((id) => selected.has(id)) && !rowAllChecked
            return (
              <tr
                key={module.id}
                className={cn('border-b last:border-0', i % 2 === 0 ? 'bg-background' : 'bg-muted/20')}
              >
                <td className="px-3 py-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rowAllChecked}
                      ref={(el) => { if (el) el.indeterminate = rowSomeChecked }}
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
                </td>
                {ACTIONS.map((action) => {
                  const permId = module.actions[action]
                  return (
                    <td key={action} className="px-3 py-2 text-center">
                      {permId ? (
                        <input
                          type="checkbox"
                          checked={selected.has(permId)}
                          onChange={() => toggle(permId)}
                          disabled={disabled}
                          className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                          aria-label={`${module.label} ${action}`}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
