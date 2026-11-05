import { createHash } from 'node:crypto';
import { logger } from './utils/logger.js';

// The public site caches page <head> data in Next for 60 s. After a publish, unpublish or SEO edit
// the backend asks the frontend to drop that cache so the change shows at once.
// No extra secret to configure: both services already share JWT_SECRET, and the token is a hash of it.
export const revalidateToken = (secret = process.env.JWT_SECRET) =>
  createHash('sha256')
    .update(`revalidate:${secret ?? ''}`)
    .digest('hex');

/** Fire-and-forget. Never throws and never delays the admin request; failure only means "up to 60 s later". */
export function revalidatePublicPages() {
  const base = process.env.FRONTEND_INTERNAL_URL ?? 'http://frontend:3000';
  fetch(`${base}/revalidate`, {
    method: 'POST',
    headers: { 'x-revalidate-token': revalidateToken() },
    signal: AbortSignal.timeout(3000),
  })
    .then((res) => {
      if (!res.ok) logger.warn(`frontend revalidate answered ${res.status}`);
    })
    .catch((err) => logger.warn(`frontend revalidate failed: ${err.message}`));
}
