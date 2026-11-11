'use client'

import { useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useMember } from '@/admin/hooks/useMembership'
import {
  ActivityTab,
  NotesTab,
  OverviewTab,
  PaymentsTab,
  ProfileTab,
  SectorTab,
} from '../../_components/MemberTabs'
import {
  CancelModal,
  ChangePlanModal,
  ExtendModal,
  RecordPaymentModal,
  SuspendModal,
} from '../../_components/MemberActionModals'
import { MemberAvatar } from '../../_components/MemberUi'
import { dmy } from '../../_components/MemberFormat'
import { StatusPill, Tabs } from '../../_components/ui'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'payments', label: 'Payments & invoices' },
  { key: 'profile', label: 'Profile' },
  { key: 'sector', label: 'Sector details' },
  { key: 'notes', label: 'Notes' },
  { key: 'activity', label: 'Activity' },
]
type Modal = 'extend' | 'change-plan' | 'record-payment' | 'suspend' | 'cancel' | null
const MODALS = ['extend', 'change-plan', 'record-payment', 'suspend', 'cancel']

function MemberContent() {
  const { id } = useParams<{ id: string }>()
  const params = useSearchParams()
  const { data: member, isLoading, error } = useMember(id)
  const [tab, setTab] = useState('overview')
  const first = params?.get('action')
  const [modal, setModal] = useState<Modal>(
    first && MODALS.includes(first) ? (first as Modal) : null
  )
  const status = member?.subscription?.status
  const close = () => setModal(null)
  const plan = member?.subscription?.plan?.name
  return (
    <div>
      {error ? <ErrorAlert error={error} /> : null}
      {isLoading || !member ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <MemberAvatar name={member.legal_name || member.full_name} size={48} />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1>{member.legal_name || member.full_name}</h1>
                  {status && <StatusPill status={status} />}
                  {plan && (
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {plan}
                    </span>
                  )}
                  {member.member_type === 'ORGANISATION' && (
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      Organisation
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {[
                    member.member_no,
                    member.member_type === 'ORGANISATION' ? member.full_name : null,
                    member.email,
                    member.mobile,
                    `Member since ${dmy(member.member_since)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => setModal('extend')}>
                Extend
              </Button>
              <Button variant="outline" onClick={() => setModal('change-plan')}>
                Change plan
              </Button>
              <Button variant="outline" onClick={() => setModal('record-payment')}>
                Record payment
              </Button>
              <Button
                variant="outline"
                className={
                  status === 'SUSPENDED'
                    ? ''
                    : 'border-destructive text-destructive hover:bg-destructive/10'
                }
                onClick={() => setModal('suspend')}
              >
                {status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    More <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setModal('cancel')}>
                    Cancel membership
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <Tabs tabs={TABS} value={tab} onChange={setTab} />
          {tab === 'overview' && <OverviewTab member={member} />}
          {tab === 'payments' && <PaymentsTab member={member} />}
          {tab === 'profile' && <ProfileTab member={member} />}
          {tab === 'sector' && <SectorTab member={member} />}
          {tab === 'notes' && <NotesTab member={member} />}
          {tab === 'activity' && <ActivityTab member={member} />}
          {modal === 'extend' && <ExtendModal member={member} onClose={close} />}
          {modal === 'change-plan' && <ChangePlanModal member={member} onClose={close} />}
          {modal === 'record-payment' && <RecordPaymentModal member={member} onClose={close} />}
          {modal === 'suspend' && <SuspendModal member={member} onClose={close} />}
          {modal === 'cancel' && <CancelModal member={member} onClose={close} />}
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
