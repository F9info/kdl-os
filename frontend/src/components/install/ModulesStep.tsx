'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { installApi, type ModuleChoices, type ModuleInfo } from './install-api'

function Row({ m, note }: { m: ModuleInfo; note?: string }) {
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
        {m.name}
        {m.status === 'ENABLED' && (
          <span className="text-xs font-normal text-muted-foreground">(already on)</span>
        )}
        {note && <span className="text-xs font-normal text-muted-foreground">{note}</span>}
      </p>
      {m.description && <p className="mt-0.5 text-xs text-muted-foreground">{m.description}</p>}
      {m.dependsOn.length > 0 && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          Needs: {m.dependsOn.map((d) => d.name).join(', ')}
        </p>
      )}
    </div>
  )
}

/**
 * Installer step 6: modules. Core first (always on), then what the chosen application type installs, then
 * optional extras with the dependencies each one brings, and the sample-content question for a website.
 * Everything shown comes from the server's module manifests; nothing is listed here by hand.
 */
export function ModulesStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: ['install', 'modules'],
    queryFn: () => installApi.get('/modules').then((r) => r.data.data as ModuleChoices),
    retry: false,
    staleTime: 0,
  })
  const [extra, setExtra] = useState<string[]>([])
  const [demo, setDemo] = useState(true)
  useEffect(() => {
    if (!data) return
    setExtra(data.selected)
    setDemo(data.demo.value)
  }, [data])

  const save = useMutation({
    mutationFn: () =>
      installApi.put('/modules', { modules: extra, demo: data?.demo.available ? demo : undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['install'] })
      onNext()
    },
  })

  const toggle = (slug: string) =>
    setExtra((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug]))

  // A website picked as an extra makes the sample-content question appear.
  const websiteExtra =
    !!data && extra.some((s) => data.optional.find((m) => m.slug === s)?.group === 'cms')
  const showDemo = !!data && (data.demo.available || websiteExtra)

  return (
    <section>
      <h1 className="text-xl font-semibold">Choose your modules</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        These are set up when you launch. You can add or remove modules later in Modules.
      </p>
      {isLoading && <LoadingSpinner />}
      {error && <ErrorAlert error={error} />}
      {data && (
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Core, always on
            </p>
            <ul className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
              {data.core.map((m) => (
                <li key={m.slug} className="flex gap-2">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <Row m={m} />
                </li>
              ))}
            </ul>
          </div>

          {data.included.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Included with your application type
              </p>
              <ul className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
                {data.included.map((m) => (
                  <li key={m.slug} className="flex gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                    <Row m={m} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.optional.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Optional extras
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {data.optional.map((m) => {
                  const id = `extra-${m.slug}`
                  return (
                    <li key={m.slug} className="rounded-lg border p-3">
                      <label htmlFor={id} className="flex cursor-pointer gap-2">
                        <input
                          id={id}
                          type="checkbox"
                          className="mt-1 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                          checked={extra.includes(m.slug)}
                          disabled={!!m.blocked || save.isPending}
                          onChange={() => toggle(m.slug)}
                        />
                        <span className="min-w-0">
                          <Row
                            m={m}
                            note={
                              m.includes.length
                                ? `adds ${m.includes.map((i) => i.name).join(', ')}`
                                : undefined
                            }
                          />
                          {m.blocked && (
                            <span className="mt-1 block text-xs text-destructive">{m.blocked}</span>
                          )}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {showDemo && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex gap-3">
                <input
                  id="demo-content"
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                  checked={demo}
                  disabled={save.isPending}
                  aria-describedby="demo-content-help"
                  onChange={(e) => setDemo(e.target.checked)}
                />
                <div>
                  <label
                    htmlFor="demo-content"
                    className="block cursor-pointer text-sm font-medium"
                  >
                    Start with a sample website
                  </label>
                  <p id="demo-content-help" className="text-xs text-muted-foreground">
                    Creates a demo website and four landing pages from your company details, so you
                    can see your branding straight away. Turn it off to start empty.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {save.error && <ErrorAlert error={save.error} className="mt-4" />}
      <div className="mt-8 flex justify-between">
        <Button variant="ghost" onClick={onBack} disabled={save.isPending}>
          Back
        </Button>
        <Button onClick={() => save.mutate()} disabled={!data || save.isPending}>
          {save.isPending ? 'Saving…' : 'Next'}
        </Button>
      </div>
    </section>
  )
}
