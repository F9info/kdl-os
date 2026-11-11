'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { Guarded } from '../../_components/CommShell'
import { SocialForm } from '../../_components/SocialForm'
import { ADD_PRESETS, SOCIAL_PRESETS } from '../../_components/socialPresets'

function New() {
  const router = useRouter()
  const k = useSearchParams().get('preset') ?? ''
  const preset = ADD_PRESETS.includes(k) ? SOCIAL_PRESETS[k]! : SOCIAL_PRESETS.oidc!
  return (
    <div>
      <PageHeader
        title={`Add provider · ${preset.label}`}
        breadcrumbs={[
          { label: 'Membership', href: '/admin/membership' },
          { label: 'Social login', href: '/admin/membership/social-login' },
          { label: 'Add provider' },
        ]}
      />
      <SocialForm
        key={preset.preset}
        preset={preset}
        onSaved={() => router.push('/admin/membership/social-login')}
      />
    </div>
  )
}
export default function NewProviderPage() {
  return (
    <Guarded>
      <Suspense>
        <New />
      </Suspense>
    </Guarded>
  )
}
