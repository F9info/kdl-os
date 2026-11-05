import type { Metadata } from 'next'

const DEFAULT_TITLE = 'KDL Admin'
const DEFAULT_DESCRIPTION = 'KDL Starter Kit Admin Panel'

/**
 * Server-side fetch of the public application identity (`GET /api/app-config`) for <head>.
 * Returns {} on any failure (backend down, build time) — metadata must never crash a page.
 */
export async function fetchAppIdentity(): Promise<Record<string, string>> {
  const base = process.env.BACKEND_INTERNAL_URL ?? 'http://backend:4000'
  try {
    const res = await fetch(`${base}/api/app-config`, { next: { revalidate: 60 } })
    if (!res.ok) return {}
    const json = await res.json()
    return (json?.data?.identity as Record<string, string> | undefined) ?? {}
  } catch {
    return {}
  }
}

/**
 * Tab title, description and favicon from identity; empty values keep the old defaults. The
 * title is a template, so a page that sets its own title becomes "<page> | <site name>".
 */
export function buildIdentityMetadata(identity: Record<string, string>): Metadata {
  const siteName = identity.app_title || identity.app_name || DEFAULT_TITLE
  return {
    title: { default: siteName, template: `%s | ${siteName}` },
    description: identity.description || DEFAULT_DESCRIPTION,
    ...(identity.favicon ? { icons: { icon: identity.favicon } } : {}),
  }
}

/**
 * Title of a published site page (`path` is the backend public route, e.g. `site/about` or `my-slug`).
 * `host` is the visitor's host: the backend picks the site by it (T5.2), and it keeps the cached
 * answer per host. Null when missing or on any failure, so the site name alone is used.
 */
export async function fetchPublicPageTitle(
  path: string,
  host?: string | null
): Promise<string | null> {
  const base = process.env.BACKEND_INTERNAL_URL ?? 'http://backend:4000'
  const query = host ? `?host=${encodeURIComponent(host)}` : ''
  try {
    const res = await fetch(`${base}/api/page-builder/public/${path}${query}`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return null
    const json = await res.json()
    return (json?.data?.page?.title as string | undefined)?.trim() || null
  } catch {
    return null
  }
}
