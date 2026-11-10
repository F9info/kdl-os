import { Badge } from '@/components/ui/badge'

const TONE: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ACTIVE: 'default',
  TRIALING: 'default',
  PAID: 'default',
  PENDING_PAYMENT: 'secondary',
  PENDING_APPROVAL: 'secondary',
  PENDING: 'secondary',
  AWAITING_PROOF: 'secondary',
  UNDER_VERIFICATION: 'secondary',
  PAST_DUE: 'destructive',
  EXPIRED: 'destructive',
  REJECTED: 'destructive',
  FAILED: 'destructive',
  SUSPENDED: 'destructive',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={TONE[status] ?? 'outline'}>
      {status
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/^./, (c) => c.toUpperCase())}
    </Badge>
  )
}
