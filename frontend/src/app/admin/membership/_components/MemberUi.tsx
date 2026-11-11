'use client'

import type { ReactNode } from 'react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

export function MemberAvatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary"
    >
      {initials(name) || '?'}
    </span>
  )
}

/** Segmented control (the mockups' "m-seg"): one choice out of a few. */
export function Seg<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded px-3 py-1.5 text-sm transition-colors',
            value === o.value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: ReactNode
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch aria-label={label} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

/** "Label ........ value" line used by the detail cards. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <b className="text-right font-medium">{children}</b>
    </div>
  )
}

/** Page title + one muted subtitle line + actions (same layout as the shared PageHeader, which has no subtitle). */
export function MemberPageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <div className="space-y-1">
        <h1>{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
