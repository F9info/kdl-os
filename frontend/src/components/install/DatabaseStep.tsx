'use client'

import { useQuery } from '@tanstack/react-query'
import { Check, Database, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { installApi, type DatabaseInfo } from './install-api'

/**
 * Installer step 1: test the database connection and the migrations. The connection comes from the server's
 * environment (DATABASE_URL), so this is a check, not a form: credentials are never typed into a web page.
 */
export function DatabaseStep({ onNext }: { onNext: () => void }) {
  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ['install', 'database'],
    queryFn: () => installApi.get('/database').then((r) => r.data.data as DatabaseInfo),
    retry: false,
    staleTime: 0,
  })

  const Row = ({ label, value }: { label: string; value?: string }) => (
    <div className="flex justify-between gap-4 border-b py-1.5 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value || '—'}</dd>
    </div>
  )

  return (
    <section>
      <div className="mb-2 flex items-center gap-2 text-primary">
        <Database className="h-5 w-5" aria-hidden="true" />
        <h1 className="text-xl font-semibold text-foreground">Database</h1>
      </div>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        We check that the server can reach its database and that the tables are up to date. The
        connection is set on the server (DATABASE_URL), so no password is typed here.
      </p>

      {isFetching && !data && <LoadingSpinner />}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          Could not run the check. Is the backend running?
        </p>
      )}
      {data && (
        <div className="space-y-4">
          <p
            role="status"
            className={
              data.ready
                ? 'flex items-center gap-2 text-sm font-medium text-emerald-600'
                : 'flex items-center gap-2 text-sm font-medium text-destructive'
            }
          >
            {data.ready ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
            {data.ready
              ? 'Connected, and every migration is applied'
              : data.connected
                ? 'Connected, but migrations are not all applied'
                : 'Could not connect to the database'}
          </p>
          <dl className="rounded-lg border p-4 text-sm">
            <Row label="Host" value={data.host ? `${data.host}:${data.port}` : ''} />
            <Row label="Database" value={data.database} />
            <Row label="User" value={data.user} />
            {data.server && <Row label="Server" value={data.server} />}
            {data.migrations && (
              <Row
                label="Migrations"
                value={`${data.migrations.applied} of ${data.migrations.total} applied${
                  data.migrations.failed ? `, ${data.migrations.failed} failed` : ''
                }`}
              />
            )}
          </dl>
          {data.error && <p className="text-sm text-destructive">{data.error}</p>}
          {!data.ready && (
            <p className="text-sm text-muted-foreground">
              Fix the connection or run <code>npx prisma migrate deploy</code> on the server, then
              test again.
            </p>
          )}
        </div>
      )}

      <div className="mt-8 flex justify-between">
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={isFetching ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
          Test again
        </Button>
        <Button onClick={onNext} disabled={!data?.ready}>
          Next
        </Button>
      </div>
    </section>
  )
}
