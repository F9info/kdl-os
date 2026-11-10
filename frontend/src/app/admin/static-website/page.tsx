'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { ArrowLeft, CheckCircle2, Download, Loader2, Package } from 'lucide-react'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { useCreateSite, useStaticBuild } from '@/admin/hooks/useTemplateEngine'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Convert to Static Website: one click turns the Web app's website into an independent folder of plain
// HTML, CSS, JavaScript and images that any static host can serve (no server, no database). The Web
// app itself is never changed. Click it again after any change to get an up-to-date folder.
const isUrl = (v: string) => {
  try {
    const u = new URL(v)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function Step({
  state,
  children,
}: {
  state: 'todo' | 'doing' | 'done'
  children: React.ReactNode
}) {
  return (
    <li className="flex items-center gap-2 text-sm" data-state={state}>
      {state === 'done' ? (
        <CheckCircle2 className="h-4 w-4 text-green-600" />
      ) : state === 'doing' ? (
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      ) : (
        <span className="h-4 w-4 rounded-full border" />
      )}
      <span className={state === 'todo' ? 'text-muted-foreground' : ''}>{children}</span>
    </li>
  )
}

function ConvertToStatic() {
  const projectId = useSearchParams().get('projectId') ?? ''
  const createSite = useCreateSite(projectId)
  const sb = useStaticBuild(projectId)
  const [apiBase, setApiBase] = useState('')
  const [apiBaseError, setApiBaseError] = useState('')
  const [siteUrl, setSiteUrl] = useState('')
  const [siteUrlError, setSiteUrlError] = useState('')
  const build = sb.status.data
  const preparing = createSite.isPending
  const running = build?.state === 'running' || sb.start.isPending
  const busy = preparing || running
  // While a new conversion runs, the previous result is not shown (and its zip is not offered): it is
  // about to be replaced, and "done" from the last time would otherwise look like this build's result.
  const done = build?.state === 'done' && !busy
  const shownState = busy ? 'running' : build?.state

  async function convert() {
    const base = apiBase.trim()
    if (base && !isUrl(base)) {
      setApiBaseError('Enter the full address, like https://your-backend.example.com')
      return
    }
    setApiBaseError('')
    const host = siteUrl.trim()
    if (host && !isUrl(host)) {
      setSiteUrlError('Enter the full address, like https://www.example.com')
      return
    }
    setSiteUrlError('')
    try {
      await createSite.mutateAsync() // 1. write the latest pages, menus, brand and images
    } catch {
      return // the hook already shows why
    }
    sb.start.mutate({ apiBase: base, siteUrl: host }) // 2. build the static files (polled until finished)
  }

  const step1 = preparing ? 'doing' : running || done ? 'done' : 'todo'
  const step2 = running && !preparing ? 'doing' : done ? 'done' : 'todo'
  const step3 = done ? 'done' : 'todo'

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Convert to Static Website"
        breadcrumbs={[{ label: 'Frontend' }, { label: 'Convert to Static Website' }]}
      />
      {projectId && (
        <Button asChild variant="ghost" size="sm" className="-mt-4 gap-1.5 px-2">
          <Link href={`/admin/template-engine/projects/${projectId}/website`}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Web app
          </Link>
        </Button>
      )}

      <p className="text-sm text-muted-foreground">
        Makes a separate copy of your website as plain files (HTML, CSS, JavaScript and images) that
        any static host can serve: Netlify, S3, GitHub Pages, nginx. Your Web app is not changed.
        Changed something later? Click the button again and replace the files on your host with the
        new folder.
      </p>

      <section className="space-y-4 rounded-lg border bg-card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            onClick={convert}
            disabled={!projectId || busy}
            data-testid="convert-static"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
            {busy
              ? 'Converting… (a few minutes)'
              : done
                ? 'Convert again with the latest changes'
                : 'Convert to Static Website'}
          </Button>
          {shownState && shownState !== 'idle' && (
            <span className="text-sm text-muted-foreground" data-testid="static-state">
              {shownState}
            </span>
          )}
        </div>

        <ol className="space-y-2" aria-label="Progress">
          <Step state={step1}>Collect your latest pages, menus, brand and images</Step>
          <Step state={step2}>Build the website files</Step>
          <Step state={step3}>Ready to host</Step>
        </ol>

        {build?.state === 'failed' && (
          <ErrorAlert error={new Error('The conversion failed. The technical log is below.')} />
        )}

        {done && (
          <div
            className="space-y-3 rounded-md border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30"
            data-testid="static-result"
          >
            <p className="text-sm font-medium">Your static website is ready.</p>
            {build.folder && (
              <p className="text-sm">
                The folder is on your computer at{' '}
                <code data-testid="static-folder">{build.folder}</code>. Copy that folder (or
                download it below) and upload its contents to your host.
              </p>
            )}
            <Button variant="outline" onClick={sb.download} data-testid="download-static">
              <Download className="h-4 w-4" />
              Download as .zip
            </Button>
          </div>
        )}

        <details className="text-sm">
          <summary className="cursor-pointer font-medium">Search engines (sitemap)</summary>
          <div className="mt-2 space-y-2 text-muted-foreground">
            <p>
              The export always includes a robots.txt and each page&apos;s title, description and
              share tags from its SEO settings. Enter the address you will host the site at (for
              example https://www.example.com) to also get a sitemap.xml and canonical addresses.
            </p>
            <label className="block font-medium text-foreground" htmlFor="site-url">
              Website address (optional)
            </label>
            <Input
              id="site-url"
              placeholder="https://www.example.com"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
            />
            {siteUrlError && (
              <p className="text-destructive" role="alert" data-testid="site-url-error">
                {siteUrlError}
              </p>
            )}
          </div>
        </details>

        <details className="text-sm">
          <summary className="cursor-pointer font-medium">Forms on the static website</summary>
          <div className="mt-2 space-y-2 text-muted-foreground">
            <p>
              A static website has no server, so a form cannot save messages by itself. Leave this
              empty and each form is replaced by your contact email and phone from Settings &gt;
              Identity. Or enter the public address of your Web app (for example
              https://app.example.com) and the forms, menus and FAQ on the static site keep working
              through it.
            </p>
            <label className="block font-medium text-foreground" htmlFor="api-base">
              Web app address (optional)
            </label>
            <Input
              id="api-base"
              placeholder="https://your-backend.example.com"
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
            />
            {apiBaseError && (
              <p className="text-destructive" role="alert" data-testid="api-base-error">
                {apiBaseError}
              </p>
            )}
          </div>
        </details>

        {build?.log && (
          <details open={build.state === 'failed'} className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">Technical log</summary>
            <pre
              className="mt-2 max-h-48 overflow-auto rounded bg-muted p-3 text-xs"
              data-testid="static-log"
            >
              {build.log}
            </pre>
          </details>
        )}
      </section>

      <section className="space-y-1 rounded-lg border p-4 text-sm">
        <h2 className="font-semibold">Good to know</h2>
        <ul className="list-disc pl-5 text-muted-foreground">
          <li>Your Web app keeps working exactly as before. Nothing is moved or removed.</li>
          <li>The folder is independent: copy only it. It needs no server or database.</li>
          <li>
            The work, catalog and sector detail pages are not included (they need a server to look
            up each item), and neither are the /p/&lt;slug&gt; links (the friendly page addresses
            are).
          </li>
          <li>
            Your published landing pages are in the folder too, each at its own address (like
            /your-page-slug/). A draft landing page is left out.
          </li>
        </ul>
      </section>
    </div>
  )
}

export default function StaticWebsitePage() {
  return (
    <ModuleGuard slug="menus">
      <PermissionGuard permission="menus:view">
        <Suspense fallback={null}>
          <ConvertToStatic />
        </Suspense>
      </PermissionGuard>
    </ModuleGuard>
  )
}
