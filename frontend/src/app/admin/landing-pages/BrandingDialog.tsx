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
  type SiteIdentityData,
} from '@/admin/hooks/useLandingPages'
import { ImageUploadField } from '@/admin/components/shared/ImageUploadField'
import { Modal } from '@/components/shared/Modal'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { LoadingState } from '@/components/ui/loading-state'

type Values = Record<(typeof SITE_IDENTITY_KEYS)[number], string>
type AssetKey = 'logo_light' | 'logo_dark' | 'favicon'
const ASSETS: { key: AssetKey; label: string; hint?: string }[] = [
  { key: 'logo_light', label: 'Logo (light background)' },
  {
    key: 'logo_dark',
    label: 'Logo (dark background)',
    hint: 'Used in the footer. Leave it empty and the footer puts your logo on a white tile.',
  },
  { key: 'favicon', label: 'Favicon' },
]

type TextKey = Exclude<keyof Values, AssetKey>
interface TextField {
  key: TextKey
  label: string
  hint?: string
  type?: string
  multiline?: boolean
}
// Every field starts empty and shows the project's Identity value as its placeholder, so the page
// uses the company's details until a field is filled in here.
const GROUPS: { title: string; fields: TextField[] }[] = [
  {
    title: 'Name and description',
    fields: [
      { key: 'app_name', label: 'Site name', hint: 'Shown in the header and footer.' },
      { key: 'app_title', label: 'Browser tab title' },
      { key: 'description', label: 'Description', hint: 'Shown in the footer.' },
    ],
  },
  {
    title: 'Contact details (footer)',
    fields: [
      { key: 'contact_email', label: 'Contact email', type: 'email' },
      { key: 'contact_email_secondary', label: 'Secondary email', type: 'email' },
      { key: 'contact_phone', label: 'Contact phone' },
      { key: 'contact_phone_secondary', label: 'Secondary phone' },
      { key: 'contact_address', label: 'Address', multiline: true },
    ],
  },
  {
    title: 'Social links (footer)',
    fields: [
      { key: 'social_facebook', label: 'Facebook URL' },
      { key: 'social_x', label: 'X (Twitter) URL' },
      { key: 'social_instagram', label: 'Instagram URL' },
      { key: 'social_linkedin', label: 'LinkedIn URL' },
      { key: 'social_youtube', label: 'YouTube URL' },
    ],
  },
  { title: 'Footer text', fields: [{ key: 'copyright', label: 'Copyright notice' }] },
]

const toValues = (identity: SiteIdentity): Values =>
  Object.fromEntries(SITE_IDENTITY_KEYS.map((k) => [k, identity[k] ?? ''])) as Values

function BrandingForm({
  site,
  initial,
  resolved,
  onClose,
}: {
  site: LandingSite
  initial: SiteIdentity
  resolved: SiteIdentityData['resolved']
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
        Only for this landing page. Leave a field empty to use the project&apos;s Identity (shown in
        grey).
      </p>
      <div className="max-h-[60vh] space-y-6 overflow-y-auto pr-1">
        {GROUPS.map((group) => (
          <fieldset key={group.title} className="space-y-4">
            <legend className="mb-1 text-sm font-semibold">{group.title}</legend>
            {group.fields.map((f) => (
              <FormField key={f.key} label={f.label} hint={f.hint}>
                {f.multiline ? (
                  <Textarea rows={3} placeholder={project[f.key]} {...register(f.key)} />
                ) : (
                  <Input type={f.type} placeholder={project[f.key]} {...register(f.key)} />
                )}
              </FormField>
            ))}
          </fieldset>
        ))}
        <fieldset className="space-y-4">
          <legend className="mb-1 text-sm font-semibold">Pictures</legend>
          {ASSETS.map(({ key, label, hint }) => (
            <FormField key={key} label={label} hint={hint}>
              <ImageUploadField
                name={key}
                value={watch(key)}
                onChange={(v) => setValue(key, v, { shouldDirty: true })}
                emptyText="Using the project image"
                previewUrl={resolved[key] ?? ''}
                inheritedUrl={project[key] ?? ''}
                darkBackground={key === 'logo_dark'}
              />
            </FormField>
          ))}
        </fieldset>
      </div>
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
        <BrandingForm
          site={site}
          initial={data.identity}
          resolved={data.resolved}
          onClose={onClose}
        />
      )}
    </Modal>
  )
}
