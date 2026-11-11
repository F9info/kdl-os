'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/shared/Modal'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { toast } from '@/hooks/use-toast'
import api from '@/lib/axios'
import { Seg } from './MemberUi'

const COLUMNS = [
  ['name_email', 'Name & email', true],
  ['phone', 'Phone', true],
  ['member_no', 'Member no.', true],
  ['plan_status', 'Plan & status', true],
  ['member_since', 'Member since', true],
  ['valid_till', 'Valid till', true],
  ['lifetime_paid', 'Lifetime paid', true],
  ['address', 'Address', false],
  ['custom_fields', 'Custom fields', false],
] as const

/** Export dialog: format + column picker. Filters/ids come from the list. Columns/format are API needs (needs-A2). */
export function MemberExportModal({
  open,
  onClose,
  total,
  params,
}: {
  open: boolean
  onClose: () => void
  total?: number
  params: Record<string, string>
}) {
  const [format, setFormat] = useState<'csv' | 'xlsx'>('csv')
  const [cols, setCols] = useState<string[]>(COLUMNS.filter((c) => c[2]).map((c) => c[0]))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function run() {
    setBusy(true)
    setError(null)
    try {
      const res = await api.get('/membership/admin/members/export', {
        params: { ...params, format, columns: cols.join(',') },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `members.${format}`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: 'Export ready' })
      onClose()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export members"
      description={`${total ?? ''} members match current filters`}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={run} disabled={busy || cols.length === 0}>
            Export
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium">Format</p>
          <Seg
            label="Format"
            value={format}
            onChange={setFormat}
            options={[
              { value: 'csv', label: 'CSV' },
              { value: 'xlsx', label: 'Excel' },
            ]}
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Columns</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {COLUMNS.map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={cols.includes(key)}
                  onChange={(e) =>
                    setCols((c) => (e.target.checked ? [...c, key] : c.filter((x) => x !== key)))
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Export is logged in Activity Log.</p>
        {error ? <ErrorAlert error={error} /> : null}
      </div>
    </Modal>
  )
}
