'use client'

import { useState } from 'react'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAdminAction } from '@/admin/hooks/useMembership'
import { NativeSelect } from './ui'

// Core columns an import file can fill. Pack fields are matched by their key on the server.
export const IMPORT_FIELDS = [
  { key: 'full_name', label: 'Full name', required: true },
  { key: 'email', label: 'Email', required: true },
  { key: 'mobile', label: 'Mobile' },
  { key: 'member_type', label: 'Member type' },
  { key: 'plan_slug', label: 'Plan' },
  { key: 'legal_name', label: 'Company name' },
  { key: 'gstin', label: 'GSTIN' },
  { key: 'tags', label: 'Tags' },
]

type Row = Record<string, string>
interface Preview {
  valid: number
  invalid: number
  rows: Array<{ row: number; ok: boolean; errors?: string[] }>
}
interface Result {
  created: number
  skipped: number
  errors?: string[]
}

/** Minimal RFC-4180 style CSV reader (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const out: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      cell = ''
      if (row.some((x) => x !== '')) out.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some((x) => x !== '')) out.push(row)
  return out
}

export function ImportWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const action = useAdminAction()
  const [step, setStep] = useState(1)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<Preview | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  function close() {
    setStep(1)
    setHeaders([])
    setRows([])
    setMapping({})
    setPreview(null)
    setResult(null)
    action.reset()
    onClose()
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    const [head, ...body] = parseCsv(await file.text())
    if (!head) return
    setHeaders(head)
    setRows(body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? '']))))
    // Auto-match columns whose header equals a field key or label.
    setMapping(
      Object.fromEntries(
        IMPORT_FIELDS.flatMap((f) => {
          const h = head.find((x) =>
            [f.key, f.label.toLowerCase()].includes(x.trim().toLowerCase())
          )
          return h ? [[f.key, h]] : []
        })
      )
    )
    setStep(2)
  }

  const missing = IMPORT_FIELDS.filter((f) => f.required && !mapping[f.key])

  function runPreview() {
    action.mutate(
      { path: 'members/import/preview', data: { rows, mapping } },
      {
        onSuccess: (p) => {
          setPreview(p as Preview)
          setStep(3)
        },
      }
    )
  }
  function commit() {
    action.mutate(
      { path: 'members/import/commit', data: { rows, mapping } },
      {
        onSuccess: (r) => {
          setResult(r as Result)
          setStep(4)
        },
      }
    )
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title="Import members"
      description={`Step ${Math.min(step, 3)} of 3 · ${['Upload', 'Match columns', 'Check & import'][Math.min(step, 3) - 1]}`}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={close}>
            {step === 4 ? 'Close' : 'Cancel'}
          </Button>
          {step === 2 && (
            <Button onClick={runPreview} disabled={missing.length > 0 || action.isPending}>
              Check rows
            </Button>
          )}
          {step === 3 && (
            <Button onClick={commit} disabled={action.isPending || !preview?.valid}>
              Import {preview?.valid ?? 0} members
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {step === 1 && (
          <div>
            <p className="mb-2 text-sm text-muted-foreground">
              CSV with a header row. Required:{' '}
              {IMPORT_FIELDS.filter((f) => f.required)
                .map((f) => f.label)
                .join(', ')}
              .
            </p>
            <Input
              type="file"
              accept=".csv,text/csv"
              aria-label="CSV file"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </div>
        )}
        {step === 2 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{rows.length} rows found.</p>
            {IMPORT_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center gap-3 text-sm">
                <span className="w-36">
                  {f.label}
                  {f.required && <span className="text-destructive"> *</span>}
                </span>
                <NativeSelect
                  aria-label={f.label}
                  placeholder="Skip"
                  value={mapping[f.key] ?? ''}
                  onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                  options={headers.map((h) => ({ value: h, label: h }))}
                />
              </label>
            ))}
          </div>
        )}
        {step === 3 && preview && (
          <div className="space-y-2 text-sm">
            <p>
              {preview.valid} valid, {preview.invalid} with problems.
            </p>
            <ul className="max-h-48 list-disc overflow-y-auto pl-5 text-destructive">
              {preview.rows
                .filter((r) => !r.ok)
                .map((r) => (
                  <li key={r.row}>
                    Row {r.row}: {(r.errors ?? []).join(', ')}
                  </li>
                ))}
            </ul>
          </div>
        )}
        {step === 4 && result && (
          <div className="text-sm">
            <p className="font-medium">
              Imported {result.created} members, skipped {result.skipped}.
            </p>
            {(result.errors ?? []).map((e) => (
              <p key={e} className="text-destructive">
                {e}
              </p>
            ))}
          </div>
        )}
        {action.error && <ErrorAlert error={action.error} />}
      </div>
    </Modal>
  )
}
