'use client'

import { useState } from 'react'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { GeneralTab, SignupTab } from '../_components/SettingsTabs'
import { Tabs } from '../_components/ui'

const TABS = [
  { key: 'general', label: 'General' },
  { key: 'signup', label: 'Sign-up & profile' },
]

function SettingsContent() {
  const [tab, setTab] = useState('general')
  return (
    <div>
      <PageHeader
        title="Membership settings"
        breadcrumbs={[{ label: 'Membership', href: '/admin/membership' }, { label: 'Settings' }]}
      />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'general' ? <GeneralTab /> : <SignupTab />}
    </div>
  )
}

export default function MembershipSettingsPage() {
  return (
    <ModuleGuard slug="membership">
      <PermissionGuard permission="membership:view">
        <SettingsContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
