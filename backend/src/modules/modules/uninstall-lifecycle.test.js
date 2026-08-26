import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));
vi.mock('../user-management/shared/activity-logger.js', () => ({ writeActivityAsync: vi.fn() }));
vi.mock('../../middleware/module-gate.js', () => ({ invalidateModuleCache: vi.fn() }));
vi.mock('node:fs', () => ({ existsSync: vi.fn(() => false) }));

vi.mock('../../shared/modules/module-loader.js', () => ({
  loadedManifests: new Map(),
}));

import { prisma } from '../../config/database.js';
import { loadedManifests } from '../../shared/modules/module-loader.js';
import { uninstallModule } from './service.js';

function makeDbModule(overrides = {}) {
  return { id: 'mod-id', slug: 'test-mod', is_core: false, status: 'INSTALLED', ...overrides };
}

beforeEach(() => {
  loadedManifests.clear();
  vi.clearAllMocks();
  loadedManifests.set('test-mod', {
    slug: 'test-mod',
    name: 'Test',
    version: '1.0.0',
    core: false,
    permissions: [],
    env: [],
  });
});

describe('uninstallModule lifecycle guard', () => {
  it('uninstalls a module that was INSTALLED but never ENABLED', async () => {
    prisma.module = {
      findUnique: vi.fn().mockResolvedValue(makeDbModule({ status: 'INSTALLED' })),
      delete: vi.fn().mockResolvedValue({}),
    };
    prisma.$transaction = vi.fn((fn) => fn(prisma));

    await expect(uninstallModule('test-mod', 'actor')).resolves.toBeUndefined();
    expect(prisma.module.delete).toHaveBeenCalledWith({ where: { slug: 'test-mod' } });
  });

  it('uninstalls a module that is DISABLED', async () => {
    prisma.module = {
      findUnique: vi.fn().mockResolvedValue(makeDbModule({ status: 'DISABLED' })),
      delete: vi.fn().mockResolvedValue({}),
    };
    prisma.$transaction = vi.fn((fn) => fn(prisma));

    await expect(uninstallModule('test-mod', 'actor')).resolves.toBeUndefined();
    expect(prisma.module.delete).toHaveBeenCalledWith({ where: { slug: 'test-mod' } });
  });

  it('rejects uninstall of an ENABLED module with 409', async () => {
    prisma.module = {
      findUnique: vi.fn().mockResolvedValue(makeDbModule({ status: 'ENABLED' })),
    };

    await expect(uninstallModule('test-mod', 'actor')).rejects.toMatchObject({
      status: 409,
      message: 'Module "test-mod" must be disabled before uninstalling',
    });
    expect(prisma.module.delete).toBeUndefined();
  });
});
