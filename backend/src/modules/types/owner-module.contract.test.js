/**
 * KDL-195 — owner_module ownership contract (Types)
 *
 * The generic admin API manages only standalone rows (owner_module = null).
 * Template-engine-owned rows must be invisible to unfiltered lists and immune
 * to generic writes even when their id is known.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));

import { prisma } from '../../config/database.js';
import * as service from './service.js';

const resetType = (overrides = {}) => {
  prisma.type = {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    findUnique: vi.fn().mockResolvedValue({ id: 't1' }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    findFirst: vi.fn().mockResolvedValue({ id: 't1' }),
    ...overrides,
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  resetType();
});

describe('listTypes — owner_module filter', () => {
  it('defaults to owner_module=null (hides module-owned rows)', async () => {
    await service.listTypes({});
    const where = prisma.type.findMany.mock.calls[0][0].where;
    expect(where.owner_module).toBeNull();
  });

  it('scopes to the requested module when ?ownerModule is given', async () => {
    await service.listTypes({ ownerModule: 'template-engine' });
    const where = prisma.type.findMany.mock.calls[0][0].where;
    expect(where.owner_module).toBe('template-engine');
  });
});

describe('getWritableTypeById — existence guard', () => {
  it('resolves only standalone types', async () => {
    await service.getWritableTypeById('t1');
    expect(prisma.type.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 't1', owner_module: null } })
    );
  });
});

describe('updateType — write protection', () => {
  it('scopes the write to owner_module=null', async () => {
    await service.updateType('t1', { is_active: false });
    expect(prisma.type.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 't1', owner_module: null } })
    );
  });

  it('returns null when no standalone row matched (module-owned or missing)', async () => {
    resetType({ updateMany: vi.fn().mockResolvedValue({ count: 0 }) });
    const result = await service.updateType('owned', { is_active: false });
    expect(result).toBeNull();
    expect(prisma.type.findUnique).not.toHaveBeenCalled();
  });
});

describe('deleteType — write protection', () => {
  it('scopes the delete to owner_module=null', async () => {
    await service.deleteType('t1');
    expect(prisma.type.deleteMany).toHaveBeenCalledWith({
      where: { id: 't1', owner_module: null },
    });
  });

  it('returns false when the row is module-owned or missing', async () => {
    resetType({ deleteMany: vi.fn().mockResolvedValue({ count: 0 }) });
    expect(await service.deleteType('owned')).toBe(false);
  });

  it('returns true when a standalone row was removed', async () => {
    expect(await service.deleteType('t1')).toBe(true);
  });
});
