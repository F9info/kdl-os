/**
 * KDL-195 — owner_module ownership contract (Categories)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));

import { prisma } from '../../config/database.js';
import * as service from './service.js';

const reset = (categoryOverrides = {}) => {
  prisma.category = {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    findUnique: vi.fn().mockResolvedValue({ id: 'c1' }),
    findFirst: vi.fn().mockResolvedValue({ id: 'c1' }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    ...categoryOverrides,
  };
  prisma.type = {
    findFirst: vi.fn().mockResolvedValue({ id: 't1' }),
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  reset();
});

describe('listCategories — owner_module filter', () => {
  it('defaults to owner_module=null', async () => {
    await service.listCategories({});
    expect(prisma.category.findMany.mock.calls[0][0].where.owner_module).toBeNull();
  });

  it('scopes to the requested module when ?ownerModule is given', async () => {
    await service.listCategories({ ownerModule: 'theme-engine' });
    expect(prisma.category.findMany.mock.calls[0][0].where.owner_module).toBe('theme-engine');
  });
});

describe('getWritableCategoryById — existence guard', () => {
  it('resolves only standalone categories', async () => {
    await service.getWritableCategoryById('c1');
    expect(prisma.category.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'c1', owner_module: null } })
    );
  });
});

describe('updateCategory / deleteCategory — write protection', () => {
  it('updateCategory scopes the write to owner_module=null', async () => {
    await service.updateCategory('c1', { is_active: false });
    expect(prisma.category.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'c1', owner_module: null } })
    );
  });

  it('updateCategory returns null when no standalone row matched', async () => {
    reset({ updateMany: vi.fn().mockResolvedValue({ count: 0 }) });
    expect(await service.updateCategory('owned', { is_active: false })).toBeNull();
  });

  it('deleteCategory scopes the delete and returns false for module-owned rows', async () => {
    reset({ deleteMany: vi.fn().mockResolvedValue({ count: 0 }) });
    expect(await service.deleteCategory('owned')).toBe(false);
    expect(prisma.category.deleteMany).toHaveBeenCalledWith({
      where: { id: 'owned', owner_module: null },
    });
  });
});

describe('typeExists — only standalone types are referenceable', () => {
  it('scopes the lookup to owner_module=null', async () => {
    await service.typeExists('t1');
    expect(prisma.type.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 't1', owner_module: null } })
    );
  });
});
