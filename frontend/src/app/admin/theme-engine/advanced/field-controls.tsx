'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { BrandingFileControl } from '../controls/BrandingFileControl'
import { FontsEditorControl } from '../controls/FontsEditorControl'
import { ImageClassesEditorControl } from '../controls/ImageClassesEditorControl'
import { TypographyTableControl } from '../controls/TypographyTableControl'
import type { TEField, TEFieldOptions } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Field controls
// ─────────────────────────────────────────────────────────────────────────────

// Mirrors the backend's hex acceptance (service.js validateFieldValue): 3/4,
// 6 or 8 hex digits. rgb()/rgba() values are left untouched (edited via the
// swatch, which only emits hex) — the text field only ever needs to validate
// what a human can type.
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

function ColorControl({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])

  const commit = (raw: string) => {
    const trimmed = raw.trim()
    const withHash = trimmed && !trimmed.startsWith('#') ? `#${trimmed}` : trimmed
    if (HEX_COLOR_RE.test(withHash)) {
      onChange(withHash)
    } else {
      setText(value) // invalid — revert to last committed value
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <input
        type="color"
        value={value.startsWith('#') && value.length <= 9 ? value.slice(0, 7) : '#000000'}
        className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent p-0.5"
        onChange={(e) => onChange(e.target.value)}
      />
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        spellCheck={false}
        className="min-w-[90px] rounded border border-border bg-muted px-2 py-1 font-mono text-xs"
        data-testid="color-hex-input"
      />
    </span>
  )
}

function NumberControl({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: TEFieldOptions | null
}) {
  // Backend validates `number` fields with `Number(value)` — a unit suffix
  // ("40px") becomes NaN and 422s the whole pane save. So a number field always
  // posts the bare number; the unit (e.g. px) is display-only metadata. Any unit
  // conversion / scaling is applied once at seed time, not here.
  const unit = options?.unit
  const num = String(value).match(/^-?[\d.]+/)?.[0] ?? value
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        value={num}
        step="any"
        className="w-24 rounded border border-border bg-muted px-2 py-1 text-sm"
        onChange={(e) => onChange(e.target.value)}
      />
      {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
    </span>
  )
}

function SliderControl({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: TEFieldOptions | null
}) {
  const min = options?.min ?? 0
  const max = options?.max ?? 100
  const step = options?.step ?? (max - min <= 6 ? 1 : max - min < 10 ? 0.1 : 1)
  const unit = options?.unit ?? ''
  const num = parseFloat(value) || 0
  return (
    <span className="inline-flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={num}
        className="w-32 accent-primary"
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="w-14 text-right text-xs text-muted-foreground">
        {value}
        {unit}
      </span>
    </span>
  )
}

function SelectControl({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: TEFieldOptions | null
}) {
  const choices = options?.choices ?? []
  return (
    <select
      value={value}
      className="min-w-[160px] rounded border border-border bg-muted px-2 py-1.5 text-sm"
      onChange={(e) => onChange(e.target.value)}
    >
      {choices.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  )
}

function ToggleControl({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const checked = value === 'true'
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        checked={checked}
        className="sr-only"
        onChange={(e) => onChange(String(e.target.checked))}
      />
      <div
        className={cn(
          'h-6 w-11 rounded-full border-2 transition-colors',
          checked ? 'border-primary bg-primary' : 'border-border bg-muted'
        )}
      >
        <div
          className={cn(
            'h-4 w-4 translate-y-[1px] rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[21px]' : 'translate-x-[1px]'
          )}
        />
      </div>
    </label>
  )
}

function RadioControl({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: TEFieldOptions | null
}) {
  const choices = options?.choices ?? []
  return (
    <span className="inline-flex flex-wrap gap-2">
      {choices.map((c) => (
        <label key={c} className="inline-flex cursor-pointer items-center gap-1 text-sm">
          <input
            type="radio"
            checked={value === c}
            onChange={() => onChange(c)}
            className="accent-primary"
          />
          {c}
        </label>
      ))}
    </span>
  )
}

function TextControl({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      className="min-w-[200px] rounded border border-border bg-muted px-2 py-1.5 text-sm"
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function TextareaControl({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      value={value}
      rows={3}
      className="min-h-[72px] w-full rounded border border-border bg-muted px-2 py-1.5 font-mono text-sm"
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function MultiSelectControl({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: TEFieldOptions | null
}) {
  let cur: string[] = []
  try {
    cur = JSON.parse(value)
  } catch {}
  const choices = options?.choices ?? []
  const toggle = (c: string) => {
    const s = new Set(cur)
    s.has(c) ? s.delete(c) : s.add(c)
    onChange(JSON.stringify([...s]))
  }
  return (
    <span className="inline-flex flex-wrap gap-1">
      {choices.map((c) => (
        <button
          key={c}
          aria-pressed={cur.includes(c)}
          onClick={() => toggle(c)}
          className={cn(
            'rounded-full border px-3 py-0.5 text-xs transition-colors',
            cur.includes(c)
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-muted text-muted-foreground hover:border-primary'
          )}
        >
          {c}
        </button>
      ))}
    </span>
  )
}

// Select fields that let the user pick a font family (Heading/Body/Navigation/Button
// Font) all share the backend's static FONTS list baked into `options.choices` at
// seed time — they never see fonts added later via the sibling "Custom Fonts"
// repeater. Every such field is named "*Font*" and is the only select convention
// that is (Font Weight/Size fields use different field names) — see FieldControl.
const isFontFamilySelect = (field: TEField) =>
  field.input_type === 'select' && /font/i.test(field.field_name)

export function FieldControl({
  field,
  value,
  onChange,
  customFontNames,
}: {
  field: TEField
  value: string
  onChange: (v: string) => void
  customFontNames: string[]
}) {
  const t = field.input_type
  if (t === 'color') return <ColorControl value={value} onChange={onChange} />
  if (t === 'number')
    return <NumberControl value={value} onChange={onChange} options={field.options} />
  if (t === 'slider')
    return <SliderControl value={value} onChange={onChange} options={field.options} />
  if (t === 'select') {
    const choices = field.options?.choices ?? []
    const options =
      isFontFamilySelect(field) && customFontNames.length
        ? {
            ...field.options,
            choices: [...choices, ...customFontNames.filter((n) => !choices.includes(n))],
          }
        : field.options
    return <SelectControl value={value} onChange={onChange} options={options} />
  }
  if (t === 'toggle') return <ToggleControl value={value} onChange={onChange} />
  if (t === 'radio')
    return <RadioControl value={value} onChange={onChange} options={field.options} />
  if (t === 'textarea') return <TextareaControl value={value} onChange={onChange} />
  if (t === 'multiselect')
    return <MultiSelectControl value={value} onChange={onChange} options={field.options} />
  if (t === 'file') return <BrandingFileControl value={value} onChange={onChange} />
  if (t === 'fonts') return <FontsEditorControl value={value} onChange={onChange} />
  if (t === 'imglist') return <ImageClassesEditorControl value={value} onChange={onChange} />
  if (t === 'typo_table') {
    const choices = [...(field.options?.choices ?? []), ...customFontNames]
    return <TypographyTableControl value={value} onChange={onChange} choices={choices} />
  }
  // text, password → text input as baseline
  return <TextControl value={value} onChange={onChange} />
}
