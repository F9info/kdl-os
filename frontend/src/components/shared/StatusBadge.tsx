import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  variant:
    'active' | 'inactive' | 'suspended' | 'pending' | 'user' | 'admin' | 'super_admin' | 'system'
  label?: string
}

const variantConfig: Record<
  StatusBadgeProps['variant'],
  { classes: string; defaultLabel: string }
> = {
  active: {
    classes: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    defaultLabel: 'Active',
  },
  inactive: {
    classes: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    defaultLabel: 'Inactive',
  },
  suspended: {
    classes: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    defaultLabel: 'Suspended',
  },
  pending: {
    classes: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    defaultLabel: 'Pending',
  },
  user: {
    classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    defaultLabel: 'User',
  },
  admin: {
    classes: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    defaultLabel: 'Admin',
  },
  super_admin: {
    classes: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
    defaultLabel: 'Super Admin',
  },
  system: {
    classes: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
    defaultLabel: 'System',
  },
}

export function StatusBadge({ variant, label }: StatusBadgeProps) {
  const config = variantConfig[variant] ?? {
    classes: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
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
