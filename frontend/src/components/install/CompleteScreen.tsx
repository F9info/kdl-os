'use client'

import { Check, ExternalLink, Rocket, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { LaunchResult } from './install-api'

const SEEDER_LABEL = (s: string) => s.replace(/[-_]/g, ' ')

/** Shown once, right after a successful launch: what was set up, then where to go next. */
export function CompleteScreen({
  result,
  onContinue,
}: {
  result: LaunchResult
  onContinue: () => void
}) {
  const s = result.summary
  const ok = (v?: string) => v === 'done'
  return (
    <section aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Rocket className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-semibold">Your workspace is ready</h1>
          <p className="text-sm text-muted-foreground">
            Everything below was set up. Sign in to continue.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4 text-sm">
        <div className="rounded-lg border p-4">
          <p className="font-medium">Status</p>
          <ul className="mt-2 space-y-1">
            {[
              ['Database connected, migrations applied', ok(s?.database)],
              ['Core installed: roles, permissions, admin account', ok(s?.core)],
            ].map(([label, good]) => (
              <li key={String(label)} className="flex items-center gap-2">
                {good ? (
                  <Check className="h-3.5 w-3.5 text-primary" aria-hidden />
                ) : (
                  <X className="h-3.5 w-3.5 text-destructive" aria-hidden />
                )}
                {label}
              </li>
            ))}
          </ul>
          {s && s.seeded.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Seeders run: {s.seeded.map(SEEDER_LABEL).join(', ')}
            </p>
          )}
        </div>

        <div className="rounded-lg border p-4">
          <p className="font-medium">
            Modules enabled ({s?.modules.length ?? result.modules.length})
          </p>
          {(s?.modules.length ?? 0) > 0 ? (
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {s!.modules.map((m) => (
                <li key={m.slug} className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-primary" aria-hidden /> {m.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-muted-foreground">Only the core admin.</p>
          )}
        </div>

        {s?.urls.site && (
          <div className="rounded-lg border p-4">
            <p className="font-medium">Your website</p>
            <p className="mt-1 text-muted-foreground">
              {s.demo.requested
                ? `A sample website and landing pages were created${s.demo.pages ? ` (${s.demo.pages} pages)` : ''}.`
                : 'Started empty, with no sample content.'}
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-sm">
          {s?.urls.site && (
            <a
              className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
              href={s.urls.site}
              target="_blank"
              rel="noreferrer"
            >
              View website <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
        </div>
        <Button onClick={onContinue}>Sign in to admin</Button>
      </div>
    </section>
  )
}
