import type { ComponentType, ReactNode } from 'react'
import type { CustomField } from '@puckeditor/core'
import { usePuck } from '@puckeditor/core'

/**
 * Builds a Design-picker thumbnail that renders the block's own real
 * `render` function (live props of the selected block, falling back to
 * `fallbackProps` before anything is selected) scaled down — same technique
 * as the Insert-a-block modal, so the picker shows the actual block instead
 * of a hand-drawn sketch. Use this instead of writing a bespoke Thumb
 * component per block.
 */
export function liveThumb<P extends Record<string, unknown>>(
  render: (props: P) => ReactNode,
  fallbackProps: P
): ComponentType<{ variant: string }> {
  return function LiveThumb({ variant }: { variant: string }) {
    const { selectedItem } = usePuck()
    const props = { ...fallbackProps, ...(selectedItem?.props ?? {}), variant } as P
    return (
      <div className="h-28 w-full overflow-hidden rounded-md border border-slate-200 bg-white pointer-events-none">
        <div style={{ width: 1200, transform: 'scale(0.22)', transformOrigin: 'top left' }}>
          {render(props)}
        </div>
      </div>
    )
  }
}

/**
 * Shared "Design 1-4" picker for a Puck custom field — used by every block
 * that offers multiple layout variants (Hero, Nav, content, Footer). Apply
 * immediately on click, same mechanism as Puck's own `onChange`.
 */
export function variantField<V extends string>(
  labels: Record<string, string>,
  Thumb: ComponentType<{ variant: string }>
): CustomField<V> {
  return {
    type: 'custom',
    render: ({ value, onChange }) => (
      <div className="flex flex-col gap-2">
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
