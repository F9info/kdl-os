import { createHash, timingSafeEqual } from 'node:crypto'

// Cache tag on the public page data the <head> is built from (see lib/app-identity.ts).
export const PUBLIC_PAGES_TAG = 'public-pages'

/**
 * Token the backend sends to POST /revalidate. It is a hash of JWT_SECRET, which both services
 * already share, so there is nothing extra to configure. Keep in sync with
 * backend/src/shared/frontend-revalidate.js.
 */
export const revalidateToken = (secret: string) =>
  createHash('sha256').update(`revalidate:${secret}`).digest('hex')

/** Constant-time check; false for a missing or wrong-length token. */
export function isValidRevalidateToken(given: string | null, secret: string): boolean {
  if (!given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(revalidateToken(secret))
  return a.length === b.length && timingSafeEqual(a, b)
}
