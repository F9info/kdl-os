'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, AppWindow, Boxes, Database, Globe } from 'lucide-react'
import api from '@/lib/axios'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils'

export interface PlatformOverview {
  app_type: string | null
  modules: {
    total: number
    enabled: number
    installed: number
    available: number
    by_group: Array<{ group: string; enabled: number; total: number }>
  }
  seeders: {
    total: number
    done: number
    failed: Array<{ name: string; error: string; at: string }>
    last_run_at: string | null
  }
  website: { enabled: boolean; landing_pages: number }
}

const label = (s: string) => s.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

/**
 * Platform status for the dashboard: modules on, the application type chosen at install, seeder results and the
 * website. Read-only, from GET /modules/overview, shown only to roles that may view modules. A seeder failure is
 * called out with its reason so it is not found by reading logs.
 */
export function PlatformStatus() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['modules', 'overview'],
    queryFn: () => api.get('/modules/overview').then((r) => r.data.data as PlatformOverview),
    staleTime: 30_000,
    retry: false, // a 403 or an outage is not fixed by asking again; the section just stays out of the way
  })

  if (isError) return null
  const tile = 'rounded-lg border bg-card p-4'
  return (
    <section className="mt-8" aria-labelledby="dash-platform" data-testid="platform-status">
      <h2 id="dash-platform" className="mb-3 text-lg font-semibold">
        Platform
      </h2>
      {isLoading || !data ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className={tile}>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Boxes className="h-4 w-4" aria-hidden /> Modules
              </p>
              <p className="mt-1 text-2xl font-bold">
                {data.modules.enabled}
                <span className="text-sm font-normal text-muted-foreground">
                  {' '}
                  of {data.modules.total} enabled
                </span>
              </p>
              <Link href="/admin/modules" className="text-sm text-primary hover:underline">
                Manage modules
              </Link>
            </div>
            <div className={tile}>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <AppWindow className="h-4 w-4" aria-hidden /> Application
              </p>
              <p className="mt-1 text-lg font-semibold">
                {data.app_type ? label(data.app_type) : 'Not chosen'}
              </p>
              <p className="text-xs text-muted-foreground">Chosen in the installer</p>
            </div>
            <div className={tile}>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Database className="h-4 w-4" aria-hidden /> Seeders
              </p>
              <p className="mt-1 text-2xl font-bold">
                {data.seeders.done}
                <span className="text-sm font-normal text-muted-foreground">
                  {' '}
                  of {data.seeders.total} ran
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {data.seeders.last_run_at
                  ? `Last run ${formatDate(data.seeders.last_run_at)}`
                  : 'No run recorded yet'}
              </p>
            </div>
            <div className={tile}>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Globe className="h-4 w-4" aria-hidden /> Website
              </p>
              {data.website.enabled ? (
                <>
                  <p className="mt-1 text-lg font-semibold">
                    {data.website.landing_pages} landing{' '}
                    {data.website.landing_pages === 1 ? 'page' : 'pages'}
                  </p>
                  <a
                    href="/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    View website
                  </a>
                </>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Frontend module is not enabled</p>
              )}
            </div>
          </div>

          {data.seeders.failed.length > 0 && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
            >
              <p className="flex items-center gap-2 font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" aria-hidden /> A seeder failed
              </p>
              <ul className="mt-2 space-y-1">
                {data.seeders.failed.map((f) => (
                  <li key={f.name}>
                    <span className="font-medium">{f.name}</span>
                    {f.error && <span className="text-muted-foreground">: {f.error}</span>}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Fix the cause, then run <code>node prisma/seed.js --pending</code> on the server.
              </p>
            </div>
          )}

          {data.modules.by_group.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Modules by group">
              {data.modules.by_group.map((g) => (
                <li key={g.group} className="rounded-full border px-3 py-1 text-xs">
                  {label(g.group)}{' '}
                  <span className="text-muted-foreground">
                    {g.enabled}/{g.total}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
