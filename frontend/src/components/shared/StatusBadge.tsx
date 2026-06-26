import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  variant: 'active' | 'inactive' | 'user' | 'admin' | 'super_admin'
  label?: string
}

const variantConfig: Record<StatusBadgeProps['variant'], { classes: string; defaultLabel: string }> = {
  active: { classes: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300', defaultLabel: 'Active' },
  inactive: { classes: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300', defaultLabel: 'Inactive' },
  user: { classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300', defaultLabel: 'User' },
  admin: { classes: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300', defaultLabel: 'Admin' },
  super_admin: { classes: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300', defaultLabel: 'Super Admin' },
}

export function StatusBadge({ variant, label }: StatusBadgeProps) {
  const config = variantConfig[variant]
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
