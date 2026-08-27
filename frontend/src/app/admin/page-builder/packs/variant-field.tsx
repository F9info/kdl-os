import type { ComponentType } from 'react'
import type { CustomField } from '@puckeditor/core'

/**
 * Shared "Design 1-4" picker for a Puck custom field — used by every block
 * that offers multiple layout variants (Hero, Nav, content, Footer). Renders
 * a 2x2 grid of abstract layout sketches (not live content previews — those
 * would need plumbing Puck doesn't expose to a field's render function) that
 * apply immediately on click, same mechanism as Puck's own `onChange`.
 */
export function variantField<V extends string>(
  labels: Record<string, string>,
  Thumb: ComponentType<{ variant: string }>
): CustomField<V> {
  return {
    type: 'custom',
    render: ({ value, onChange }) => (
      <div className="grid grid-cols-2 gap-2">
        {Object.keys(labels).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v as V)}
            className="rounded-md text-left"
            style={{
              outline: value === v ? '2px solid #2563eb' : '1px solid transparent',
              outlineOffset: 2,
            }}
          >
            <Thumb variant={v} />
            <div className="mt-1 text-xs font-medium">
              Design {v} — {labels[v]}
              {value === v ? ' · In use' : ''}
            </div>
          </button>
        ))}
      </div>
    ),
  }
}
