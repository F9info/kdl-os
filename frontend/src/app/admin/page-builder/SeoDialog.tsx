'use client'

import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'
import {
  SEO_DESCRIPTION_HINT,
  SEO_DESCRIPTION_MAX,
  SEO_TITLE_HINT,
  SEO_TITLE_MAX,
  type PageSeo,
} from '@/lib/seo'
import { Modal } from '@/components/shared/Modal'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { ImageUploadField } from '@/admin/components/shared/ImageUploadField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { savePageSeo } from './store'

type Values = Required<PageSeo>

const toValues = (seo: PageSeo | null | undefined): Values => ({
  title: seo?.title ?? '',
  description: seo?.description ?? '',
  og_image: seo?.og_image ?? '',
  canonical: seo?.canonical ?? '',
  noindex: seo?.noindex ?? false,
})

const counter = (length: number, hint: number, max: number) =>
  `${length}/${hint} recommended (max ${max})`

/** Page editor > SEO: this page's search and share settings. Empty fields use the site defaults. */
export function SeoDialog({
  pageId,
  pageTitle,
  seo,
  onClose,
}: {
  pageId: string
  pageTitle: string
  seo: PageSeo | null | undefined
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { register, handleSubmit, watch, setValue } = useForm<Values>({
    defaultValues: toValues(seo),
  })
  const save = useMutation({
    mutationFn: (values: Values) => savePageSeo(pageId, values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['page-builder-page', pageId] })
      toast({ title: 'SEO saved' })
      onClose()
    },
  })
  const title = watch('title')
  const description = watch('description')

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Page SEO"
      description="How this page appears in search results and when shared. Empty fields use the site defaults."
    >
      <form className="space-y-4" onSubmit={handleSubmit((v) => save.mutate(v))}>
        <FormField label="SEO title" hint={counter(title.length, SEO_TITLE_HINT, SEO_TITLE_MAX)}>
          <Input maxLength={SEO_TITLE_MAX} placeholder={pageTitle} {...register('title')} />
        </FormField>
        <FormField
          label="Meta description"
          hint={counter(description.length, SEO_DESCRIPTION_HINT, SEO_DESCRIPTION_MAX)}
        >
          <Textarea rows={3} maxLength={SEO_DESCRIPTION_MAX} {...register('description')} />
        </FormField>
        <FormField label="Share image" hint="Shown when the page is shared. Wide images work best.">
          <ImageUploadField
            name="og_image"
            value={watch('og_image')}
            onChange={(v) => setValue('og_image', v, { shouldDirty: true })}
            emptyText="Using the site default"
          />
        </FormField>
        <FormField
          label="Canonical URL"
          hint="Only set this if the same content lives at another address."
        >
          <Input type="url" placeholder="https://" {...register('canonical')} />
        </FormField>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('noindex')} />
          Hide this page from search engines (noindex, left out of the sitemap)
        </label>
        {save.error ? <ErrorAlert error={save.error} /> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            Save SEO
          </Button>
        </div>
      </form>
    </Modal>
  )
}
