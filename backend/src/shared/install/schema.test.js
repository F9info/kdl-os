import { describe, it, expect } from 'vitest';
import { adminSchema } from './schema.js';

const body = (password, confirm = password) => ({
  body: { name: 'Asha Rao', email: 'asha@acme.test', password, confirm_password: confirm },
});

describe('installer admin password', () => {
  it('accepts 8 characters', () => {
    expect(adminSchema.safeParse(body('abcd1234')).success).toBe(true);
  });

  it('rejects 7 characters with an "at least 8" message', () => {
    const r = adminSchema.safeParse(body('abcd123'));
    expect(r.success).toBe(false);
    expect(r.error.issues[0].message).toMatch(/at least 8/);
  });

  it('still rejects more than 72 bytes and a mismatched confirm', () => {
    expect(adminSchema.safeParse(body('é'.repeat(40))).success).toBe(false);
    expect(adminSchema.safeParse(body('abcd1234', 'abcd12345')).success).toBe(false);
  });
});
