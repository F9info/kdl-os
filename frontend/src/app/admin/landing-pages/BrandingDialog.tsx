'use client'

import { useForm } from 'react-hook-form'
import { toast } from '@/hooks/use-toast'
import { useIdentity } from '@/hooks/useIdentity'
import {
  SITE_IDENTITY_KEYS,
  useSaveSiteIdentity,
  useSiteIdentity,
  type LandingSite,
  type SiteIdentity,
} from '@/admin/hooks/useLandingPages'
import { ImageUploadField } from '@/admin/components/shared/ImageUploadField'
import { Modal } from '@/components/shared/Modal'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/ui/loading-state'

type Values = Record<(typeof SITE_IDENTITY_KEYS)[number], string>
type AssetKey = 'logo_light' | 'favicon'
const ASSETS: { key: AssetKey; label: string }[] = [
  { key: 'logo_light', label: 'Logo' },
  { key: 'favicon', label: 'Favicon' },
]

const toValues = (identity: SiteIdentity): Values => ({
  app_name: identity.app_name ?? '',
  app_title: identity.app_title ?? '',
  description: identity.description ?? '',
  logo_light: identity.logo_light ?? '',
  favicon: identity.favicon ?? '',
})

function BrandingForm({
  site,
  initial,
  onClose,
}: {
  site: LandingSite
  initial: SiteIdentity
  onClose: () => void
}) {
  const { identity: project } = useIdentity()
  const save = useSaveSiteIdentity(site)
  const { register, handleSubmit, setValue, watch } = useForm<Values>({
    defaultValues: toValues(initial),
  })
  const onSubmit = (values: Values) =>
    save.mutate(values, {
      onSuccess: () => {
        toast({ title: 'Branding saved' })
        onClose()
      },
    })

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <p className="text-sm text-muted-foreground">
        Only for this landing page. Leave a field empty to use the project&apos;s Identity.
      </p>
      <FormField label="Site name" hint="Shown in the header and footer.">
        <Input placeholder={project.app_name || 'Project name'} {...register('app_name')} />
      </FormField>
      <FormField label="Browser tab title">
        <Input placeholder={project.app_title || project.app_name} {...register('app_title')} />
      </FormField>
      <FormField label="Description">
        <Input placeholder={project.description} {...register('description')} />
      </FormField>
      {ASSETS.map(({ key, label }) => (
        <FormField key={key} label={label}>
          <ImageUploadField
            name={key}
            value={watch(key)}
            onChange={(v) => setValue(key, v, { shouldDirty: true })}
            emptyText="Using the project image"
          />
        </FormField>
      ))}
      {save.error ? <ErrorAlert error={save.error} /> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          Save branding
        </Button>
      </div>
    </form>
  )
}

export function BrandingDialog({ site, onClose }: { site: LandingSite; onClose: () => void }) {
  const { data, isLoading, error } = useSiteIdentity(site)
  return (
    <Modal open onClose={onClose} title={`Branding: ${site.name}`}>
      {isLoading ? (
        <LoadingState />
      ) : error || !data ? (
        <ErrorAlert error={error ?? new Error('Could not load branding')} />
      ) : (
        <BrandingForm site={site} initial={data} onClose={onClose} />
      )}
    </Modal>
  )
}
