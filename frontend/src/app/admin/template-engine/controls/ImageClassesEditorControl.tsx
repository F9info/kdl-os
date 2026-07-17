'use client'

import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// The `imglist` field (Images → Image Classes) stores a JSON-stringified array
// of rows { name, w, h, fit }. Width/height accept a number OR the literal
// string 'auto'. object-fit is one of FITS. Malformed/empty value degrades to []
// and never throws — mirrors parseFieldOptions' defensive try/catch. Unknown
// keys on a row (e.g. the prototype's wu/hu/pos) are preserved on edit so a
// round-trip does not silently drop data.

type Dim = number | 'auto'

const FITS = ['cover', 'contain', 'fill', 'none', 'scale-down'] as const
type Fit = (typeof FITS)[number]

interface ImgRow {
  name: string
  w: Dim
  h: Dim
  fit: Fit
  [key: string]: unknown
}

// A raw string from a width/height input becomes a number, or the literal
// 'auto' for the string 'auto', an empty field, or any non-numeric input.
function parseDim(raw: string): Dim {
  const s = raw.trim().toLowerCase()
  if (s === '' || s === 'auto') return 'auto'
  const n = Number(s)
  return Number.isNaN(n) ? 'auto' : n
}

function normalizeDim(v: unknown): Dim {
  if (v === 'auto') return 'auto'
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  return 'auto'
}

function parseRows(value: string): ImgRow[] {
  try {
    const parsed = JSON.parse(value || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.map((r) => ({
      ...(r && typeof r === 'object' ? r : {}),
      name: typeof r?.name === 'string' ? r.name : '',
      w: normalizeDim(r?.w),
      h: normalizeDim(r?.h),
      fit: (FITS as readonly string[]).includes(r?.fit) ? (r.fit as Fit) : 'cover',
    }))
  } catch {
    return []
  }
}

const inputCls = 'rounded border border-border bg-muted px-2 py-1 text-sm'

export function ImageClassesEditorControl({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}): JSX.Element {
  const rows = parseRows(value)

  const commit = (next: ImgRow[]) => onChange(JSON.stringify(next))

  const updateRow = (i: number, patch: Partial<ImgRow>) =>
    commit(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const removeRow = (i: number) => commit(rows.filter((_, idx) => idx !== i))

  const addRow = () => commit([...rows, { name: '', w: 150, h: 150, fit: 'cover' }])

  return (
    <div className="flex w-full flex-col gap-2">
      {rows.length > 0 && (
        <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <span className="min-w-[160px] flex-1">Class name</span>
          <span className="w-20 text-center">Width</span>
          <span className="w-4" />
          <span className="w-20 text-center">Height</span>
          <span className="w-[130px]">Fit</span>
          <span className="w-8" />
        </div>
      )}

      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={row.name}
            placeholder="class-name"
            className={cn(inputCls, 'min-w-[160px] flex-1')}
            onChange={(e) => updateRow(i, { name: e.target.value })}
          />
          <input
            type="text"
            inputMode="numeric"
            value={String(row.w)}
            placeholder="auto"
            title="Width — a number or 'auto'"
            className={cn(inputCls, 'w-20 text-right')}
            onChange={(e) => updateRow(i, { w: parseDim(e.target.value) })}
          />
          <span className="w-4 text-center text-xs text-muted-foreground">×</span>
          <input
            type="text"
            inputMode="numeric"
            value={String(row.h)}
            placeholder="auto"
            title="Height — a number or 'auto'"
            className={cn(inputCls, 'w-20 text-right')}
            onChange={(e) => updateRow(i, { h: parseDim(e.target.value) })}
          />
          <select
            value={row.fit}
            title="object-fit"
            className={cn(inputCls, 'w-[130px]')}
            onChange={(e) => updateRow(i, { fit: e.target.value as Fit })}
          >
            {FITS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => removeRow(i)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
            title="Remove class"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      <div>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          Add class
        </button>
      </div>
    </div>
  )
}
