#!/usr/bin/env node
/**
 * Reset the admin password without going through the UI.
 * Use when the seeded password was not captured and the admin is locked out.
 *
 * Usage:
 *   node scripts/reset-admin-password.js [--email <email>] [--password <pass>] [--force]
 *   NEW_ADMIN_PASSWORD=<pass> node scripts/reset-admin-password.js
 *
 * In production, --force is required as a deliberate safeguard.
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { parseArgs } from 'node:util';
import { prisma } from '../src/config/database.js';
import { hashPassword, clearLoginLockout } from '../src/modules/auth/service.js';

const MIN_PASSWORD_LENGTH = 12;

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    password: { type: 'string' },
    force: { type: 'boolean', default: false },
  },
  strict: false,
});

const email = values.email || process.env.SEED_ADMIN_EMAIL || 'admin@kdl.com';
const rawPassword = values.password || process.env.NEW_ADMIN_PASSWORD;
const force = values.force;

async function main() {
  if (process.env.NODE_ENV === 'production' && !force) {
    console.error('ERROR: Refusing to reset admin password in production without --force.');
    console.error('       Re-run with --force if you intend to reset production credentials.');
    process.exit(1);
  }

  let password = rawPassword;
  let generated = false;

  if (!password) {
    password = crypto.randomBytes(18).toString('base64url');
    generated = true;
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`ERROR: Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`ERROR: No user found with email "${email}".`);
    console.error('       Run "pnpm --filter backend db:seed" to create the admin account first.');
    process.exit(1);
  }

  const password_hash = await hashPassword(password);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password_hash,
      must_change_password: false,
      is_active: true,
      status: 'ACTIVE',
    },
  });

  // Clear Redis-based lockout counter so the admin can log in immediately.
  await clearLoginLockout(email);

  if (generated) {
    console.log(`Admin password reset for: ${email}`);
    console.log(`Generated password (shown once): ${password}`);
    console.log('Store it now and log in immediately to set your own password.');
  } else {
    const visible = password.slice(0, 2) + '*'.repeat(Math.max(0, password.length - 4)) + password.slice(-2);
    console.log(`Admin password reset for: ${email} (${visible})`);
  }
}

main()
  .catch((e) => {
    console.error('Reset failed:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
