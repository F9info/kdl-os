import { describe, it, expect } from 'vitest';
import { resolveSeedAdminCredentials } from '../../prisma/seed-credentials.js';

describe('seed admin credentials (KDL-273 H2)', () => {
  it('uses SEED_ADMIN_PASSWORD and SEED_ADMIN_EMAIL when set', () => {
    const creds = resolveSeedAdminCredentials({
      SEED_ADMIN_EMAIL: 'root@example.com',
      SEED_ADMIN_PASSWORD: 'a-strong-seed-password',
      NODE_ENV: 'production',
    });
    expect(creds).toEqual({
      email: 'root@example.com',
      password: 'a-strong-seed-password',
      generated: false,
    });
  });

  it('rejects a SEED_ADMIN_PASSWORD shorter than 12 characters', () => {
    expect(() =>
      resolveSeedAdminCredentials({ SEED_ADMIN_PASSWORD: 'short', NODE_ENV: 'development' }),
    ).toThrow(/at least 12 characters/);
  });

  it('refuses to seed in production without SEED_ADMIN_PASSWORD', () => {
    expect(() => resolveSeedAdminCredentials({ NODE_ENV: 'production' })).toThrow(
      /must be set in production/,
    );
  });

  it('never falls back to the old Admin@123 default', () => {
    const creds = resolveSeedAdminCredentials({ NODE_ENV: 'development' });
    expect(creds.password).not.toBe('Admin@123');
  });

  it('generates a random password outside production and flags it', () => {
    const a = resolveSeedAdminCredentials({ NODE_ENV: 'development' });
    const b = resolveSeedAdminCredentials({ NODE_ENV: 'development' });
    expect(a.generated).toBe(true);
    expect(a.email).toBe('admin@kdl.com');
    expect(a.password.length).toBeGreaterThanOrEqual(16);
    expect(a.password).not.toBe(b.password);
  });
});
