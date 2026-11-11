'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Check, Eye } from 'lucide-react'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { rupees, usePlan } from '@/admin/hooks/useMembership'
import { PlanForm } from '../../_components/PlanForm'
import {
  AccessTab,
  BenefitsTab,
  JoinFormTab,
  PricingTab,
  defaultPriceId,
} from '../../_components/PlanTabs'
import { Card, Tabs, humanize } from '../../_components/ui'

const TABS = [
  { key: 'details', label: 'Details' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'benefits', label: 'Benefits' },
  { key: 'joinform', label: 'Join form' },
  { key: 'access', label: 'Access' },
]

function PlanEditorContent() {
  const { id } = useParams<{ id: string }>()
  const { data: plan, isLoading, error } = usePlan(id)
  const [tab, setTab] = useState('details')
  const prices = plan?.prices ?? []
  const defId = defaultPriceId(prices)
  return (
    <div>
      <PageHeader
        title={plan?.name ?? 'Plan'}
        breadcrumbs={[
          { label: 'Membership', href: '/admin/membership' },
          { label: 'Plans', href: '/admin/membership/plans' },
          { label: plan?.name ?? '…' },
        ]}
        action={
          <div className="flex gap-3">
            <Button asChild variant="outline">
              <Link href="/membership" target="_blank">
                <Eye className="h-4 w-4" /> Preview card
              </Link>
            </Button>
            <Button type="submit" form="plan-form" disabled={!plan}>
              <Check className="h-4 w-4" /> Save plan
            </Button>
          </div>
        }
      />
      {error ? <ErrorAlert error={error} /> : null}
      {isLoading || !plan ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <>
          <Tabs tabs={TABS} value={tab} onChange={setTab} />
          {/* the details form stays mounted so "Save plan" works from every tab */}
          <div className={tab === 'details' ? undefined : 'hidden'}>
            <PlanForm plan={plan}>
              <Card
                title="Pricing"
                action={
                  <button
                    type="button"
                    className="text-sm text-primary"
                    onClick={() => setTab('pricing')}
                  >
                    + Add price
                  </button>
                }
              >
                {prices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No prices yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 text-left text-muted-foreground">
                        {['Interval', 'Amount', 'GST', 'Customer pays', 'Default'].map((h) => (
                          <th key={h} className="px-3 py-2 font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {prices.map((p) => (
                        <tr key={p.id} className="border-t">
                          <td className="px-3 py-3">{humanize(p.interval)}</td>
                          <td className="px-3">{rupees(p.amount)}</td>
                          <td className="px-3">
                            {p.gst_rate}% ({p.tax_mode === 'EXCLUSIVE' ? 'excl.' : 'incl.'})
                          </td>
                          <td className="px-3 font-semibold">
                            {rupees(
                              p.tax_mode === 'INCLUSIVE'
                                ? p.amount
                                : Math.round(p.amount * (1 + p.gst_rate / 100))
                            )}
                          </td>
                          <td className="px-3">{p.id === defId ? 'Default' : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
              <Card title="Benefits">
                <ul className="space-y-2 text-sm">
                  {(plan.benefits ?? []).map((b, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" /> {b.text}
                    </li>
                  ))}
                  {(plan.benefits ?? []).length === 0 && (
                    <li className="text-muted-foreground">No benefits yet.</li>
                  )}
                </ul>
              </Card>
            </PlanForm>
          </div>
          {tab === 'pricing' && <PricingTab plan={plan} />}
          {tab === 'benefits' && <BenefitsTab plan={plan} />}
          {tab === 'joinform' && <JoinFormTab plan={plan} />}
          {tab === 'access' && <AccessTab plan={plan} />}
        </>
      )}
    </div>
  )
}

export default function PlanEditorPage() {
  return (
    <ModuleGuard slug="membership">
      <PermissionGuard permission="membership:view">
        <PlanEditorContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
