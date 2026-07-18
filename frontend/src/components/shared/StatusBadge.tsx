import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  variant:
    'active' | 'inactive' | 'suspended' | 'pending' | 'user' | 'admin' | 'super_admin' | 'system'
  label?: string
}

// B1 token-aware badge colors.
// - active/suspended/inactive/system map to semantic design-system tokens so
//   they follow the brand primary/destructive/muted palette.
// - Role variants (user/admin/super_admin/pending) keep Tailwind palette
//   classes — no semantic token maps to them yet.
const variantConfig: Record<
  StatusBadgeProps['variant'],
  { classes: string; defaultLabel: string }
> = {
  active: {
    classes: 'bg-primary/10 text-primary',
    defaultLabel: 'Active',
  },
  inactive: {
    classes: 'bg-muted text-muted-foreground',
    defaultLabel: 'Inactive',
  },
  suspended: {
    classes: 'bg-destructive/10 text-status-danger-fg',
    defaultLabel: 'Suspended',
  },
  pending: {
    classes: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    defaultLabel: 'Pending',
  },
  user: {
    classes: 'bg-secondary text-secondary-foreground',
    defaultLabel: 'User',
  },
  admin: {
    classes: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    defaultLabel: 'Admin',
  },
  super_admin: {
    classes: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    defaultLabel: 'Super Admin',
  },
  system: {
    classes: 'bg-muted text-muted-foreground',
    defaultLabel: 'System',
  },
}

export function StatusBadge({ variant, label }: StatusBadgeProps) {
  const config = variantConfig[variant] ?? {
    classes: 'bg-muted text-muted-foreground',
    defaultLabel: variant,
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.classes
      )}
    >
      {label ?? config.defaultLabel}
    </span>
  )
}
