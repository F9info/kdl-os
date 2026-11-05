'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ExternalLink, LayoutTemplate, Palette, Pencil, Plus } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { usePermissions } from '@/admin/hooks/usePermissions'
import {
  landingEditorHref,
  type LandingSite,
  useCreateLandingPage,
  useLandingSites,
  useLandingTemplates,
} from '@/admin/hooks/useLandingPages'
import { slugify } from '@/lib/utils'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { Modal } from '@/components/shared/Modal'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { StatusBadge } from '@/admin/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingState } from '@/components/ui/loading-state'
import { cn } from '@/lib/utils'
import { BrandingDialog } from './BrandingDialog'
import { newLandingSchema, type NewLandingForm } from './_schemas'

function NewLandingDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const { data: templates = [] } = useLandingTemplates()
  const create = useCreateLandingPage()
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, dirtyFields },
  } = useForm<NewLandingForm>({
    resolver: zodResolver(newLandingSchema),
    defaultValues: { name: '', slug: '', template: 'blank' },
  })
  const template = watch('template')

  const close = () => {
    reset()
    create.reset()
    onClose()
  }

  const onSubmit = (form: NewLandingForm) =>
    create.mutate(form, {
      onSuccess: (site) => {
        toast({ title: 'Landing page created' })
        close()
        const first = site.pages[0]
        router.push(first ? landingEditorHref(first.id) : '/admin/landing-pages')
      },
    })

  return (
    <Modal
      open={open}
      onClose={close}
      title="New landing page"
      description="Pick a starting point. You can change everything in the editor."
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={create.isPending}>
            Create and edit
          </Button>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <FormField label="Name" error={errors.name?.message} required>
          <Input
            placeholder="e.g. Spring sale"
            {...register('name', {
              // Keep the slug following the name until the user edits it themselves.
              onChange: (e) => {
                if (!dirtyFields.slug) setValue('slug', slugify(e.target.value))
              },
            })}
          />
        </FormField>
        <FormField
          label="Slug"
          error={errors.slug?.message}
          hint={`Public address: /p/${watch('slug') || 'your-slug'}`}
          required
        >
          <Input {...register('slug')} />
        </FormField>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Template</legend>
          {templates.map((t) => (
            <label
              key={t.key}
              className={cn(
                'flex cursor-pointer flex-col rounded-md border p-3 text-sm',
                template === t.key ? 'border-primary bg-primary/5' : 'border-border'
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                <input type="radio" value={t.key} {...register('template')} />
                {t.name}
              </span>
              <span className="ml-6 text-muted-foreground">{t.description}</span>
            </label>
          ))}
        </fieldset>
        {create.error && <ErrorAlert error={create.error} />}
      </form>
    </Modal>
  )
}

function LandingPagesContent() {
  const { can } = usePermissions()
  const { data: sites, isLoading, error } = useLandingSites()
  const [open, setOpen] = useState(false)
  const [branding, setBranding] = useState<LandingSite | null>(null)

  return (
    <div>
      <PageHeader
        title="Landing Pages"
        breadcrumbs={[{ label: 'Landing Pages' }]}
        action={
          can('landing:add') ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              New landing page
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorAlert error={error} />
      ) : !sites?.length ? (
        <EmptyState
          icon={LayoutTemplate}
          title="No landing pages yet"
          description="Create one from a template to promote a campaign or product."
          action={
            can('landing:add') ? (
              <Button onClick={() => setOpen(true)}>New landing page</Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => {
            const page = site.pages[0]
            return (
              <li key={site.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-medium">{site.name}</h3>
                    <p className="truncate text-sm text-muted-foreground">/p/{site.slug}</p>
                  </div>
                  {page && (
                    <StatusBadge
                      variant={page.status === 'PUBLISHED' ? 'active' : 'pending'}
                      label={page.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                    />
                  )}
                </div>
                <div className="mt-auto flex gap-2">
                  {page && (
                    <Button asChild size="sm" variant="outline">
                      <Link href={landingEditorHref(page.id)}>
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Link>
                    </Button>
                  )}
                  {can('projects:update') && (
                    <Button size="sm" variant="ghost" onClick={() => setBranding(site)}>
                      <Palette className="h-4 w-4" />
                      Branding
                    </Button>
                  )}
                  {page?.status === 'PUBLISHED' && (
                    <Button asChild size="sm" variant="ghost">
                      <a href={`/p/${site.slug}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        View
                      </a>
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <NewLandingDialog open={open} onClose={() => setOpen(false)} />
      {branding && <BrandingDialog site={branding} onClose={() => setBranding(null)} />}
    </div>
  )
}

export default function LandingPagesPage() {
  return (
    <ModuleGuard slug="landing">
      <PermissionGuard permission="landing:view">
        <LandingPagesContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
