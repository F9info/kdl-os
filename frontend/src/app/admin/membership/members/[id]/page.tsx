'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useMember, usePlans, type Member } from '@/admin/hooks/useMembership'
import {
  ActivityTab,
  NotesTab,
  OverviewTab,
  PaymentsTab,
  ProfileTab,
  SectorTab,
} from '../../_components/MemberTabs'
import { ActionModal, StatusPill, Tabs, enumOptions } from '../../_components/ui'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'payments', label: 'Payments & invoices' },
  { key: 'profile', label: 'Profile' },
  { key: 'sector', label: 'Sector details' },
  { key: 'notes', label: 'Notes' },
  { key: 'activity', label: 'Activity' },
]
type Modal = 'extend' | 'change-plan' | 'record-payment' | 'suspend' | 'cancel' | null

function MemberActions({
  member,
  modal,
  setModal,
}: {
  member: Member
  modal: Modal
  setModal: (m: Modal) => void
}) {
  const { data: plans } = usePlans()
  const base = `members/${member.id}`
  const close = () => setModal(null)
  const suspended = member.subscription?.status === 'SUSPENDED'
  return (
    <>
      <ActionModal
        open={modal === 'extend'}
        onClose={close}
        title="Extend membership"
        description="Add days or set a new end date."
        fields={[
          { name: 'days', label: 'Add days', type: 'number' },
          { name: 'ends_at', label: 'Or new end date', type: 'date' },
        ]}
        request={(v) => ({ path: `${base}/extend`, data: v })}
        success="Membership extended"
      />
      <ActionModal
        open={modal === 'change-plan'}
        onClose={close}
        title="Change plan"
        description="Upgrades apply now with pro-rata; downgrades apply at renewal."
        fields={[
          {
            name: 'plan_id',
            label: 'New plan',
            type: 'select',
            required: true,
            options: [
              { value: '', label: 'Choose…' },
              ...(plans?.items ?? []).map((p) => ({ value: p.id, label: p.name })),
            ],
          },
        ]}
        request={(v) => ({ path: `${base}/change-plan`, data: v })}
        success="Plan changed"
      />
      <ActionModal
        open={modal === 'record-payment'}
        onClose={close}
        title="Record payment"
        description="Bank transfer, cash or cheque."
        fields={[
          {
            name: 'method',
            label: 'Method',
            type: 'select',
            options: enumOptions(['BANK_TRANSFER', 'CASH', 'CHEQUE']),
          },
          { name: 'amount', label: 'Amount received (INR)', type: 'number', required: true },
          { name: 'utr', label: 'UTR / reference' },
          { name: 'note', label: 'Note', type: 'textarea' },
        ]}
        request={(v) => ({
          path: `${base}/record-payment`,
          data: { ...v, amount: Math.round(Number(v.amount) * 100) },
        })}
        success="Payment recorded"
      />
      <ActionModal
        open={modal === 'suspend'}
        onClose={close}
        title={suspended ? 'Reactivate member' : 'Suspend member'}
        description={
          suspended ? 'Access is restored immediately.' : 'Access stops until you reactivate.'
        }
        fields={
          suspended ? [] : [{ name: 'reason', label: 'Reason', type: 'textarea', required: true }]
        }
        destructive={!suspended}
        submitLabel={suspended ? 'Reactivate' : 'Suspend'}
        request={(v) => ({ path: `${base}/${suspended ? 'reactivate' : 'suspend'}`, data: v })}
        success={suspended ? 'Member reactivated' : 'Member suspended'}
      />
      <ActionModal
        open={modal === 'cancel'}
        onClose={close}
        title="Cancel membership"
        fields={[
          { name: 'reason', label: 'Reason', type: 'textarea' },
          {
            name: 'immediately',
            label: 'Cancel immediately (otherwise at period end)',
            type: 'checkbox',
          },
        ]}
        destructive
        submitLabel="Cancel membership"
        request={(v) => ({ path: `${base}/cancel`, data: v })}
        success="Membership cancelled"
      />
    </>
  )
}

function MemberContent() {
  const { id } = useParams<{ id: string }>()
  const { data: member, isLoading, error } = useMember(id)
  const [tab, setTab] = useState('overview')
  const [modal, setModal] = useState<Modal>(null)
  const status = member?.subscription?.status
  return (
    <div>
      <PageHeader
        title={member?.legal_name || member?.full_name || 'Member'}
        breadcrumbs={[
          { label: 'Membership', href: '/admin/membership' },
          { label: 'Members', href: '/admin/membership/members' },
          { label: member?.member_no ?? '…' },
        ]}
        action={
          member && (
            <div className="flex items-center gap-2">
              {status && <StatusPill status={status} />}
              <Button variant="outline" onClick={() => setModal('extend')}>
                Extend
              </Button>
              <Button variant="outline" onClick={() => setModal('change-plan')}>
                Change plan
              </Button>
              <Button variant="outline" onClick={() => setModal('record-payment')}>
                Record payment
              </Button>
              <Button variant="outline" onClick={() => setModal('suspend')}>
                {status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
              </Button>
              <Button variant="outline" onClick={() => setModal('cancel')}>
                Cancel
              </Button>
            </div>
          )
        }
      />
      {error ? <ErrorAlert error={error} /> : null}
      {isLoading || !member ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <>
          <Tabs tabs={TABS} value={tab} onChange={setTab} />
          {tab === 'overview' && <OverviewTab member={member} />}
          {tab === 'payments' && <PaymentsTab member={member} />}
          {tab === 'profile' && <ProfileTab member={member} />}
          {tab === 'sector' && <SectorTab member={member} />}
          {tab === 'notes' && <NotesTab member={member} />}
          {tab === 'activity' && <ActivityTab member={member} />}
          <MemberActions member={member} modal={modal} setModal={setModal} />
        </>
      )}
    </div>
  )
}

export default function MemberDetailPage() {
  return (
    <ModuleGuard slug="membership">
      <PermissionGuard permission="membership:view">
        <MemberContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
