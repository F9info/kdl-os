'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { formatDate } from '@/lib/utils'
import { commPath, errorMessage, useCommAction, useCommLog } from '@/admin/hooks/useMembershipComm'
import { ChannelMark, CommShell, Guarded, statusClass } from '../../../_components/CommShell'
import { Card } from '../../../_components/ui'

function LogDetail({ id }: { id: string }) {
  const { data: log, isLoading, error } = useCommLog(id)
  const action = useCommAction()
  const retry = () =>
    action.mutate(
      { path: commPath(`logs/${id}/retry`) },
      {
        onSuccess: () => toast({ title: 'Retry queued' }),
        onError: (e) => toast({ title: errorMessage(e), variant: 'destructive' }),
      }
    )
  return (
    <CommShell
      error={error}
      action={
        <Button variant="outline" asChild>
          <Link href="/admin/membership/communication/logs">Back to logs</Link>
        </Button>
      }
    >
      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !log ? (
        <p className="text-sm text-muted-foreground">Message not found.</p>
      ) : (
        <Card title={log.event_label ?? log.event}>
          <p className="mb-4 text-sm text-muted-foreground">
            {log.member_name ?? 'Unknown member'} ·{' '}
            {formatDate(log.created_at, 'dd MMM yyyy, hh:mm a')} · <code>{log.event}</code>
          </p>
          <div className="mb-4 rounded-lg border p-3 text-sm">
            <div className="flex items-center justify-between">
              <b>
                <ChannelMark channel={log.channel} />
              </b>
              <span className={`rounded-md px-2 py-0.5 text-xs ${statusClass(log.status)}`}>
                {log.status.charAt(0) + log.status.slice(1).toLowerCase()}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              To {log.recipient ?? '—'}
              {log.attempts != null && ` · ${log.attempts} attempt(s)`}
              {(log.provider_response || log.error) && ` · ${log.provider_response ?? log.error}`}
            </p>
          </div>
          <dl className="mb-4 grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
            <dt className="text-muted-foreground">Job ID</dt>
            <dd>
              <code>{log.provider_id ?? log.id}</code>
            </dd>
            {log.subject && (
              <>
                <dt className="text-muted-foreground">Subject</dt>
                <dd>{log.subject}</dd>
              </>
            )}
          </dl>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Rendered message</p>
          <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{log.body ?? '—'}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            Each channel runs as a separate job — one failure never stops the others.
          </p>
          {log.status === 'FAILED' && (
            <div className="mt-4">
              <Button onClick={retry} disabled={action.isPending}>
                Retry{' '}
                {log.channel === 'WHATSAPP'
                  ? 'WhatsApp'
                  : log.channel === 'EMAIL'
                    ? 'Email'
                    : 'In-App'}
              </Button>
            </div>
          )}
        </Card>
      )}
    </CommShell>
  )
}

export default function CommunicationLogDetailPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <Guarded>
      <LogDetail id={id} />
    </Guarded>
  )
}
