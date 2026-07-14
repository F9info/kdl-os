/**
 * KDL-195 — owner_module ownership contract (Setting Fields)
 *
 * Covers list defaults, the by-type/:slug feed, generic write protection, the
 * values endpoint, reorder, and ref checks — all scoped to standalone rows.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));
vi.mock('../../shared/services/storage.service.js', () => ({
  uploadFile: vi.fn(),
  getFileUrl: vi.fn().mockResolvedValue('https://example/url'),
  deleteFile: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../config/database.js';
import * as service from './service.js';

const reset = (fieldOverrides = {}) => {
  prisma.settingField = {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    findUnique: vi.fn().mockResolvedValue({ id: 'f1' }),
    findFirst: vi.fn().mockResolvedValue({ id: 'f1', input_type: 'text' }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    delete: vi.fn().mockResolvedValue({ id: 'f1' }),
    ...fieldOverrides,
  };
  prisma.type = { findFirst: vi.fn().mockResolvedValue({ id: 't1' }) };
  prisma.category = { findFirst: vi.fn().mockResolvedValue({ id: 'cat1' }) };
  prisma.$transaction = vi.fn(async (arg) => (Array.isArray(arg) ? arg : arg(prisma)));
};

beforeEach(() => {
  vi.clearAllMocks();
  reset();
});

describe('listFields — owner_module filter', () => {
  it('defaults to owner_module=null', async () => {
    await service.listFields({});
    expect(prisma.settingField.findMany.mock.calls[0][0].where.owner_module).toBeNull();
  });

  it('scopes to the requested module when ?ownerModule is given', async () => {
    await service.listFields({ ownerModule: 'template-engine' });
    expect(prisma.settingField.findMany.mock.calls[0][0].where.owner_module).toBe('template-engine');
  });
});

describe('getTypeBySlug — by-type/:slug feed', () => {
  it('resolves only standalone types (module-owned slug -> null -> 404)', async () => {
    await service.getTypeBySlug('webapp.branding');
    expect(prisma.type.findFirst).toHaveBeenCalledWith({
      where: { slug: 'webapp.branding', owner_module: null },
    });
  });
});

describe('getWritableFieldById — existence guard', () => {
  it('resolves only standalone fields', async () => {
    await service.getWritableFieldById('f1');
    expect(prisma.settingField.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'f1', owner_module: null } })
    );
  });
});

describe('updateField / deleteField — write protection', () => {
  it('updateField scopes the write to owner_module=null', async () => {
    await service.updateField('f1', { sort: 3 });
    expect(prisma.settingField.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'f1', owner_module: null } })
    );
  });

  it('updateField returns null when no standalone row matched', async () => {
    reset({ updateMany: vi.fn().mockResolvedValue({ count: 0 }) });
    expect(await service.updateField('owned', { sort: 3 })).toBeNull();
  });

  it('deleteField resolves the target scoped to owner_module=null', async () => {
    await service.deleteField('f1');
    expect(prisma.settingField.findFirst).toHaveBeenCalledWith({
      where: { id: 'f1', owner_module: null },
    });
    expect(prisma.settingField.delete).toHaveBeenCalledWith({ where: { id: 'f1' } });
  });

  it('deleteField returns null and skips delete for module-owned/missing rows', async () => {
    reset({ findFirst: vi.fn().mockResolvedValue(null) });
    expect(await service.deleteField('owned')).toBeNull();
    expect(prisma.settingField.delete).not.toHaveBeenCalled();
  });
});

describe('reorderFields — only standalone fields move', () => {
  it('scopes each sort write to owner_module=null', async () => {
    await service.reorderFields(['a', 'b']);
    for (const call of prisma.settingField.updateMany.mock.calls) {
      expect(call[0].where.owner_module).toBeNull();
    }
  });
});

describe('saveValues — generic values endpoint', () => {
  it('only loads standalone fields for the given type', async () => {
    await service.saveValues('t1', []);
    expect(prisma.settingField.findMany).toHaveBeenCalledWith({
      where: { type_id: 't1', owner_module: null },
    });
  });
});

describe('ref checks — generic writes reference only standalone rows', () => {
  it('typeExists scopes to owner_module=null', async () => {
    await service.typeExists('t1');
    expect(prisma.type.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 't1', owner_module: null } })
    );
  });

  it('categoryExists scopes to owner_module=null', async () => {
    await service.categoryExists('cat1');
    expect(prisma.category.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cat1', owner_module: null } })
    );
  });
});
