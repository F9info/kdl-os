'use client'

import { cn } from '@/lib/utils'
import { DELIVERY_OPTIONS, projectTypeLabel, type WebsiteDelivery } from '@/admin/lib/project-type'

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
  /** Products on only because all their modules are already enabled (never chosen here). */
  inferred?: string[]
  modules: { slug: string; name: string }[]
  resolution: Resolution
  /** How the Website product is delivered; null until the owner chooses. */
  delivery?: WebsiteDelivery | null
}

// Admin is the base every install starts with, so it is never offered as a card.
export const BASE_PRODUCT = 'admin'
export const withBase = (selected: string[]) => [...new Set([BASE_PRODUCT, ...selected])]

export const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join()

interface ProductPickerProps {
  products: Product[]
  selected: string[]
  onToggle: (key: string) => void
  disabled?: boolean
  resolution?: Resolution
  nameOf: (slug: string) => string
  /** Website delivery choice (shown while the Website product is on). */
  delivery?: WebsiteDelivery | null
  onDeliveryChange?: (value: WebsiteDelivery) => void
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
  delivery,
  onDeliveryChange,
}: ProductPickerProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Products">
        {products
          .filter((p) => p.key !== BASE_PRODUCT)
          .map((p) => {
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

      {selected.includes('website') && onDeliveryChange && (
        <fieldset className="space-y-2 rounded-lg border p-4" data-testid="delivery">
          <legend className="px-1 text-sm font-semibold">How will the website be delivered?</legend>
          <div
            className="grid gap-2 sm:grid-cols-3"
            role="radiogroup"
            aria-label="Website delivery"
          >
            {DELIVERY_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={delivery === o.value}
                data-testid={`delivery-${o.value}`}
                disabled={disabled}
                onClick={() => onDeliveryChange(o.value)}
                className={cn(
                  'rounded-md border p-3 text-left text-sm transition-colors disabled:opacity-60',
                  delivery === o.value ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                )}
              >
                <span className="font-medium">{o.label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{o.description}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <p className="text-sm" data-testid="project-type">
        Your project: <strong>{projectTypeLabel(selected, delivery)}</strong>
      </p>

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
