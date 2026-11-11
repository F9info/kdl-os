'use client'

import { PageHeader } from '@/admin/components/layout/PageHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthProviders } from '@/admin/hooks/useMembershipComm'
import { Guarded } from '../../_components/CommShell'
import { SocialForm } from '../../_components/SocialForm'
import { SOCIAL_PRESETS } from '../../_components/socialPresets'

const BUILTIN = Object.values(SOCIAL_PRESETS).filter((p) => p.builtin)

function Keys() {
  const { data, isLoading } = useAuthProviders()
  return (
    <div>
      <PageHeader
        title="Social login · Built-in providers"
        breadcrumbs={[
          { label: 'Membership', href: '/admin/membership' },
          { label: 'Social login', href: '/admin/membership/social-login' },
          { label: 'Keys' },
        ]}
      />
      <p className="-mt-4 mb-5 text-sm text-muted-foreground">
        Google, Facebook, Apple, Mobile OTP
      </p>
      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {BUILTIN.map((p) => (
            <SocialForm
              key={p.preset}
              embedded
              preset={p}
              provider={data?.items.find((x) => x.key === p.preset)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
export default function SocialKeysPage() {
  return (
    <Guarded>
      <Keys />
    </Guarded>
  )
}
