'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Upload } from 'lucide-react'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Button } from '@/components/ui/button'
import { Card, NativeSelect } from './ui'
import { useAdminAction, useFieldGroups } from '@/admin/hooks/useMembership'
import { MemberPageHeader, ToggleRow } from './MemberUi'

// Core columns an import file can fill; pack fields are added from the field groups.
export const IMPORT_FIELDS = [
  { key: 'full_name', label: 'Full name', pack: 'Core', required: true },
  { key: 'email', label: 'Email', pack: 'Core', required: true },
  { key: 'mobile', label: 'Mobile', pack: 'Core' },
  { key: 'plan_slug', label: 'Plan', pack: 'Membership' },
  { key: 'member_type', label: 'Member type', pack: 'Membership' },
  { key: 'member_since', label: 'Member since', pack: 'Membership' },
  { key: 'legal_name', label: 'Company / organisation name', pack: 'Business details' },
  { key: 'gstin', label: 'GSTIN', pack: 'Business details' },
  { key: 'tags', label: 'Tags', pack: 'Core' },
]
const ALIASES: Record<string, string> = {
  name: 'full_name',
  phone: 'mobile',
  plan: 'plan_slug',
  company: 'legal_name',
  gst_no: 'gstin',
  gst: 'gstin',
}
const REQUIRED = ['name', 'email', 'phone', 'plan_slug', 'start_date', 'end_date']
const MEMORY = 'member-import-mapping'

type Row = Record<string, string>
interface PreviewRow {
  row: number
  data: Record<string, unknown>
  errors: string[]
}
interface Preview {
  total: number
  valid: number
  invalid: number
  rows: PreviewRow[]
}
interface Result {
  created: number
  skipped: number
  updated?: number
  errors?: Array<{ row: number; errors: string[] } | string>
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

const text = (v: unknown) => (v === undefined || v === null || v === '' ? '—' : String(v))
const EXISTS = /already registered|already member/i

function download(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** Import members: upload -> match columns -> check rows -> import (mockups adm-import-1/map/2/3). */
export function ImportWizard() {
  const action = useAdminAction()
  const { data: groups } = useFieldGroups()
  const [step, setStep] = useState<'upload' | 'map' | 'check' | 'done'>('upload')
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({}) // CSV column -> member field
  const [preview, setPreview] = useState<Preview | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [addOptions, setAddOptions] = useState(false)
  const [remember, setRemember] = useState(true)
  const [invite, setInvite] = useState(true)
  const [fileError, setFileError] = useState('')

  const fields = [
    ...IMPORT_FIELDS,
    ...(groups?.items ?? []).flatMap((g) =>
      (g.fields ?? []).map((f) => ({ key: f.key, label: f.label, pack: g.name, required: false }))
    ),
  ]
  const packOf = (field: string) => fields.find((f) => f.key === field)?.pack

  async function onFile(file: File | undefined) {
    setFileError('')
    if (!file) return
    if (!/\.csv$/i.test(file.name)) return setFileError('Upload a .csv file.')
    const [head, ...body] = parseCsv(await file.text())
    if (!head || body.length === 0) return setFileError('The file has no data rows.')
    if (body.length > 5000) return setFileError('Up to 5,000 rows per import.')
    let saved: Record<string, string> = {}
    try {
      saved = JSON.parse(localStorage.getItem(MEMORY) ?? '{}')
    } catch {
      /* no saved mapping */
    }
    setFileName(file.name)
    setHeaders(head)
    setRows(body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? '']))))
    setMapping(
      Object.fromEntries(
        head.map((h) => {
          const k = h
            .trim()
            .toLowerCase()
            .replace(/[\s-]+/g, '_')
          const hit =
            saved[h] ??
            ALIASES[k] ??
            fields.find((f) => f.key === k || f.label.toLowerCase() === h.trim().toLowerCase())
              ?.key ??
            ''
          return [h, hit]
        })
      )
    )
    setStep('map')
  }

  const used = Object.values(mapping).filter(Boolean)
  const missing = IMPORT_FIELDS.filter((f) => f.required && !used.includes(f.key))
  const matched = used.length
  const body = { rows, mapping: Object.fromEntries(Object.entries(mapping).filter(([, v]) => v)) }

  function check() {
    if (remember) localStorage.setItem(MEMORY, JSON.stringify(body.mapping))
    action.mutate(
      { path: 'members/import/preview', data: { ...body, add_missing_options: addOptions } },
      {
        onSuccess: (p) => {
          setPreview(p as Preview)
          setStep('check')
        },
      }
    )
  }
  function commit() {
    action.mutate(
      {
        path: 'members/import/commit',
        data: { ...body, add_missing_options: addOptions, send_invite: invite },
      },
      {
        onSuccess: (r) => {
          setResult(r as Result)
          setStep('done')
        },
      }
    )
  }

  const exists = preview?.rows.filter((r) => r.errors.some((e) => EXISTS.test(e))).length ?? 0
  const bad = preview ? preview.invalid - exists : 0
  const stepNo = { upload: 1, map: 2, check: 2, done: 3 }[step]
  const label = (r: PreviewRow) =>
    r.errors.length
      ? r.errors.some((e) => EXISTS.test(e))
        ? 'Already a member'
        : (r.errors[0] ?? 'Error')
      : 'OK'

  return (
    <div>
      <MemberPageHeader
        title="Import members"
        subtitle={
          step === 'upload'
            ? 'Membership › Members › Import CSV'
            : step === 'map'
              ? `${fileName} · ${rows.length} rows · match your columns`
              : `${fileName}${rows.length ? ` · ${rows.length} rows` : ''}`
        }
        action={
          <div className="flex gap-2">
            {step === 'upload' && (
              <Button
                variant="outline"
                onClick={() =>
                  download(
                    'members-sample.csv',
                    `${REQUIRED.join(',')},amount_paid,method,reference,city,state,tags\nLakshmi P.,lakshmi@example.com,9000045678,gold,2026-04-01,2027-03-31,5898.82,UPI,REF1,Visakhapatnam,Andhra Pradesh,vizag\n`
                  )
                }
              >
                Download sample CSV
              </Button>
            )}
            {step === 'map' && (
              <>
                <Button variant="outline" onClick={() => setStep('upload')}>
                  Back
                </Button>
                <Button onClick={check} disabled={missing.length > 0 || action.isPending}>
                  Continue
                </Button>
              </>
            )}
            {step === 'check' && (
              <>
                <Button variant="outline" onClick={() => setStep('map')}>
                  Back
                </Button>
                <Button onClick={commit} disabled={action.isPending || !preview?.valid}>
                  Import {preview?.valid ?? 0} rows
                </Button>
              </>
            )}
          </div>
        }
      />
      <ol className="mb-6 flex gap-6 text-sm" aria-label="Import steps">
        {['Upload file', 'Check & map', 'Import'].map((s, i) => (
          <li
            key={s}
            aria-current={stepNo === i + 1 ? 'step' : undefined}
            className={`flex items-center gap-2 ${stepNo === i + 1 ? 'font-medium' : 'text-muted-foreground'}`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${stepNo >= i + 1 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
            >
              {stepNo > i + 1 ? '✓' : i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>
      {action.error ? <ErrorAlert error={action.error} /> : null}
      {step === 'upload' && (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-10 text-center">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <b>Drop your CSV here</b>
              <span className="text-sm text-muted-foreground">
                or browse · up to 5,000 rows · .csv
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                aria-label="CSV file"
                className="sr-only"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              <span className="rounded-md border px-3 py-1.5 text-sm">Choose file</span>
            </label>
            {fileError && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {fileError}
              </p>
            )}
          </Card>
          <Card title="Required columns">
            <ul className="space-y-1 text-sm">
              {REQUIRED.map((c) => (
                <li key={c}>
                  <code>{c}</code>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-muted-foreground">
              Optional: amount_paid, method, reference, city, state, tags
            </p>
          </Card>
        </div>
      )}
      {step === 'map' && (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card title="Match columns to fields">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    {['CSV column', 'Sample', 'Save into', 'Pack'].map((h) => (
                      <th key={h} className="py-2 pr-3 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {headers.map((h) => (
                    <tr key={h} className="border-t">
                      <td className="py-2 pr-3">
                        <code>{h}</code>
                      </td>
                      <td className="pr-3 text-muted-foreground">{text(rows[0]?.[h])}</td>
                      <td className="pr-3">
                        <NativeSelect
                          aria-label={`Save ${h} into`}
                          value={mapping[h] ?? ''}
                          onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value }))}
                          options={[
                            { value: '', label: 'Skip this column' },
                            ...fields.map((f) => ({ value: f.key, label: f.label })),
                          ]}
                        />
                      </td>
                      <td>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                          {mapping[h] ? (packOf(mapping[h]) ?? 'Pack') : 'Skip'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card title="Auto-match">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Matched</span>
                <b>
                  {matched} of {headers.length}
                </b>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Skipped</span>
                <b>{headers.length - matched}</b>
              </div>
              {missing.length > 0 && (
                <p role="alert" className="pt-2 text-destructive">
                  Still needed: {missing.map((f) => f.label).join(', ')}
                </p>
              )}
            </div>
            <div className="mt-3">
              <ToggleRow
                label="Add missing select options (e.g. new industries)"
                checked={addOptions}
                onChange={setAddOptions}
              />
              <ToggleRow label="Remember this mapping" checked={remember} onChange={setRemember} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Every field in every switched-on pack can be imported. Download the sample CSV to see
              the column keys.
            </p>
          </Card>
        </div>
      )}
      {step === 'check' && preview && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ['Ready', preview.valid],
              ['Errors (skipped)', bad],
              ['Already members (skipped)', exists],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border bg-card p-4">
                <p className="text-sm text-muted-foreground">{k}</p>
                <p className="mt-1 text-3xl font-semibold">{v}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  {['Row', 'Name', 'Email', 'Plan', 'Period', 'Check'].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 100).map((r) => (
                  <tr key={r.row} className="border-t">
                    <td className="px-4 py-2">{r.row}</td>
                    <td className="px-4 py-2">{text(r.data.full_name)}</td>
                    <td className="px-4 py-2">{text(r.data.email)}</td>
                    <td className="px-4 py-2">{text(r.data.plan_slug)}</td>
                    <td className="px-4 py-2">
                      {text(r.data.starts_at ?? r.data.member_since)} – {text(r.data.ends_at)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${r.errors.length ? (EXISTS.test(label(r)) ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800') : 'bg-green-100 text-green-800'}`}
                      >
                        {label(r)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-lg border bg-card px-4">
            <ToggleRow
              label='Send "set your password" invite to new members'
              checked={invite}
              onChange={setInvite}
            />
          </div>
        </div>
      )}
      {step === 'done' && result && (
        <Card>
          <div className="py-6 text-center">
            <h2 className="text-lg font-semibold">Import complete</h2>
            <p className="mt-1 text-muted-foreground">
              {result.created} members imported
              {result.updated ? ` · ${result.updated} updated` : ''} · {result.skipped} skipped
            </p>
            <div className="mt-4 flex justify-center gap-2">
              {(result.errors ?? []).length > 0 && (
                <Button
                  variant="outline"
                  onClick={() =>
                    download(
                      'import-errors.csv',
                      'row,error\n' +
                        result
                          .errors!.map((e) =>
                            typeof e === 'string'
                              ? `,"${e}"`
                              : `${e.row},"${e.errors.join('; ').replace(/"/g, '""')}"`
                          )
                          .join('\n')
                    )
                  }
                >
                  Download error report
                </Button>
              )}
              <Button asChild>
                <Link href="/admin/membership/members">View imported members</Link>
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
