'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { usePermissions } from '@/admin/hooks/usePermissions'
import type { SeoDefaults } from '@/lib/seo'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { FormField } from '@/components/shared/FormField'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { ImageUploadField } from '@/admin/components/shared/ImageUploadField'
import { LoadingState } from '@/components/ui/loading-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const KEY = ['seo-defaults'] as const

// Site-wide SEO defaults (T6.1). Pages without their own SEO use these.
function SeoSettingsContent() {
  const qc = useQueryClient()
  const { can } = usePermissions()
  const { data, isLoading, error } = useQuery({
    queryKey: KEY,
    queryFn: () =>
      api.get('/page-builder/seo/defaults').then((r) => r.data.data.defaults as SeoDefaults),
  })
  const [form, setForm] = useState<SeoDefaults>({ title_template: '', default_og_image: '' })
  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  const save = useMutation({
    mutationFn: (values: SeoDefaults) =>
      api
        .put('/page-builder/seo/defaults', values)
        .then((r) => r.data.data.defaults as SeoDefaults),
    onSuccess: (saved) => {
      qc.setQueryData(KEY, saved)
      toast({ title: 'SEO defaults saved' })
    },
  })

  const templateError =
    form.title_template !== '' && !form.title_template.includes('%s')
      ? 'Must contain %s, which is replaced by the page title.'
      : undefined

  return (
    <div className="max-w-2xl">
      <PageHeader title="SEO" breadcrumbs={[{ label: 'Settings' }, { label: 'SEO' }]} />
      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorAlert error={error} />
      ) : (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            if (!templateError) save.mutate(form)
          }}
        >
          <p className="text-sm text-muted-foreground">
            Defaults for every page. A page can override them in the page editor (SEO button).
          </p>
          <FormField
            label="Title template"
            error={templateError}
            hint='Example: "%s | Acme". %s is the page title. Leave empty to use the application name.'
          >
            <Input
              value={form.title_template}
              maxLength={100}
              onChange={(e) => setForm({ ...form, title_template: e.target.value })}
            />
          </FormField>
          <FormField
            label="Default share image"
            hint="Used when a page has no share image of its own."
          >
            <ImageUploadField
              name="default_og_image"
              value={form.default_og_image}
              onChange={(v) => setForm({ ...form, default_og_image: v })}
              emptyText="None"
              setText="Image set"
            />
          </FormField>
          {save.error ? <ErrorAlert error={save.error} /> : null}
          <Button
            type="submit"
            disabled={!can('settings:edit') || save.isPending || !!templateError}
          >
            Save
          </Button>
          <div className="border-t pt-4 text-sm text-muted-foreground">
            Generated for you:{' '}
            <a
              className="text-primary underline"
              href="/sitemap.xml"
              target="_blank"
              rel="noreferrer"
            >
              /sitemap.xml
            </a>{' '}
            (published pages, without those marked noindex) and{' '}
            <a
              className="text-primary underline"
              href="/robots.txt"
              target="_blank"
              rel="noreferrer"
            >
              /robots.txt
            </a>
            .
          </div>
        </form>
      )}
    </div>
  )
}

export default function SeoSettingsPage() {
  return (
    <PermissionGuard permission="settings:view">
      <SeoSettingsContent />
    </PermissionGuard>
  )
}
