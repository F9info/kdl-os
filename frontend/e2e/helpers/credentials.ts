/**
 * Seeded super-admin credentials for E2E runs (KDL-307).
 *
 * The seed no longer ships a well-known default password (KDL-273 H2) — a
 * fresh seed generates a random one unless SEED_ADMIN_PASSWORD is set. The
 * local gate docker stack (docker-compose.yml / docker-compose.e2e.yml) pins
 * SEED_ADMIN_PASSWORD to the same dev-only default used here, so E2E suites
 * keep logging in after a fresh re-seed.
 *
 * Override with E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD when the target stack
 * was seeded with different credentials. The dev default below is for local
 * stacks only — never seed a shared or production environment with it.
 */
export const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL ?? 'admin@kdl.com',
  password: process.env.E2E_ADMIN_PASSWORD ?? 'kdl-dev-seed-password',
  /** Password used after the forced-change flow clears must_change_password. */
  changedPassword: process.env.E2E_ADMIN_CHANGED_PASSWORD ?? 'kdl-e2e-ch@nged-pw!',
}
