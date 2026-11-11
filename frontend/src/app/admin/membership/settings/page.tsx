'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { Button } from '@/components/ui/button'
import { NewPackModal, PresetModal } from '../_components/SettingsPackModals'
import { GeneralTab, SETTINGS_GENERAL_FORM } from '../_components/SettingsGeneral'
import { SETTINGS_SIGNUP_FORM, SignupTab } from '../_components/SettingsSignup'
import { Tabs } from '../_components/ui'

const TABS = [
  { key: 'general', label: 'General' },
  { key: 'signup', label: 'Sign-up & profile' },
]

function SettingsContent() {
  const router = useRouter()
  const tab = useSearchParams().get('tab') === 'signup' ? 'signup' : 'general'
  const [modal, setModal] = useState<'preset' | 'pack' | null>(null)
  const setTab = (t: string) =>
    router.replace(
      t === 'signup' ? '/admin/membership/settings?tab=signup' : '/admin/membership/settings'
    )
  return (
    <div>
      <PageHeader
        title="Membership settings"
        breadcrumbs={[{ label: 'Membership', href: '/admin/membership' }, { label: 'Settings' }]}
        action={
          <div className="flex gap-3">
            {tab === 'signup' && (
              <>
                <Button variant="outline" onClick={() => setModal('preset')}>
                  Apply sector preset
                </Button>
                <Button variant="outline" onClick={() => setModal('pack')}>
                  New pack
                </Button>
              </>
            )}
            <Button
              type="submit"
              form={tab === 'signup' ? SETTINGS_SIGNUP_FORM : SETTINGS_GENERAL_FORM}
            >
              Save changes
            </Button>
          </div>
        }
      />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'general' ? (
        <GeneralTab />
      ) : (
        <SignupTab onPreset={() => setModal('preset')} onNewPack={() => setModal('pack')} />
      )}
      <PresetModal open={modal === 'preset'} onClose={() => setModal(null)} />
      <NewPackModal open={modal === 'pack'} onClose={() => setModal(null)} />
    </div>
  )
}

export default function MembershipSettingsPage() {
  return (
    <ModuleGuard slug="membership">
      <PermissionGuard permission="membership:view">
        <Suspense>
          <SettingsContent />
        </Suspense>
      </PermissionGuard>
    </ModuleGuard>
  )
}
