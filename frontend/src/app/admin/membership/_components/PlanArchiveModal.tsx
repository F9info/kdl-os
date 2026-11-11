'use client'

import { useState } from 'react'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import { useAdminAction, type Plan } from '@/admin/hooks/useMembership'
import { memberCount } from './PlansTable'

/** Archive needs the plan name typed in, so a stray click cannot hide a plan from the pricing page. */
export function PlanArchiveModal({ plan, onClose }: { plan: Plan | null; onClose: () => void }) {
  const action = useAdminAction()
  const [typed, setTyped] = useState('')
  const [notify, setNotify] = useState(false)
  const close = () => {
    setTyped('')
    setNotify(false)
    action.reset()
    onClose()
  }
  const n = plan ? memberCount(plan) : 0
  return (
    <Modal
      open={plan !== null}
      onClose={close}
      title={`Archive "${plan?.name ?? ''}"?`}
      description="Plan will be hidden from the pricing page"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={action.isPending || typed.trim() !== plan?.name}
            onClick={() =>
              plan &&
              action.mutate(
                { path: `plans/${plan.id}/archive`, data: { notify_members: notify } },
                {
                  onSuccess: () => {
                    toast({ title: 'Plan archived' })
                    close()
                  },
                }
              )
            }
          >
            Archive plan
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {n} existing member{n === 1 ? '' : 's'} keep their membership until it ends. No new
          sign-ups will be accepted.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />{' '}
          Notify existing members
        </label>
        <FormField label="Type the plan name to confirm">
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={plan?.name}
          />
        </FormField>
        {action.error && <ErrorAlert error={action.error} />}
      </div>
    </Modal>
  )
}
