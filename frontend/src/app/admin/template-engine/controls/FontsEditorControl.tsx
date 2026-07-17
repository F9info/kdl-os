'use client'

import { useState } from 'react'
import { Plus, Trash2, Globe, FolderUp } from 'lucide-react'
import { MediaPicker } from '@/components/shared/MediaPicker'
import { cn } from '@/lib/utils'
import type { Media } from '@/types/media.types'

// The `fonts` field (Typography → Custom Fonts) stores a JSON-stringified array
// of rows { type: 'google' | 'upload', name, src }. A malformed/empty value must
// degrade to [] and never throw — mirrors parseFieldOptions' defensive try/catch.

type FontType = 'google' | 'upload'

interface FontRow {
  type: FontType
  name: string
  src: string
}

export function parseRows(value: string): FontRow[] {
  try {
    const parsed = JSON.parse(value || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.map((r) => ({
      type: r?.type === 'upload' ? 'upload' : 'google',
      name: typeof r?.name === 'string' ? r.name : '',
      src: typeof r?.src === 'string' ? r.src : '',
    }))
  } catch {
    return []
  }
}

const inputCls = 'min-w-0 flex-1 rounded border border-border bg-muted px-2 py-1 text-sm'

export function FontsEditorControl({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}): JSX.Element {
  const rows = parseRows(value)
  // Which row (index) is currently choosing an uploaded font file, if any.
  const [pickerIndex, setPickerIndex] = useState<number | null>(null)

  const commit = (next: FontRow[]) => onChange(JSON.stringify(next))

  const updateRow = (i: number, patch: Partial<FontRow>) =>
    commit(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const removeRow = (i: number) => commit(rows.filter((_, idx) => idx !== i))

  const addRow = () => commit([...rows, { type: 'google', name: '', src: '' }])

  return (
    <div className="flex w-full flex-col gap-2">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          {/* Type toggle: Google Font ⇄ Uploaded font */}
          <button
            type="button"
            title={
              row.type === 'google'
                ? 'Google Font — click for Upload'
                : 'Uploaded font — click for Google'
            }
            onClick={() => updateRow(i, { type: row.type === 'google' ? 'upload' : 'google' })}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-border bg-muted text-muted-foreground transition-colors hover:border-primary"
          >
            {row.type === 'google' ? (
              <Globe className="h-4 w-4" />
            ) : (
              <FolderUp className="h-4 w-4" />
            )}
          </button>

          <input
            type="text"
            value={row.name}
            placeholder="Font name"
            className={cn(inputCls, 'max-w-[160px]')}
            onChange={(e) => updateRow(i, { name: e.target.value })}
          />

          {row.type === 'google' ? (
            <input
              type="text"
              value={row.src}
              placeholder="https://fonts.googleapis.com/css2?family=…"
              className={inputCls}
              onChange={(e) => updateRow(i, { src: e.target.value })}
            />
          ) : (
            <button
              type="button"
              onClick={() => setPickerIndex(i)}
              className={cn(
                inputCls,
                'text-left transition-colors hover:border-primary',
                !row.src && 'text-muted-foreground'
              )}
              title="Choose font file"
            >
              <span className="block truncate">{row.src || 'Choose font file…'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => removeRow(i)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
            title="Remove font"
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
          Add font
        </button>
      </div>

      {pickerIndex !== null && (
        <MediaPicker
          open
          onClose={() => setPickerIndex(null)}
          onSelect={(media: Media[]) => {
            const m = media[0]
            const url = m?.url
            if (url) {
              // Default the name from the filename when the row has none yet.
              const derived = (
                m.original_name ||
                (url.split(/[?#]/)[0] ?? '').split('/').pop() ||
                ''
              ).replace(/\.[^.]+$/, '')
              updateRow(pickerIndex, {
                src: url,
                name: rows[pickerIndex]?.name || derived,
              })
            }
            setPickerIndex(null)
          }}
        />
      )}
    </div>
  )
}
