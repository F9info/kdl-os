'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { toast } from '@/hooks/use-toast'
import { useAdminAction, useAdminList, useMembers, usePlans } from '@/admin/hooks/useMembership'
import { NativeSelect, enumOptions } from './ui'
import { Seg, ToggleRow } from './MemberUi'

export const STATUSES = [
  'ACTIVE',
  'PENDING_APPROVAL',
  'PENDING_PAYMENT',
  'PAST_DUE',
  'EXPIRED',
  'CANCELLED',
  'SUSPENDED',
  'REJECTED',
]

export const EMPTY_FILTERS = {
  q: '',
  status: '',
  plan_id: '',
  member_type: '',
  tag: '',
  city: '',
  member_since_from: '',
  member_since_to: '',
  valid_till_from: '',
  valid_till_to: '',
}
export type Filters = typeof EMPTY_FILTERS

export const filtersParams = (f: Filters) =>
  Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''))

const iso = (d: Date) => d.toISOString().slice(0, 10)
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 86_400_000))

/** "Member since" quick ranges shown in the list toolbar. Custom ranges come from the Filters drawer. */
export const SINCE_PRESETS: Array<{ value: string; label: string; range: () => [string, string] }> =
  [
    { value: 'last_30', label: 'Last 30 days', range: () => [daysAgo(30), ''] },
    {
      value: 'this_year',
      label: 'This year',
      range: () => [`${new Date().getFullYear()}-01-01`, ''],
    },
    {
      value: 'last_year',
      label: 'Last year',
      range: () => [
        `${new Date().getFullYear() - 1}-01-01`,
        `${new Date().getFullYear() - 1}-12-31`,
      ],
    },
  ]

export interface Segment {
  id: string
  name: string
  filters: Partial<Filters>
  count?: number
}

/** Saved segments. Contract: GET/POST/DELETE /admin/members/segments (see needs-A2). */
export const useSegments = () => useAdminList<Segment>('members/segments')

export function MemberFilterDrawer({
  open,
  onClose,
  filters,
  onApply,
}: {
  open: boolean
  onClose: () => void
  filters: Filters
  onApply: (f: Filters) => void
}) {
  const [draft, setDraft] = useState(filters)
  const [save, setSave] = useState(false)
  const [name, setName] = useState('')
  const { data: plans } = usePlans()
  const { data: segs } = useSegments()
  const { data: preview } = useMembers({ ...filtersParams(draft), limit: 1 })
  const action = useAdminAction()
  useEffect(() => {
    if (open) setDraft(filters)
  }, [open, filters])
  const set = (k: keyof Filters) => (v: string) => setDraft((d) => ({ ...d, [k]: v }))

  function apply() {
    if (save && !name.trim()) return
    if (save)
      action.mutate(
        { path: 'members/segments', data: { name: name.trim(), filters: filtersParams(draft) } },
        { onSuccess: () => toast({ title: `Segment "${name.trim()}" saved` }) }
      )
    onApply(draft)
    setSave(false)
    setName('')
    onClose()
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>
            {preview?.total ?? '…'} members · filters use core fields
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {(segs?.items ?? []).length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Saved segments</p>
              <div className="flex flex-wrap gap-2">
                {segs!.items.map((s) => (
                  <span key={s.id} className="inline-flex items-center rounded-full border text-sm">
                    <button
                      type="button"
                      className="px-3 py-1 hover:underline"
                      onClick={() => setDraft({ ...EMPTY_FILTERS, ...s.filters })}
                    >
                      {s.name}
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete segment ${s.name}`}
                      className="pr-2 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        action.mutate({ method: 'delete', path: `members/segments/${s.id}` })
                      }
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between border-b pb-3">
            <span className="text-sm font-medium">Member type</span>
            <Seg
              label="Member type"
              value={draft.member_type}
              onChange={set('member_type')}
              options={[
                { value: '', label: 'All' },
                { value: 'INDIVIDUAL', label: 'Individual' },
                { value: 'ORGANISATION', label: 'Organisation' },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Plan">
              <NativeSelect
                placeholder="All plans"
                value={draft.plan_id}
                onChange={(e) => set('plan_id')(e.target.value)}
                options={(plans?.items ?? []).map((p) => ({ value: p.id, label: p.name }))}
              />
            </FormField>
            <FormField label="Status">
              <NativeSelect
                placeholder="All statuses"
                value={draft.status}
                onChange={(e) => set('status')(e.target.value)}
                options={enumOptions(STATUSES)}
              />
            </FormField>
            <FormField label="Member since from">
              <Input
                type="date"
                value={draft.member_since_from}
                onChange={(e) => set('member_since_from')(e.target.value)}
              />
            </FormField>
            <FormField label="Member since to">
              <Input
                type="date"
                value={draft.member_since_to}
                onChange={(e) => set('member_since_to')(e.target.value)}
              />
            </FormField>
            <FormField label="Valid till from">
              <Input
                type="date"
                value={draft.valid_till_from}
                onChange={(e) => set('valid_till_from')(e.target.value)}
              />
            </FormField>
            <FormField label="Valid till to">
              <Input
                type="date"
                value={draft.valid_till_to}
                onChange={(e) => set('valid_till_to')(e.target.value)}
              />
            </FormField>
            <FormField label="City">
              <Input value={draft.city} onChange={(e) => set('city')(e.target.value)} />
            </FormField>
            <FormField label="Tag">
              <Input value={draft.tag} onChange={(e) => set('tag')(e.target.value)} />
            </FormField>
          </div>
          <div className="border-t pt-2">
            <ToggleRow
              label="Save as segment"
              hint="Reuse these filters in emails and exports"
              checked={save}
              onChange={setSave}
            />
            {save && (
              <FormField label="Segment name" required>
                <Input
                  placeholder="e.g. Vizag manufacturers"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </FormField>
            )}
          </div>
          {action.error && <ErrorAlert error={action.error} />}
        </div>
        <SheetFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => setDraft({ ...EMPTY_FILTERS, q: filters.q })}>
            Clear
          </Button>
          <Button onClick={apply} disabled={save && !name.trim()}>
            Show {preview?.total ?? ''} members
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
