import type { Data } from '@puckeditor/core'

/** The blocks that make up the website's top bar + header and its footer. */
const TOP = new Set(['ConstructionTopBar', 'ConstructionHeader'])
const BOTTOM = new Set(['ConstructionFooter'])

/** Where the site's "Log in" goes for visitors: the member login (the admin login stays at /login). */
export const MEMBER_LOGIN = '/membership/login'

interface Block {
  type: string
  props?: Record<string, unknown>
}

/** True when the site menu links to Membership, so a "/login" link there means the member login. */
const hasMembershipLink = (blocks: Block[]) =>
  blocks.some((b) => JSON.stringify(b.props ?? {}).includes('"/membership'))

/** Re-points "/login" links (button href and "Label|/login" menu lines) at the member login. */
export function memberLoginLinks<T>(data: T): T {
  const content = (data as { content?: Block[] } | null)?.content
  if (!Array.isArray(content) || !hasMembershipLink(content)) return data
  const fix = (v: unknown): unknown =>
    typeof v === 'string'
      ? v === '/login'
        ? MEMBER_LOGIN
        : v.replace(/\|\/login(?=\n|$)/g, `|${MEMBER_LOGIN}`)
      : v
  return {
    ...data,
    content: content.map((b) => ({
      ...b,
      props: Object.fromEntries(Object.entries(b.props ?? {}).map(([k, v]) => [k, fix(v)])),
    })),
  } as T
}

/** Splits a site page into the chrome above the content and the footer below it. */
export function chromeOf(data: Data, member = false): { top: Data | null; bottom: Data | null } {
  const content = (data.content ?? []) as Block[]
  const pick = (set: Set<string>) => {
    const c = content
      .filter((b) => set.has(b.type) && b.props?.visible !== false)
      // A logged-in member sees their own menu instead of Log in / Become a member.
      .map((b) =>
        member && b.type === 'ConstructionHeader'
          ? { ...b, props: { ...b.props, loginLabel: '', ctaLabel: '' } }
          : b
      )
    return c.length ? ({ ...data, content: c } as Data) : null
  }
  return { top: pick(TOP), bottom: pick(BOTTOM) }
}
