'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Copy,
  Eye,
  ExternalLink,
  LayoutTemplate,
  Palette,
  Pencil,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { usePermissions } from '@/admin/hooks/usePermissions'
import {
  landingEditorHref,
  type LandingSite,
  type LandingTemplate,
  useCreateLandingPage,
  useDeleteLandingSite,
  useLandingSites,
  useLandingTemplates,
  useTemplateLibrary,
} from '@/admin/hooks/useLandingPages'
import { slugify } from '@/lib/utils'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/admin/components/shared/ConfirmDialog'
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

// Preview pictures of the starter templates live in /public/landing-templates/<key>.jpg.
// A template without a picture (Blank, or one added later) simply shows none.
function TemplateThumb({ templateKey, className }: { templateKey: string; className?: string }) {
  const [missing, setMissing] = useState(false)
  if (templateKey === 'blank' || missing) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small static preview
    <img
      src={`/landing-templates/${templateKey}.jpg`}
      alt=""
      loading="lazy"
      onError={() => setMissing(true)}
      className={cn('w-full object-cover object-top', className)}
    />
  )
}

function TemplateGallery({
  templates,
  onUse,
  onDuplicate,
  onRename,
  onDelete,
}: {
  templates: LandingTemplate[]
  onUse: (key: string) => void
  onDuplicate?: (t: LandingTemplate) => void
  onRename?: (t: LandingTemplate) => void
  onDelete?: (t: LandingTemplate) => void
}) {
  const starters = templates.filter((t) => t.key !== 'blank')
  if (!starters.length) return null
  return (
    <section aria-labelledby="lp-templates" className="mb-8">
      <h2 id="lp-templates" className="text-base font-semibold">
        Start from a template
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Pick a design, then change every word, picture and colour in the editor. Duplicate one to
        make it your own, or save any landing page below as a template.
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {starters.map((t) => (
          <li
            key={t.key}
            data-testid={`template-card-${t.key}`}
            className="flex flex-col overflow-hidden rounded-lg border bg-card"
          >
            <div className="aspect-[64/45] overflow-hidden border-b bg-muted/40">
              <TemplateThumb templateKey={t.key} className="h-full" />
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
              <div>
                <h3 className="font-medium">{t.name}</h3>
                <p className="text-sm text-muted-foreground">{t.description}</p>
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => onUse(t.key)}
                  data-testid={`use-template-${t.key}`}
                >
                  Use this template
                </Button>
                <Button asChild size="sm" variant="outline" data-testid={`view-template-${t.key}`}>
                  <Link href={`/admin/landing-pages/preview/${t.key}`}>
                    <Eye className="h-4 w-4" />
                    View template
                  </Link>
                </Button>
              </div>
              {(onDuplicate || onRename || onDelete) && (
                <div className="flex flex-wrap gap-1 border-t pt-3">
                  {onDuplicate && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDuplicate(t)}
                      data-testid={`duplicate-template-${t.key}`}
                    >
                      <Copy className="h-4 w-4" />
                      Duplicate
                    </Button>
                  )}
                  {onRename && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onRename(t)}
                      data-testid={`rename-template-${t.key}`}
                    >
                      <Pencil className="h-4 w-4" />
                      Rename
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto text-destructive hover:text-destructive"
                      onClick={() => onDelete(t)}
                      data-testid={`delete-template-${t.key}`}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function NewLandingDialog({
  open,
  initialTemplate,
  onClose,
}: {
  open: boolean
  initialTemplate: string | null
  onClose: () => void
}) {
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

  // Opened from a gallery card: that template is chosen and the name starts as its name.
  useEffect(() => {
    if (!open || !initialTemplate) return
    const t = templates.find((x) => x.key === initialTemplate)
    if (!t) return
    reset({ name: t.name, slug: slugify(t.name), template: t.key })
  }, [open, initialTemplate, templates, reset])

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
              <TemplateThumb
                templateKey={t.key}
                className="ml-6 mt-2 h-24 w-auto max-w-[calc(100%-1.5rem)] rounded border"
              />
            </label>
          ))}
        </fieldset>
        {create.error && <ErrorAlert error={create.error} />}
      </form>
    </Modal>
  )
}

function TemplateNameDialog({
  naming,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  naming:
    | { mode: 'duplicate'; template: LandingTemplate }
    | { mode: 'rename'; template: LandingTemplate }
    | { mode: 'save'; site: LandingSite }
  busy: boolean
  error: unknown
  onClose: () => void
  onSubmit: (name: string) => void
}) {
  const initial =
    naming.mode === 'save'
      ? naming.site.name
      : naming.mode === 'rename'
        ? naming.template.name
        : `${naming.template.name} (copy)`
  const [name, setName] = useState(initial)
  const title =
    naming.mode === 'save'
      ? 'Save as template'
      : naming.mode === 'rename'
        ? 'Rename template'
        : 'Duplicate template'
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={
        naming.mode === 'save'
          ? 'The page body becomes a template you can start new landing pages from.'
          : undefined
      }
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => name.trim() && onSubmit(name.trim())}
            disabled={busy || !name.trim()}
          >
            {naming.mode === 'rename' ? 'Rename' : 'Save'}
          </Button>
        </div>
      }
    >
      <FormField label="Template name" required>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} autoFocus />
      </FormField>
      {error ? <ErrorAlert error={error} /> : null}
    </Modal>
  )
}

function LandingPagesContent() {
  const { can } = usePermissions()
  const { data: sites, isLoading, error } = useLandingSites()
  const { data: templates = [] } = useLandingTemplates()
  // Coming back from "View template" > "Use this template": open the dialog on that template.
  const useParam = useSearchParams().get('use')
  const [open, setOpen] = useState(Boolean(useParam))
  const [startWith, setStartWith] = useState<string | null>(useParam)
  const [branding, setBranding] = useState<LandingSite | null>(null)
  const [removing, setRemoving] = useState<LandingSite | null>(null)
  const remove = useDeleteLandingSite()
  const library = useTemplateLibrary()
  // One small name dialog serves three actions: duplicate, rename, save a page as a template.
  const [naming, setNaming] = useState<
    | { mode: 'duplicate'; template: LandingTemplate }
    | { mode: 'rename'; template: LandingTemplate }
    | { mode: 'save'; site: LandingSite }
    | null
  >(null)
  const [deletingTemplate, setDeletingTemplate] = useState<LandingTemplate | null>(null)

  return (
    <div>
      <PageHeader
        title="Landing Pages"
        breadcrumbs={[{ label: 'Landing Pages' }]}
        action={
          can('landing:add') ? (
            <Button
              onClick={() => {
                setStartWith(null)
                setOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              New landing page
            </Button>
          ) : undefined
        }
      />

      {can('landing:add') && (
        <TemplateGallery
          templates={templates}
          onUse={(key) => {
            setStartWith(key)
            setOpen(true)
          }}
          onDuplicate={(t) => setNaming({ mode: 'duplicate', template: t })}
          onRename={
            can('landing:edit') ? (t) => setNaming({ mode: 'rename', template: t }) : undefined
          }
          onDelete={can('landing:delete') ? (t) => setDeletingTemplate(t) : undefined}
        />
      )}

      <h2 className="mb-3 text-base font-semibold">Your landing pages</h2>
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
                  {can('landing:add') && page && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setNaming({ mode: 'save', site })}
                      data-testid={`save-template-${site.slug}`}
                    >
                      <Save className="h-4 w-4" />
                      Save as template
                    </Button>
                  )}
                  {can('landing:delete') && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto text-destructive hover:text-destructive"
                      onClick={() => setRemoving(site)}
                      data-testid={`delete-landing-${site.slug}`}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
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

      <NewLandingDialog
        open={open}
        initialTemplate={startWith}
        onClose={() => {
          setOpen(false)
          setStartWith(null)
        }}
      />
      {branding && <BrandingDialog site={branding} onClose={() => setBranding(null)} />}
      {naming && (
        <TemplateNameDialog
          naming={naming}
          busy={
            library.duplicate.isPending ||
            library.update.isPending ||
            library.saveFromPage.isPending
          }
          error={library.duplicate.error ?? library.update.error ?? library.saveFromPage.error}
          onClose={() => setNaming(null)}
          onSubmit={(name) => {
            const finish = (title: string) => () => {
              toast({ title })
              setNaming(null)
            }
            if (naming.mode === 'duplicate')
              library.duplicate.mutate(
                { key: naming.template.key, name },
                { onSuccess: finish('Template duplicated') }
              )
            else if (naming.mode === 'rename')
              library.update.mutate(
                { key: naming.template.key, name },
                { onSuccess: finish('Template renamed') }
              )
            else {
              const pageId = naming.site.pages[0]?.id
              if (pageId)
                library.saveFromPage.mutate(
                  { pageId, name },
                  { onSuccess: finish('Saved as a template') }
                )
            }
          }}
        />
      )}
      <ConfirmDialog
        open={deletingTemplate !== null}
        onClose={() => setDeletingTemplate(null)}
        isLoading={library.remove.isPending}
        title={`Delete the template "${deletingTemplate?.name ?? ''}"?`}
        description="Pages already made from it are not changed. A built-in template that you delete is not brought back."
        onConfirm={() =>
          deletingTemplate &&
          library.remove.mutate(deletingTemplate.key, {
            onSuccess: () => {
              toast({ title: 'Template deleted' })
              setDeletingTemplate(null)
            },
          })
        }
      />
      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        isLoading={remove.isPending}
        title={`Delete "${removing?.name ?? ''}"?`}
        description={`The page, its branding and its enquiry form are removed, and /p/${removing?.slug ?? ''} stops working. This cannot be undone. People's earlier form answers are kept.`}
        onConfirm={() =>
          removing &&
          remove.mutate(removing.id, {
            onSuccess: () => {
              toast({ title: 'Landing page deleted' })
              setRemoving(null)
            },
          })
        }
      />
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
