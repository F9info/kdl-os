import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));
vi.mock('../user-management/shared/activity-logger.js', () => ({ writeActivityAsync: vi.fn() }));
vi.mock('../../middleware/module-gate.js', () => ({
  invalidateModuleCache: vi.fn(),
}));

import { prisma } from '../../config/database.js';
import { loadedManifests } from '../../shared/modules/module-loader.js';
import { enableModule } from './service.js';

vi.mock('../../shared/modules/module-loader.js', () => ({
  loadedManifests: new Map(),
}));

function makeManifest(slug, conflictsWith = []) {
  return { slug, name: slug, version: '1.0.0', core: false, dependsOn: [], conflictsWith, permissions: [], env: [] };
}

beforeEach(() => {
  loadedManifests.clear();
  vi.clearAllMocks();
});

describe('checkConflicts via enableModule', () => {
  it('fails with 409 when manifest.conflictsWith names an ENABLED module', async () => {
    loadedManifests.set('mod-a', makeManifest('mod-a', ['mod-b']));
    loadedManifests.set('mod-b', makeManifest('mod-b'));

    prisma.module = {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.slug === 'mod-a') return Promise.resolve({ slug: 'mod-a', status: 'INSTALLED', is_core: false });
        return Promise.resolve(null);
      }),
      findMany: vi.fn().mockResolvedValue([{ slug: 'mod-b' }]),
      update: vi.fn(),
    };

    await expect(enableModule('mod-a', 'actor')).rejects.toMatchObject({
      status: 409,
      message: 'Cannot enable "mod-a": conflicts with active module "mod-b"',
    });
  });

  it('fails with 409 when an ENABLED module\'s conflictsWith names the slug being enabled', async () => {
    loadedManifests.set('mod-a', makeManifest('mod-a'));
    loadedManifests.set('mod-c', makeManifest('mod-c', ['mod-a']));

    prisma.module = {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.slug === 'mod-a') return Promise.resolve({ slug: 'mod-a', status: 'INSTALLED', is_core: false });
        return Promise.resolve(null);
      }),
      findMany: vi.fn().mockResolvedValue([{ slug: 'mod-c' }]),
      update: vi.fn(),
    };

    await expect(enableModule('mod-a', 'actor')).rejects.toMatchObject({
      status: 409,
      message: 'Cannot enable "mod-a": conflicts with active module "mod-c"',
    });
  });

  it('enables normally when no conflicts are active', async () => {
    loadedManifests.set('mod-x', makeManifest('mod-x', ['mod-y']));
    loadedManifests.set('mod-y', makeManifest('mod-y'));

    const updated = { slug: 'mod-x', status: 'ENABLED' };
    prisma.module = {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.slug === 'mod-x') return Promise.resolve({ slug: 'mod-x', status: 'INSTALLED', is_core: false, id: 'id-x' });
        return Promise.resolve(null);
      }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue(updated),
    };

    const result = await enableModule('mod-x', 'actor');
    expect(result.status).toBe('ENABLED');
  });
});
