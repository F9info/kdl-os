'use client'

import {
  AppWindow,
  Check,
  Globe,
  LayoutDashboard,
  Layers,
  Rocket,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AppTypeInfo {
  key: string
  name: string
  description: string
  icon: string
  frontend: boolean
  modules: { slug: string; name: string; status: string }[]
}

const ICONS: Record<string, LucideIcon> = {
  Rocket,
  Globe,
  AppWindow,
  LayoutDashboard,
  Layers,
  ShieldCheck,
}

// A small illustration per type, drawn in CSS so there is no image to load or to go missing.
function Preview({ kind }: { kind: string }) {
  const bar = 'rounded bg-primary/25'
  return (
    <div aria-hidden className="mb-3 h-20 w-full overflow-hidden rounded-md border bg-muted/50 p-2">
      {kind === 'admin-only' ? (
        <div className="flex h-full gap-1.5">
          <div className={cn('w-1/4', bar)} />
          <div className="grid flex-1 grid-cols-3 gap-1.5">
            <div className="rounded bg-primary/15" />
            <div className="rounded bg-primary/15" />
            <div className="rounded bg-primary/15" />
            <div className="col-span-3 rounded bg-primary/10" />
          </div>
        </div>
      ) : kind === 'web-app' ? (
        <div className="flex h-full flex-col gap-1.5">
          <div className={cn('h-2 w-1/3', bar)} />
          <div className="grid flex-1 grid-cols-2 gap-1.5">
            <div className="rounded bg-primary/15" />
            <div className="rounded bg-primary/15" />
          </div>
        </div>
      ) : kind === 'landing' ? (
        <div className="flex h-full flex-col items-center justify-center gap-1.5">
          <div className={cn('h-2 w-2/3', bar)} />
          <div className="h-1.5 w-1/2 rounded bg-primary/15" />
          <div className="h-3 w-1/4 rounded bg-primary/50" />
        </div>
      ) : kind === 'multi' ? (
        <div className="grid h-full grid-cols-3 gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-1 rounded bg-primary/10 p-1">
              <div className={cn('h-1.5 w-full', bar)} />
              <div className="flex-1 rounded bg-primary/15" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-full flex-col gap-1.5">
          <div className={cn('h-2 w-full', bar)} />
          <div className="flex flex-1 gap-1.5">
            <div className="flex-1 rounded bg-primary/15" />
            <div className="flex-1 rounded bg-primary/10" />
            {kind === 'admin-frontend' && <div className="w-1/4 rounded bg-primary/30" />}
          </div>
        </div>
      )}
    </div>
  )
}

interface Props {
  types: AppTypeInfo[]
  value: string | null
  onChange: (key: string) => void
  disabled?: boolean
}

export function AppTypeCards({ types, value, onChange, disabled }: Props) {
  return (
    <div role="radiogroup" aria-label="Application type" className="grid gap-3 sm:grid-cols-2">
      {types.map((t) => {
        const Icon = ICONS[t.icon] ?? Globe
        const on = value === t.key
        return (
          <button
            key={t.key}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(t.key)}
            className={cn(
              'relative rounded-xl border bg-card p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              on ? 'border-primary ring-2 ring-primary/30' : 'hover:border-primary/50'
            )}
          >
            {on && (
              <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-3 w-3" />
              </span>
            )}
            <Preview kind={t.key} />
            <div className="flex items-center gap-2 font-semibold">
              <Icon className="h-4 w-4 text-primary" />
              {t.name}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
          </button>
        )
      })}
    </div>
  )
}

/** What choosing a type will add. Core modules are always on and are not repeated here. */
export function ModulePreview({ type }: { type: AppTypeInfo }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4 text-sm">
      <p className="font-medium">
        {type.modules.length
          ? 'These modules will be set up for you:'
          : 'No extra modules. The core admin is all you need.'}
      </p>
      {type.modules.length > 0 && (
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {type.modules.map((m) => (
            <li key={m.slug} className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-primary" />
              {m.name}
              {m.status === 'ENABLED' && (
                <span className="text-xs text-muted-foreground">(already on)</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {type.frontend && (
        <p className="mt-3 text-muted-foreground">
          A demo website and four landing pages are created, ready to preview and edit after you
          sign in.
        </p>
      )}
    </div>
  )
}
