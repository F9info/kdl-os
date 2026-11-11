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

const isChrome = (b: Block) => TOP.has(b.type) || BOTTOM.has(b.type)

/** True when the page carries its own top bar / header / footer blocks (landing pages do not). */
export const hasChrome = (data: Data) => ((data.content ?? []) as Block[]).some(isChrome)

/**
 * One header and footer for the whole site: the home page's top bar, header and footer replace the
 * ones a page stores, so editing the home header changes every page. Pages without chrome of their
 * own (landing pages) and pages that set `root.props.ownChrome` are left alone, as is everything
 * when the home page has no header.
 */
export function withSharedChrome(data: Data, home: Data | null | undefined, member = false): Data {
  if (!home || !hasChrome(data) || (data.root?.props as { ownChrome?: boolean })?.ownChrome)
    return data
  const { top, bottom } = chromeOf(home, member)
  if (!top) return data
  const body = ((data.content ?? []) as Block[]).filter((b) => !isChrome(b))
  return { ...data, content: [...top.content, ...body, ...(bottom?.content ?? [])] } as Data
}
