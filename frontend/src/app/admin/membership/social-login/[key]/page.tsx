'use client'

import { useParams, useRouter } from 'next/navigation'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { useAuthProvider, useCommAction } from '@/admin/hooks/useMembershipComm'
import { Guarded } from '../../_components/CommShell'
import { SocialForm } from '../../_components/SocialForm'
import { SOCIAL_PRESETS, presetOf } from '../../_components/socialPresets'

function Edit({ pkey }: { pkey: string }) {
  const router = useRouter()
  const { data, isLoading } = useAuthProvider(pkey)
  const action = useCommAction()
  const preset = data ? (presetOf(data) ?? SOCIAL_PRESETS.oidc!) : null
  const back = () => router.push('/admin/membership/social-login')
  return (
    <div>
      <PageHeader
        title={data ? `Edit provider · ${data.label}` : 'Edit provider'}
        breadcrumbs={[
          { label: 'Membership', href: '/admin/membership' },
          { label: 'Social login', href: '/admin/membership/social-login' },
          { label: 'Edit' },
        ]}
        action={
          data && !presetOf(data)?.builtin ? (
            <Button
              variant="outline"
              onClick={() =>
                confirm(`Remove ${data.label}?`) &&
                action.mutate(
                  { method: 'delete', path: `auth/providers/${pkey}` },
                  {
                    onSuccess: () => {
                      toast({ title: 'Provider removed' })
                      back()
                    },
                  }
                )
              }
            >
              Remove
            </Button>
          ) : undefined
        }
      />
      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !data || !preset ? (
        <p className="text-sm text-muted-foreground">Provider not found.</p>
      ) : (
        <SocialForm preset={preset} provider={data} onSaved={back} />
      )}
    </div>
  )
}
export default function EditProviderPage() {
  const { key } = useParams<{ key: string }>()
  return (
    <Guarded>
      <Edit pkey={key} />
    </Guarded>
  )
}
