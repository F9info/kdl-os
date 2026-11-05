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

/** Tab title, description and favicon from identity; empty values keep the old defaults. */
export function buildIdentityMetadata(identity: Record<string, string>): Metadata {
  return {
    title: identity.app_title || identity.app_name || DEFAULT_TITLE,
    description: identity.description || DEFAULT_DESCRIPTION,
    ...(identity.favicon ? { icons: { icon: identity.favicon } } : {}),
  }
}
