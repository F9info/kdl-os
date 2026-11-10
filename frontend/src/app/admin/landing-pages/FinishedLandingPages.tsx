'use client'

import Link from 'next/link'
import { CheckCircle2, Download, ExternalLink, Loader2, Package, Pencil } from 'lucide-react'
import { useLandingStatic } from '@/admin/hooks/useTemplateEngine'
import { landingEditorHref, type LandingSite } from '@/admin/hooks/useLandingPages'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Button } from '@/components/ui/button'
import { useProjectStore } from '@/stores/project.store'

// Shown right after a landing page is saved (the editor sends you to /admin/landing-pages?finished=1):
// only the finished (saved and live) landing pages, each as a thumbnail with three buttons.
//   Edit = back to the section editor.   Preview = open the live page.
//   Convert = write THIS page into its own static-website folder. Convert again after more edits (and Save)
//   and the same folder is rewritten with the new text, pictures and styles.

// A live picture of the page: the page itself, shrunk. It cannot be clicked or scrolled.
function Thumb({ slug, name }: { slug: string; name: string }) {
  return (
    <div className="relative h-56 overflow-hidden rounded-md border bg-muted">
      <iframe
        title={`Thumbnail of ${name}`}
        src={`/p/${slug}`}
        loading="lazy"
        tabIndex={-1}
        className="pointer-events-none absolute left-0 top-0 origin-top-left border-0 bg-white"
        style={{ width: 1280, height: 900, transform: 'scale(0.25)' }}
      />
    </div>
  )
}

function FinishedCard({ site }: { site: LandingSite }) {
  const projectId = useProjectStore((s) => s.activeProjectId) ?? ''
  const sb = useLandingStatic(projectId, site.id)
  const build = sb.status.data
  const busy = build?.state === 'running' || sb.start.isPending
  const done = build?.state === 'done' && !busy
  const page = site.pages[0]!

  return (
    <li className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <Thumb slug={site.slug} name={site.name} />
      <div className="min-w-0">
        <h3 className="truncate font-medium">{site.name}</h3>
        <p className="truncate text-sm text-muted-foreground">/p/{site.slug}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href={landingEditorHref(page.id)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href={`/p/${site.slug}`} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            Preview
          </a>
        </Button>
        <Button
          size="sm"
          onClick={() => sb.start.mutate()}
          disabled={!projectId || busy}
          data-testid={`convert-${site.slug}`}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
          {busy ? 'Converting…' : 'Convert'}
        </Button>
      </div>
      {busy && (
        <p className="text-sm text-muted-foreground" role="status">
          Converting… this takes a few minutes. You can stay on this page.
        </p>
      )}
      {build?.state === 'failed' && !busy && (
        <ErrorAlert error={new Error('The conversion failed. Click Convert to try again.')} />
      )}
      {done && (
        <div
          className="space-y-2 rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/30"
          data-testid={`static-result-${site.slug}`}
        >
          <p className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Moved to its folder. Ready to host.
          </p>
          {build.folder && (
            <p className="break-all text-sm">
              Folder: <code data-testid={`static-folder-${site.slug}`}>{build.folder}</code>. Edit
              the page, Save, then Convert again: this same folder is updated.
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={sb.download}
            data-testid={`download-${site.slug}`}
          >
            <Download className="h-4 w-4" />
            Download as .zip
          </Button>
        </div>
      )}
    </li>
  )
}

export function FinishedLandingPages({ sites }: { sites: LandingSite[] }) {
  const finished = sites.filter((s) => s.pages[0]?.status === 'PUBLISHED')

  if (!finished.length)
    return (
      <p className="text-sm text-muted-foreground" data-testid="no-finished">
        No saved landing page yet. Open a page in the editor and click Save.
      </p>
    )

  return (
    <div className="space-y-6">
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="finished-list">
        {finished.map((site) => (
          <FinishedCard key={site.id} site={site} />
        ))}
      </ul>
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/landing-pages">All landing pages and templates</Link>
      </Button>
    </div>
  )
}
