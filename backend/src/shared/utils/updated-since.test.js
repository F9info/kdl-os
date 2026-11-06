import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { updatedSinceField, applyUpdatedSince } from './updated-since.js';

describe('updated_since', () => {
  const schema = z.object({ updated_since: updatedSinceField });
  it('accepts ISO-8601 with offset/Z, and omission', () => {
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ updated_since: '2026-11-06T10:00:00Z' }).success).toBe(true);
    expect(schema.safeParse({ updated_since: '2026-11-06T10:00:00+05:30' }).success).toBe(true);
  });
  it('rejects non-dates so garbage never reaches Prisma', () => {
    for (const bad of ['yesterday', '2026-11-06', '1', "'; drop", ''])
      expect(schema.safeParse({ updated_since: bad }).success, bad).toBe(false);
  });
  it('adds an updated_at > filter and keeps existing filters', () => {
    const where = applyUpdatedSince({ is_active: true }, { updated_since: '2026-11-06T10:00:00Z' });
    expect(where).toEqual({ is_active: true, updated_at: { gt: new Date('2026-11-06T10:00:00Z') } });
    expect(applyUpdatedSince({ a: 1 }, {})).toEqual({ a: 1 });
  });
});
