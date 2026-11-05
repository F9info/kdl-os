'use client'

import { cn } from '@/lib/utils'

export interface Product {
  key: string
  name: string
  description: string
}
export interface Resolution {
  valid: boolean
  selected: string[]
  unknownProducts: string[]
  unknownModules: string[]
  modules: string[]
  toEnable: string[]
  alreadyEnabled: string[]
  conflicts: { module: string; conflictsWith: string; enabled: boolean }[]
  noLongerRequired: string[]
}
export interface ModuleGraph {
  products: Product[]
  selected: string[]
  modules: { slug: string; name: string }[]
  resolution: Resolution
}

export const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join()

interface ProductPickerProps {
  products: Product[]
  selected: string[]
  onToggle: (key: string) => void
  disabled?: boolean
  resolution?: Resolution
  nameOf: (slug: string) => string
}

// Product cards plus the "what this selection does" preview. Shared by Settings > Products
// and the Setup Wizard so both show the same thing.
export function ProductPicker({
  products,
  selected,
  onToggle,
  disabled,
  resolution: r,
  nameOf,
}: ProductPickerProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="Products">
        {products.map((p) => {
          const on = selected.includes(p.key)
          return (
            <button
              key={p.key}
              type="button"
              role="switch"
              aria-checked={on}
              data-testid={`product-${p.key}`}
              disabled={disabled}
              onClick={() => onToggle(p.key)}
              className={cn(
                'rounded-lg border p-4 text-left transition-colors disabled:opacity-60',
                on ? 'border-primary bg-primary/5' : 'hover:bg-accent'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{p.name}</span>
                <span className="text-xs text-muted-foreground">{on ? 'On' : 'Off'}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
            </button>
          )
        })}
      </div>

      {r && (
        <section className="space-y-3 rounded-lg border p-4" aria-label="Preview">
          <h2 className="text-lg font-semibold">What this selection does</h2>
          {r.selected.length === 0 ? (
            <p className="text-sm text-muted-foreground">No product selected.</p>
          ) : (
            <>
              <p className="text-sm">
                Needs {r.modules.length} modules: {r.alreadyEnabled.length} already on,{' '}
                {r.toEnable.length} to turn on.
              </p>
              {r.toEnable.length > 0 && (
                <p className="text-sm" data-testid="to-enable">
                  Will turn on: {r.toEnable.map(nameOf).join(', ')}
                </p>
              )}
            </>
          )}
          {r.noLongerRequired.length > 0 && (
            <p className="text-sm text-muted-foreground" data-testid="kept-on">
              No longer required but kept on: {r.noLongerRequired.map(nameOf).join(', ')}
            </p>
          )}
          {r.conflicts.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-destructive" data-testid="conflicts">
              {r.conflicts.map((c) => (
                <li key={c.module + c.conflictsWith}>
                  {nameOf(c.module)} conflicts with {nameOf(c.conflictsWith)}
                  {c.enabled ? ' (currently on)' : ''}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
