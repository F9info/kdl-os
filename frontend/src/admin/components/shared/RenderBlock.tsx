import type { ReactNode } from 'react'

/**
 * Draws one block's `render` function inside its own component. Some blocks (the Construction header and
 * footer) call React hooks inside `render`, so calling it straight from another component or hook ties
 * those hooks to the caller; switching between designs then changes the caller's hook count and React
 * stops with error #300. Give each design its own `key`.
 */
export function RenderBlock({
  render,
  props,
}: {
  render: (props: Record<string, unknown>) => ReactNode
  props: Record<string, unknown>
}) {
  return <>{render(props)}</>
}
