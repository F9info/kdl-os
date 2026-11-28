import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));
import { createLayoutSchema, saveLayoutSchema } from './schema.js';

const create = (variant) =>
  createLayoutSchema.safeParse({ params: { id: 'p1' }, body: { kind: 'HEADER', name: 'x', variant } }).success;

describe('layout variant', () => {
  it('accepts built-in, f9, custom and Landing designs 1-4', () => {
    for (const v of ['1', '5', 'f9', 'custom:abc', 'landing:1', 'landing:4']) expect(create(v), v).toBe(true);
  });
  it('rejects unknown designs', () => {
    for (const v of ['landing:0', 'landing:5', 'landing:', 'landing', '6']) expect(create(v), v).toBe(false);
  });
  it('a site layout slot accepts a Landing design too', () => {
    const r = saveLayoutSchema.safeParse({ params: { id: 'p1' }, body: { header: { enabled: true, variant: 'landing:2' } } });
    expect(r.success).toBe(true);
  });
});
