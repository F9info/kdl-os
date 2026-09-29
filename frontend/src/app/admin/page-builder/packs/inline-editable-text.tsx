'use client'

import { useEffect, useRef } from 'react'
import { usePuck } from '@puckeditor/core'

type PathSegment = string | number

/** Immutable set-at-path over a block's own `props` object — handles both a
 *  flat field (`['headline']`) and a value nested inside a slide/card array
 *  (`['d2Slides', 2, 'lead']`) with the same call. */
function setAtPath(obj: unknown, path: PathSegment[], value: string): unknown {
  if (path.length === 0) return value
  const head = path[0] as PathSegment
  const rest = path.slice(1)
  if (typeof head === 'number') {
    const arr = Array.isArray(obj) ? [...obj] : []
    arr[head] = setAtPath(arr[head], rest, value)
    return arr
  }
  const record = obj && typeof obj === 'object' ? { ...(obj as Record<string, unknown>) } : {}
  record[head] = setAtPath(record[head], rest, value)
  return record
}

type ComponentDataLike = { type: string; props: Record<string, unknown> }

function patchBlockById(
  items: ComponentDataLike[] | undefined,
  id: string,
  path: PathSegment[],
  value: string
): ComponentDataLike[] {
  return (items ?? []).map((item) =>
    item.props?.id === id
      ? { ...item, props: setAtPath(item.props, path, value) as Record<string, unknown> }
      : item
  )
}

/**
 * Inline WYSIWYG text editing directly on the Puck canvas — an alternative
 * to the side Fields panel for simple text props. Looks up and patches the
 * block by its OWN `id` (via a `setData` action walking `content`/`zones`),
 * not the currently-selected item, so it works regardless of selection state.
 *
 * `path` is relative to the block's `props`: `['headline']` for a flat field,
 * `['d2Slides', activeIndex, 'lead']` for a value inside a slide/card array.
 */
export function InlineEditableText({
  id,
  path,
  value,
  as: Tag = 'span',
  className,
  style,
  isEditing,
  multiline = false,
}: {
  id: string
  path: PathSegment[]
  value: string
  as?: keyof JSX.IntrinsicElements
  className?: string
  style?: React.CSSProperties
  isEditing: boolean
  multiline?: boolean
}) {
  // Some surfaces (e.g. the website/layout design picker) call a component's
  // `render` function directly, outside any real <Puck> provider, passing a
  // plain `{ isEditing: true }` object as the `puck` prop just to flip a CSS
  // branch — `usePuck()` throws in that context ("must be used inside
  // <Puck>"). Catch it and fall back to a no-op dispatch: the plain-text
  // (non-editing) branch below never calls dispatch anyway, and even the
  // editing branch simply won't persist there, which is fine since that
  // picker is a static preview, not a real editing surface.
  // Safe despite the lint rule below: a given mounted instance's position in
  // the tree (inside <Puck> or not) never changes across its own re-renders,
  // so the hook-call count per instance stays stable even though this LOOKS
  // conditional to static analysis.
  let dispatch: ReturnType<typeof usePuck>['dispatch'] | undefined
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    dispatch = usePuck().dispatch
  } catch {
    dispatch = undefined
  }
  const ref = useRef<HTMLElement>(null)
  // Cast to untyped so a dynamic `as` tag doesn't force TS to union every
  // possible intrinsic element's props (`onKeyDown`/`onBlur`/etc all differ
  // per tag and blow up into an unrepresentable type otherwise).
  const Component = Tag as unknown as React.ComponentType<Record<string, unknown>>

  useEffect(() => {
    if (!ref.current) return
    if (document.activeElement === ref.current) return
    if (ref.current.textContent !== (value ?? '')) ref.current.textContent = value ?? ''
  }, [value])

  if (!isEditing) {
    return (
      <Component className={className} style={style}>
        {value}
      </Component>
    )
  }

  return (
    <Component
      ref={ref}
      className={`${className ?? ''} outline-none focus:ring-2 focus:ring-blue-400/70 focus:ring-offset-1 rounded-sm cursor-text`}
      // Puck sets `pointer-events: none` on the whole rendered block while
      // editing (so links/buttons/forms inside components stay inert on
      // canvas) — that cascades onto us too, so we explicitly re-enable it
      // on just this node. `auto` is a real override here, not a no-op:
      // `pointer-events` is an inherited property and a descendant's own
      // value always wins over an inherited `none`.
      style={{ ...style, pointerEvents: 'auto' }}
      contentEditable
      suppressContentEditableWarning
      onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === 'Enter' && !multiline) {
          e.preventDefault()
          ;(e.currentTarget as HTMLElement).blur()
        }
      }}
      onBlur={(e: React.FocusEvent<HTMLElement>) => {
        const next = e.currentTarget.textContent ?? ''
        if (next === value || !dispatch) return
        dispatch({
          type: 'setData',
          data: (prev) => ({
            content: patchBlockById(
              prev.content as ComponentDataLike[] | undefined,
              id,
              path,
              next
            ),
            zones: Object.fromEntries(
              Object.entries(prev.zones ?? {}).map(([zone, items]) => [
                zone,
                patchBlockById(items as ComponentDataLike[] | undefined, id, path, next),
              ])
            ),
          }),
        })
      }}
    >
      {value}
    </Component>
  )
}
