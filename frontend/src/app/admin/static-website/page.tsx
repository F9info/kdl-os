'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { useCreateSite } from '@/admin/hooks/useTemplateEngine'
import { Button } from '@/components/ui/button'

// Static website: the Web app project folder, built as plain HTML/CSS/JS (npm run build:static)
// so it can be hosted anywhere without a server.
function StaticWebsite() {
  const projectId = useSearchParams().get('projectId') ?? ''
  const createSite = useCreateSite(projectId)
  const slug = createSite.data?.slug ?? '<project-slug>'
  const commands = [
    `cd frontend/projects/${slug}`,
    'npm install',
    'NEXT_PUBLIC_API_BASE=https://your-backend.example.com npm run build:static',
  ].join('\n')

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Static website"
        breadcrumbs={[{ label: 'Content' }, { label: 'Static website' }]}
      />
      <p className="text-sm text-muted-foreground">
        Export your Web app as plain files you can host anywhere (Netlify, S3, GitHub Pages, nginx).
        The result is the <code>out/</code> folder inside the project folder.
      </p>

      <section className="space-y-2 rounded-lg border p-4">
        <h2 className="font-semibold">1. Prepare the project folder</h2>
        <p className="text-sm text-muted-foreground">
          Writes your current pages, menus, brand and images into the project folder.
        </p>
        <Button
          onClick={() => createSite.mutate()}
          disabled={!projectId || createSite.isPending}
          data-testid="prepare-static"
        >
          {createSite.isPending ? 'Preparing…' : 'Prepare project folder'}
        </Button>
        {createSite.data && (
          <p className="text-sm" data-testid="static-ready">
            Ready: <code>frontend/projects/{createSite.data.slug}</code> ({createSite.data.pages}{' '}
            pages)
          </p>
        )}
      </section>

      <section className="space-y-2 rounded-lg border p-4">
        <h2 className="font-semibold">2. Build the static files</h2>
        <pre className="overflow-x-auto rounded bg-muted p-3 text-xs" data-testid="static-commands">
          {commands}
        </pre>
        <p className="text-sm text-muted-foreground">
          Set <code>NEXT_PUBLIC_API_BASE</code> to your backend address so the live parts (forms,
          menus, FAQ, team) keep working. Leave it out for a fully offline site.
        </p>
      </section>

      <section className="space-y-1 rounded-lg border p-4 text-sm">
        <h2 className="font-semibold">What is not in a static export</h2>
        <ul className="list-disc pl-5 text-muted-foreground">
          <li>
            The work, catalog and sector detail pages, which need a server to look up each item.
          </li>
          <li>The /p/&lt;slug&gt; redirect links (the friendly page addresses are exported).</li>
          <li>Changes made later: rebuild and upload again after you publish new content.</li>
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
          <StaticWebsite />
        </Suspense>
      </PermissionGuard>
    </ModuleGuard>
  )
}
