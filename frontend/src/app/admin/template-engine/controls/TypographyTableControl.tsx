'use client'

import { cn } from '@/lib/utils'

// The `typo_table` field (Typography → Typography Scale) stores a JSON-
// stringified array of fixed rows { name, size, sizeUnit, family, weight,
// lineHeight, letterSpacing } — one per text style (H1…H6, Paragraph, Small
// Text). Rows are not user-addable/removable; only the per-row values are
// editable.

// Mirrors backend schema/index.js's WEIGHTS/TYPO_SIZE_UNITS — kept in sync
// manually, they're fixed platform constants, not user data.
const WEIGHTS = ['100', '300', '400', '500', '600', '700', '800']
const SIZE_UNITS = ['px', 'em', 'in']

interface TypoRow {
  name: string
  size: number
  sizeUnit: string
  family: string
  weight: string
  lineHeight: number
  letterSpacing: number
}

function parseRows(value: string): TypoRow[] {
  try {
    const parsed = JSON.parse(value || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.map((r) => ({
      name: typeof r?.name === 'string' ? r.name : '',
      size: Number(r?.size) || 0,
      sizeUnit: SIZE_UNITS.includes(r?.sizeUnit) ? r.sizeUnit : 'px',
      family: typeof r?.family === 'string' ? r.family : '',
      weight: typeof r?.weight === 'string' ? r.weight : '400',
      lineHeight: Number(r?.lineHeight) || 0,
      letterSpacing: Number(r?.letterSpacing) || 0,
    }))
  } catch {
    return []
  }
}

const inputCls = 'w-full rounded border border-border bg-muted px-2 py-1 text-sm'

export function TypographyTableControl({
  value,
  onChange,
  choices,
}: {
  value: string
  onChange: (v: string) => void
  choices: string[]
}): JSX.Element {
  const rows = parseRows(value)

  const commit = (next: TypoRow[]) => onChange(JSON.stringify(next))

  const updateRow = (i: number, patch: Partial<TypoRow>) =>
    commit(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const familyChoices = Array.from(new Set([...choices, ...rows.map((r) => r.family)].filter(Boolean)))

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="p-1 text-left font-normal">Name</th>
            <th className="p-1 text-left font-normal">Size</th>
            <th className="p-1 text-left font-normal">Family</th>
            <th className="p-1 text-left font-normal">Weight</th>
            <th className="p-1 text-left font-normal">Line Height</th>
            <th className="p-1 text-left font-normal">Letter Spacing</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.name || i}>
              <td className="whitespace-nowrap p-1 font-medium">{row.name}</td>
              <td className="p-1">
                <div className="flex gap-1">
                  <input
                    type="number"
                    value={row.size}
                    className={inputCls}
                    onChange={(e) => updateRow(i, { size: Number(e.target.value) })}
                  />
                  <select
                    value={row.sizeUnit}
                    className={cn(inputCls, 'w-16 shrink-0')}
                    onChange={(e) => updateRow(i, { sizeUnit: e.target.value })}
                  >
                    {SIZE_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </td>
              <td className="p-1">
                <select
                  value={row.family}
                  className={inputCls}
                  onChange={(e) => updateRow(i, { family: e.target.value })}
                >
                  {familyChoices.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </td>
              <td className="p-1">
                <select
                  value={row.weight}
                  className={inputCls}
                  onChange={(e) => updateRow(i, { weight: e.target.value })}
                >
                  {WEIGHTS.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </td>
              <td className="p-1">
                <input
                  type="number"
                  step={0.05}
                  value={row.lineHeight}
                  className={inputCls}
                  onChange={(e) => updateRow(i, { lineHeight: Number(e.target.value) })}
                />
              </td>
              <td className="p-1">
                <input
                  type="number"
                  step={0.1}
                  value={row.letterSpacing}
                  className={inputCls}
                  onChange={(e) => updateRow(i, { letterSpacing: Number(e.target.value) })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
