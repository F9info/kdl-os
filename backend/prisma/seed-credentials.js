import crypto from 'node:crypto';

const MIN_PASSWORD_LENGTH = 12;

/**
 * Resolve the initial admin credentials for database seeding (KDL-273 H2).
 *
 * - `SEED_ADMIN_PASSWORD` env var wins when set (min 12 chars).
 * - In production, seeding refuses to run without it — no well-known default.
 * - Otherwise a random password is generated; the caller must print it once.
 */
export function resolveSeedAdminCredentials(env = process.env) {
  const email = env.SEED_ADMIN_EMAIL || 'admin@kdl.com';
  const fromEnv = env.SEED_ADMIN_PASSWORD;

  if (fromEnv) {
    if (fromEnv.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`SEED_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    return { email, password: fromEnv, generated: false };
  }

  if (env.NODE_ENV === 'production') {
    throw new Error(
      'SEED_ADMIN_PASSWORD must be set in production — refusing to seed a default admin password',
    );
  }

  return { email, password: crypto.randomBytes(18).toString('base64url'), generated: true };
}
